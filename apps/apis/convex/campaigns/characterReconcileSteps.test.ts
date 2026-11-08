import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignContentRemovalReceiptDto,
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignCharacterReconcileStepSchema } from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { abacus } from '@artificer-toolkit/source-data/srd/equipment/abacus.js'
import { candle } from '@artificer-toolkit/source-data/srd/equipment/candle.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { fixture, input } from '../../tests/fixtures/characters'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { runDueScheduledWork } from '../../tests/fixtures/dueScheduledWork'
import type { RoomCaller } from '../../tests/fixtures/localRoomWorker'
import {
  importedSubject,
  importSeededSubjects,
  makePublishedRootOwned
} from '../../tests/fixtures/publication'
import { handlerOf } from '../../tests/fixtures/queryTransaction'
import { readyCharacterFixture, readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { unassign } from './assignments'
import { run } from './characterReconcileSteps'
import { unshare } from './contentShareRemoval'
import { removeMember } from './membershipDeparture'

/**
 * PERF-6.T6 budgets (orchestrator ruling, 2026-11-08): a removal or departure transaction reads at
 * most 200 documents however large the party, and each Character's queued step at most 850 for the
 * SRD Life Cleric, whose Builder read is 697 Spell and Class roots (shrinking it is PERF-6.T11).
 */
const TRANSACTION_READ_DOCUMENTS = 200
const STEP_READ_DOCUMENTS = 850
/** The largest seeded party: the encounter cutover workload's five players. */
const PARTY_SIZE = 5

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

type Base = Awaited<ReturnType<typeof fixture>>
type Transaction = Pick<RoomCaller, 'run'>

afterEach(() => vi.useRealTimers())

/** Holds the work a transaction schedules until the test runs it (`runDueScheduledWork`). */
function holdScheduledWork() {
  vi.useFakeTimers({ toFake: ['setTimeout'] })
}

/** Runs a registered mutation's handler in one transaction of the caller's, counting its I/O. */
async function measure<Result>(caller: Transaction, registered: object, args: unknown) {
  const totals = createDatabaseIoTotals()
  const result = await caller.run((ctx) =>
    handlerOf<Result, MutationCtx>(registered)(
      { ...ctx, db: countDatabaseIo(ctx.db, totals) },
      args
    )
  )
  return { result, reads: totals.reads.documents, writes: totals.writes.documents }
}

async function queuedSteps(caller: Transaction) {
  return (await caller.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()))
    .filter(
      (job) => job.name === 'campaigns/characterReconcileSteps:run' && job.state.kind === 'pending'
    )
    .map((job) => campaignCharacterReconcileStepSchema.parse(job.args[0]))
}

/** The Characters and the Campaign's history, which a duplicate step must leave unchanged. */
function snapshot(caller: Transaction, campaignId: string, characterIds: readonly string[]) {
  return caller.run(async (ctx) => ({
    characters: await Promise.all(characterIds.map((id) => readCharacterRow(ctx, id))),
    events: await ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect()
  }))
}

/** Runs each queued step, then each again and then the scheduler's own copy: both are no-ops. */
async function runStepsTwice(caller: Transaction, campaignId: string, characterIds: string[]) {
  const steps = await queuedSteps(caller)
  const firstReads: number[] = []
  for (const step of steps) firstReads.push((await measure<null>(caller, run, step)).reads)
  const reconciled = await snapshot(caller, campaignId, characterIds)
  for (const step of steps) expect((await measure<null>(caller, run, step)).writes).toBe(0)
  expect(await snapshot(caller, campaignId, characterIds)).toEqual(reconciled)
  await runDueScheduledWork(caller)
  expect(await snapshot(caller, campaignId, characterIds)).toEqual(reconciled)
  return { steps, firstReads, reconciled }
}

async function gmCampaign(base: Base) {
  return base.other.caller.mutation(createCampaign, {
    name: 'Reconcile table',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
}

async function seatPlayer(
  base: Base,
  campaign: CampaignDetailDto,
  userId: string,
  characterId: string
) {
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId,
      characterId,
      assignedAt: campaign.createdAt
    })
  })
}

async function readCampaignVersion(base: Base, campaignId: string) {
  const version = await base.t.run(
    async (ctx) =>
      (
        await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaignId))
          .unique()
      )?.version
  )
  if (version === undefined) throw new Error('Missing Campaign.')
  return version
}

/** Shares an Equipment the GM owns; returns the unshare request for it. */
async function shareGmEquipment(base: Base, campaign: CampaignDetailDto, equipmentId: string) {
  await base.t.run((ctx) => makePublishedRootOwned(ctx, equipmentId, base.other.userId))
  await base.other.caller.mutation(api.campaigns.contentShares.share, {
    campaignId: campaign.id,
    subjectKind: 'EQUIPMENT',
    subjectId: equipmentId
  })
  return {
    campaignId: campaign.id,
    subjectKind: 'EQUIPMENT' as const,
    subjectId: equipmentId,
    sharedBy: base.other.userId,
    expectedCampaignVersion: await readCampaignVersion(base, campaign.id),
    commandId: crypto.randomUUID()
  }
}

/** The whole SRD beside a level 1 Life Domain Cleric with no cantrips to choose. */
async function readySrdCleric() {
  const base = await fixture()
  const subjects = [
    ...srdRaces.map((document) => importedSubject({ subjectKind: 'RACE', ...document, document })),
    ...srdClasses
      .filter((document) => document.id !== cleric.id && document.id !== lifeDomainCleric.id)
      .map((document) => importedSubject({ subjectKind: 'CLASS', ...document, document })),
    importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
    ...srdEquipment.map((document) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
    ),
    ...srdSpells.map((document) => importedSubject({ subjectKind: 'SPELL', ...document, document }))
  ]
  for (let start = 0; start < subjects.length; start += 10)
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: subjects.slice(start, start + 10)
    })
  if (cleric.category !== 'BASE' || !cleric.spellcasting) throw new Error('Expected a base Class.')
  return readySheetFixture(
    {
      base: cleric,
      subclass: lifeDomainCleric,
      spellcasting: {
        ...cleric.spellcasting,
        spellLimits: cleric.spellcasting.spellLimits.map((limit) => ({
          ...limit,
          cantripsLimit: 0
        }))
      }
    },
    abacus,
    base
  )
}

describe('Campaign Character reconcile steps (PERF-6.T6)', () => {
  it('unshares Equipment the whole party holds in one bounded transaction and one idempotent step per Character', async () => {
    const base = await readyCharacterFixture()
    const campaign = await gmCampaign(base)
    const players = [base.owner]
    for (let index = 1; index < PARTY_SIZE; index++)
      players.push(await base.addActor(`Player${index}`))
    const characterIds: string[] = []
    for (const player of players) {
      const { draft, character } = await base.createCharacter(input(), player.caller)
      await player.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'create',
        character
      })
      await seatPlayer(base, campaign, player.userId, character.id)
      characterIds.push(character.id)
    }
    const request = await shareGmEquipment(base, campaign, club.id)
    const before = await snapshot(base.t, campaign.id, characterIds)

    holdScheduledWork()
    const removal = await measure<CampaignContentRemovalReceiptDto>(
      base.other.caller,
      unshare,
      request
    )
    console.info('PERF-6.T6 party unshare reads', removal.reads)
    expect(removal.reads).toBeLessThanOrEqual(TRANSACTION_READ_DOCUMENTS)
    expect(removal.result.affectedCharacters).toEqual([])
    expect([...(removal.result.pendingCharacterReconcileIds ?? [])].sort()).toEqual(
      [...characterIds].sort()
    )
    // The removal retained each Character's held rules; the Characters stay ready until their step.
    const retained = await snapshot(base.t, campaign.id, characterIds)
    for (const [index, row] of retained.characters.entries()) {
      const document = readCharacterRecord(row!)
      expect(document.status).toBe('ACTIVE')
      expect(document.state.equipment.inventory.every((item) => item.retainedRulesJson)).toBe(true)
      expect(row?.play.streamVersion).toBe(before.characters[index]?.play.streamVersion)
    }

    const { steps, firstReads, reconciled } = await runStepsTwice(base.t, campaign.id, characterIds)
    console.info('PERF-6.T6 party step reads', JSON.stringify(firstReads))
    expect(steps.map((step) => step.characterId).sort()).toEqual([...characterIds].sort())
    for (const reads of firstReads) expect(reads).toBeLessThanOrEqual(STEP_READ_DOCUMENTS)
    const events = reconciled.events.filter(
      (event) => event.type === 'CAMPAIGN_CHARACTER_RECONCILED'
    )
    expect(events.map((event) => event.subjectCharacterId).sort()).toEqual([...characterIds].sort())
    expect(events.map((event) => event.commandId).sort()).toEqual(
      steps.map((step) => step.stepId).sort()
    )
    for (const [index, row] of reconciled.characters.entries()) {
      expect(readCharacterRecord(row!).status).toBe('ACTIVE')
      expect(row?.play.streamVersion).toBe(before.characters[index]!.play.streamVersion + 1)
      expect(row?.sheetState).toEqual(before.characters[index]?.sheetState)
    }
  })

  it('settles a departed Character in its queued step: the departure keeps attunement until it runs (D81)', async () => {
    const base = await readySheetFixture()
    const campaign = await gmCampaign(base)
    await seatPlayer(base, campaign, base.owner.userId, base.character.id)
    const itemIds = Array.from({ length: 5 }, () => crypto.randomUUID())
    await base.t.run((ctx) =>
      editCharacterRecord(ctx, base.character.id, (document) => ({
        ...document,
        state: {
          ...document.state,
          equipment: {
            ...document.state.equipment,
            inventory: [
              ...document.state.equipment.inventory,
              ...itemIds.map((id) => ({ id, equipmentId: club.id, quantity: 1 }))
            ],
            attuned: itemIds
          }
        }
      }))
    )
    const before = await base.readState()

    holdScheduledWork()
    const departure = await measure(base.owner.caller, unassign, { campaignId: campaign.id })
    console.info('PERF-6.T6 unassign reads', departure.reads)
    expect(departure.reads).toBeLessThanOrEqual(TRANSACTION_READ_DOCUMENTS)
    expect(
      readCharacterRecord((await base.readState()).character!).state.equipment.attuned
    ).toEqual(itemIds)

    const { steps, reconciled } = await runStepsTwice(base.t, campaign.id, [base.character.id])
    expect(steps).toEqual([
      expect.objectContaining({
        characterId: base.character.id,
        reason: 'CHARACTER_UNASSIGNED',
        change: { kind: 'DEPARTED' }
      })
    ])
    const settled = readCharacterRecord(reconciled.characters[0]!)
    expect(settled.state.equipment.attuned).toEqual(itemIds.slice(0, 3))
    expect(settled.state.equipment.inventory.map((item) => item.id)).toEqual(
      expect.arrayContaining(itemIds)
    )
    expect((await base.readState()).receipts).toEqual(before.receipts)
  })

  it("keeps an SRD Life Cleric's removals, departure and steps within budget", async () => {
    const sheet = await readySrdCleric()
    const campaign = await gmCampaign(sheet)
    await seatPlayer(sheet, campaign, sheet.owner.userId, sheet.character.id)
    const characterIds = [sheet.character.id]

    // Equipment no Character holds queues no step.
    const unheld = await measure<CampaignContentRemovalReceiptDto>(
      sheet.other.caller,
      unshare,
      await shareGmEquipment(sheet, campaign, candle.id)
    )
    console.info('PERF-6.T6 Cleric unheld unshare reads', unheld.reads)
    expect(unheld.reads).toBeLessThanOrEqual(TRANSACTION_READ_DOCUMENTS)
    expect(unheld.result.pendingCharacterReconcileIds).toBeUndefined()
    expect(await queuedSteps(sheet.t)).toEqual([])

    const request = await shareGmEquipment(sheet, campaign, abacus.id)
    holdScheduledWork()
    const held = await measure<CampaignContentRemovalReceiptDto>(
      sheet.other.caller,
      unshare,
      request
    )
    console.info('PERF-6.T6 Cleric held unshare reads', held.reads)
    expect(held.reads).toBeLessThanOrEqual(TRANSACTION_READ_DOCUMENTS)
    expect(held.result.pendingCharacterReconcileIds).toEqual(characterIds)
    const unshareStep = await runStepsTwice(sheet.t, campaign.id, characterIds)
    console.info('PERF-6.T6 Cleric unshare step reads', unshareStep.firstReads[0])
    expect(unshareStep.firstReads).toHaveLength(1)
    expect(unshareStep.firstReads[0]).toBeLessThanOrEqual(STEP_READ_DOCUMENTS)

    const departure = await measure(sheet.other.caller, removeMember, {
      campaignId: campaign.id,
      userId: sheet.owner.userId,
      expectedCampaignVersion: await readCampaignVersion(sheet, campaign.id),
      expectedMembershipAccessStartedAt: campaign.createdAt,
      commandId: crypto.randomUUID()
    })
    console.info('PERF-6.T6 Cleric removeMember reads', departure.reads)
    expect(departure.reads).toBeLessThanOrEqual(TRANSACTION_READ_DOCUMENTS)
    const departureStep = await runStepsTwice(sheet.t, campaign.id, characterIds)
    console.info('PERF-6.T6 Cleric departure step reads', departureStep.firstReads[0])
    expect(departureStep.steps.map((step) => step.change.kind)).toEqual(['DEPARTED'])
    expect(departureStep.firstReads[0]).toBeLessThanOrEqual(STEP_READ_DOCUMENTS)
    expect(readCharacterRecord(departureStep.reconciled.characters[0]!).status).toBe('ACTIVE')
  }, 900_000)
})

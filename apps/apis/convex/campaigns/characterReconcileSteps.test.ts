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
import { deriveAndStoreCharacterSheet } from '../characters/sheetSectionDerivation'
import { readCharacterSheetPendingStore } from '../characters/sheetSectionStores'
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
import { CHARACTER_RECONCILE_ATTEMPTS, run, verify } from './characterReconcileSteps'
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

const sheetSectionsState = makeFunctionReference<'query', { characterId: string }, string>(
  'characters/development:sheetSectionsState'
)
const characterReconcileState = makeFunctionReference<'query', { characterId: string }, string>(
  'characters/development:characterReconcileState'
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

/** The states of the step's runs, in the order they were queued. */
async function stepRuns(caller: Transaction, stepId: string) {
  return (await caller.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()))
    .filter(
      (job) =>
        job.name === 'campaigns/characterReconcileSteps:run' &&
        campaignCharacterReconcileStepSchema.parse(job.args[0]).stepId === stepId
    )
    .map((job) => job.state.kind)
}

function pendingStep(caller: Transaction, stepId: string) {
  return caller.run((ctx) =>
    ctx.db
      .query('campaignCharacterReconciles')
      .withIndex('by_stepId', (q) => q.eq('stepId', stepId))
      .unique()
  )
}

/** A second row with the Campaign's id, so a step's Campaign read fails; the returned call repairs it. */
async function breakSteps(caller: Transaction, campaignId: string) {
  const duplicate = await caller.run(async (ctx) => {
    const row = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    if (!row) throw new Error('Missing Campaign.')
    const { _id, _creationTime, ...fields } = row
    return ctx.db.insert('campaigns', fields)
  })
  return () => caller.run((ctx) => ctx.db.delete(duplicate))
}

/** Five attuned clubs, over the System's limit of three, which a departed Character's step trims. */
async function overAttune(base: Awaited<ReturnType<typeof readySheetFixture>>) {
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
  return itemIds
}

async function readAttuned(base: Awaited<ReturnType<typeof readySheetFixture>>) {
  return readCharacterRecord((await base.readState()).character!).state.equipment.attuned
}

/** An over-attuned Character unassigned from a fresh Campaign, with its DEPARTED step queued and held. */
async function departedStep() {
  const base = await readySheetFixture()
  const campaign = await gmCampaign(base)
  await seatPlayer(base, campaign, base.owner.userId, base.character.id)
  const itemIds = await overAttune(base)
  holdScheduledWork()
  await measure(base.owner.caller, unassign, { campaignId: campaign.id })
  const [step, ...others] = await queuedSteps(base.t)
  if (!step || others.length) throw new Error('Expected one queued step.')
  return { base, campaign, step, itemIds }
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
    const itemIds = await overAttune(base)
    const before = await base.readState()

    holdScheduledWork()
    const departure = await measure(base.owner.caller, unassign, { campaignId: campaign.id })
    console.info('PERF-6.T6 unassign reads', departure.reads)
    expect(departure.reads).toBeLessThanOrEqual(TRANSACTION_READ_DOCUMENTS)
    expect(await readAttuned(base)).toEqual(itemIds)

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

  it('keeps a Builder draft opened before departure committable while its step is pending (PERF-6.T13)', async () => {
    const base = await readySheetFixture()
    const campaign = await gmCampaign(base)
    await seatPlayer(base, campaign, base.owner.userId, base.character.id)
    const currencySystem = await base.other.caller.mutation(api.campaigns.currencySystems.save, {
      campaignId: campaign.id,
      label: 'Table tokens',
      isReference: true,
      denominations: [{ label: 'Token', abbreviation: 'tk', scaleInReference: 1 }]
    })
    // Campaign currency the departure returns to the party, so the departure writes the Character.
    await base.t.run((ctx) =>
      editCharacterRecord(ctx, base.character.id, (document) => ({
        ...document,
        state: {
          ...document.state,
          currency: [
            ...document.state.currency,
            {
              id: crypto.randomUUID(),
              currencies: [
                {
                  currencyId: currencySystem.denominations[0]!.id,
                  kind: 'CAMPAIGN' as const,
                  campaignCurrencySystemId: currencySystem.id,
                  amount: 3
                }
              ]
            }
          ]
        }
      }))
    )
    const opened = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const before = (await base.readState()).character!

    holdScheduledWork()
    const departure = await measure(base.owner.caller, unassign, { campaignId: campaign.id })
    expect(departure.reads).toBeLessThanOrEqual(TRANSACTION_READ_DOCUMENTS)
    expect(await queuedSteps(base.t)).toHaveLength(1)
    const departed = (await base.readState()).character!
    expect(departed.updatedAt).not.toBe(before.updatedAt)

    // The player reopens the draft they had open and commits it before the step has run.
    const reopened = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    expect(reopened.id).toBe(opened.id)
    const saved = await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: base.character.id,
      expectedDraftId: reopened.id,
      mode: 'edit',
      baseActiveUpdatedAt: reopened.baseActiveUpdatedAt,
      character: { ...reopened.payload.character, label: 'Edited after departure' },
      ...(reopened.payload.builderIntent === undefined
        ? {}
        : { builderIntent: reopened.payload.builderIntent })
    })
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: saved.id,
      mode: 'edit',
      character: saved.payload.character
    })
    const campaignBalances = (document: ReturnType<typeof readCharacterRecord>) =>
      document.state.currency
        .flatMap((group) => group.currencies)
        .filter((row) => row.kind === 'CAMPAIGN')
    const committed = readCharacterRecord((await base.readState()).character!)
    expect(committed.label).toBe('Edited after departure')
    // The returned Campaign currency stays returned: the draft did not bring it back.
    expect(campaignBalances(committed)).toEqual([])

    await runDueScheduledWork(base.t)
    expect(await queuedSteps(base.t)).toEqual([])
    const settled = readCharacterRecord((await base.readState()).character!)
    expect(settled.status).toBe('ACTIVE')
    expect(settled.label).toBe('Edited after departure')
    expect(campaignBalances(settled)).toEqual([])
  })

  it('leaves the Sheet of a Character that departs with a shared source to reach Builder repair once its step runs (PERF-6.T13)', async () => {
    const base = await readySheetFixture()
    const campaign = await gmCampaign(base)
    await base.t.run((ctx) => makePublishedRootOwned(ctx, acolyte.id, base.other.userId))
    await base.other.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    await seatPlayer(base, campaign, base.owner.userId, base.character.id)
    await runDueScheduledWork(base.t)
    const sheetState = () => base.t.query(sheetSectionsState, { characterId: base.character.id })
    const reconcileState = () =>
      base.t.query(characterReconcileState, { characterId: base.character.id })
    const readSheet = () =>
      base.owner.caller.query(api.characters.sheet.get, { id: base.character.id })
    expect(await sheetState()).toBe('CURRENT')

    holdScheduledWork()
    await base.owner.caller.mutation(unassign, { campaignId: campaign.id })
    expect(await reconcileState()).toBe('PENDING')
    // The window: the departure removed the Background's share, so the queued Sheet store lands
    // before the step finds Builder repair and stores nothing; the Sheet read reports the repair.
    const store = await base.t.run((ctx) => readCharacterSheetPendingStore(ctx, base.character.id))
    if (!store) throw new Error('The departure queued no Sheet store.')
    await base.t.run((ctx) => deriveAndStoreCharacterSheet(ctx, base.character.id, store.token))
    expect((await base.readState()).character?.status).toBe('ACTIVE')
    expect(await sheetState()).toBe('MISSING')
    await expect(readSheet()).rejects.toThrow('Builder repair')

    // The step runs with no other action and leaves the Sheet in its post-departure state.
    await runDueScheduledWork(base.t)
    expect(await reconcileState()).toBe('NONE')
    expect((await base.readState()).character?.status).toBe('DRAFT')
    expect(await sheetState()).toBe('NO_SHEET')
    await expect(readSheet()).rejects.toThrow('Builder repair')
  })

  it('queues a failed step again, which then completes; the settled step queued again is a no-op', async () => {
    const { base, campaign, step, itemIds } = await departedStep()
    const restore = await breakSteps(base.t, campaign.id)
    await runDueScheduledWork(base.t)
    expect(await stepRuns(base.t, step.stepId)).toEqual(['failed'])
    expect(await pendingStep(base.t, step.stepId)).toMatchObject({ attempts: 1 })
    expect(await readAttuned(base)).toEqual(itemIds)
    await restore()
    // The step's check, which runs after its run was queued, queues the run again.
    await base.t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer())
    expect(await stepRuns(base.t, step.stepId)).toEqual(['failed', 'success'])
    expect(await pendingStep(base.t, step.stepId)).toBeNull()
    expect(await readAttuned(base)).toEqual(itemIds.slice(0, 3))
    const settled = await snapshot(base.t, campaign.id, [base.character.id])
    for (const registered of [run, verify])
      expect((await measure<null>(base.t, registered, step)).writes).toBe(0)
    expect(await stepRuns(base.t, step.stepId)).toEqual(['failed', 'success'])
    expect(await snapshot(base.t, campaign.id, [base.character.id])).toEqual(settled)
  })

  it('leaves a step whose every run fails pending, marked exhausted and logged once', async () => {
    const { base, campaign, step } = await departedStep()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stepLogs = () =>
      logged.mock.calls.filter(([message]) => String(message).includes(step.stepId))
    await breakSteps(base.t, campaign.id)
    await base.t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer())
    expect(await stepRuns(base.t, step.stepId)).toEqual(
      Array.from({ length: CHARACTER_RECONCILE_ATTEMPTS }, () => 'failed')
    )
    expect(await pendingStep(base.t, step.stepId)).toMatchObject({
      attempts: CHARACTER_RECONCILE_ATTEMPTS,
      exhaustedAt: expect.any(String)
    })
    expect(stepLogs()).toHaveLength(1)
    // A later check neither queues it again nor logs it again.
    expect((await measure<null>(base.t, verify, step)).writes).toBe(0)
    expect(await stepRuns(base.t, step.stepId)).toHaveLength(CHARACTER_RECONCILE_ATTEMPTS)
    expect(stepLogs()).toHaveLength(1)
    logged.mockRestore()
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

import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  EncounterExecuteInput,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterCommandResultDtoSchema,
  encounterPlayerProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import { api, components, internal } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'
import {
  createEncounterInitiativeDefinitions,
  declarationCommand
} from '../../tests/fixtures/encounterInitiative'
import { equipAllCharacterItems, setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  automaticChargedBiteEffectId,
  automaticChargedBiteFeatureId,
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  readPendingSnapshot,
  writePendingSnapshot
} from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  queueRoomRolls,
  readRoomRollCards,
  readRoomTimeline,
  roomErrorLogs,
  useLocalRoomWorker,
  type RoomCaller
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

async function setup(
  options: {
    cadence?: 'ENCOUNTER_START' | 'EACH_ROUND'
    rolls?: FixtureRolls
  } = {}
) {
  const base = await fixture()
  if (options.rolls === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'DECLARED_ACTION_ROLL', cadence: options.cadence ?? 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Initiative declaration fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: campaign.id })
  const policyId = initiative.policyIds[0]!
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: policyId,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Declaration fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'First', maxHitPoints: 10 },
      { kind: 'CUSTOM', label: 'Second', maxHitPoints: 10 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachFixtureRoom(base.t, campaign.id)
  return { ...base, campaign, run }
}

/** The room redacts the cause from the member; the Worker error log still carries it. */
async function expectRoomCause(command: Promise<unknown>, cause: RegExp) {
  const seen = roomErrorLogs().length
  await expectRedactedRoomRefusal(command, 'The Encounter command could not be completed.')
  expect(roomErrorLogs().slice(seen).join('\n')).toMatch(cause)
}

/** A pending-declaration read as a member sees it: Convex, once the room has published. */
async function readPending(
  base: { campaign: { id: string } },
  caller: Awaited<ReturnType<typeof fixture>>['owner']['caller'],
  encounterId: string
) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.pendingReads.pendingRuleOccurrence, { encounterId })
}

async function storedInitiative<
  T extends { t: Awaited<ReturnType<typeof fixture>>['t']; campaign: { id: string } }
>(base: T) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect()
  }))
}

/** A started Run whose declarations alternate between an assigned Character and a Custom enemy. */
async function startCharacterDeclarationRun(
  options: {
    hideEnemy?: boolean
    character?: Parameters<typeof setupCharacterRun>[0]
    /** Both members enter their own dice instead of the app rolling them. */
    promptDice?: boolean
  } = {}
) {
  // Deliberately unequipped: a carried weapon is declared as drawn.
  const base = await setupCharacterRun(options.character)
  if (options.promptDice) {
    await setAutoRollDice(base.t, base.owner.userId, false)
    await setAutoRollDice(base.t, base.player.userId, false)
  }
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Declaration privacy',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'First', maxHitPoints: 3 }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachFixtureRoom(base.t, base.campaign.id)
  const characterActor = run.actors.find((actor) => actor.kind === 'CHARACTER')
  if (!characterActor) throw new Error('Expected assigned Character actor.')
  const enemyActor = run.actors.find((actor) => actor.kind !== 'CHARACTER')
  if (!enemyActor) throw new Error('Expected enemy actor.')
  let expectedVersion = run.version
  if (options.hideEnemy)
    expectedVersion = (
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion,
          actorId: enemyActor.id,
          public: false
        }
      })
    ).projection.version
  const started = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion
    }
  })
  return { base, run, characterActor, enemyActor, started }
}

describe('native initiative declarations', () => {
  it('collects each automatic declaration, then settles exactly one Run, round, and order', async () => {
    const base = await setup()
    // Distinct faces keep the scores apart; equal random faces would tie, and a second tie in the
    // roll-off would ask the GM for the order.
    await queueRoomRolls(base.campaign.id, { rolls: [4, 9] })
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    const pending = await executeInRoom(base.owner.caller, start)
    if (
      !pending.occurrence?.pending ||
      pending.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
    )
      throw new Error('Expected first declaration.')
    await expect(executeInRoom(base.owner.caller, start)).resolves.toEqual(pending)
    expect(await storedInitiative(base)).toMatchObject({ rounds: [], participants: [] })
    const first = declarationCommand({
      encounterId: base.run.id,
      pending: pending.occurrence.pending
    })
    const continued = await executeInRoom(base.owner.caller, first)
    await expect(executeInRoom(base.owner.caller, first)).resolves.toEqual(continued)
    if (
      !continued.occurrence?.pending ||
      continued.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
    )
      throw new Error('Expected second declaration.')
    expect(await storedInitiative(base)).toMatchObject({ rounds: [], participants: [] })
    const terminal = declarationCommand({
      encounterId: base.run.id,
      pending: continued.occurrence.pending
    })
    const beforeTerminal = await storedInitiative(base)
    expect(await storedInitiative(base)).toEqual(beforeTerminal)
    const settled = await executeInRoom(base.owner.caller, terminal)
    await expect(executeInRoom(base.owner.caller, terminal)).resolves.toEqual(settled)
    await expect(executeInRoom(base.owner.caller, first)).resolves.toEqual({
      ...continued,
      projection: settled.projection
    })
    await expect(executeInRoom(base.owner.caller, start)).resolves.toEqual({
      ...pending,
      projection: settled.projection
    })
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', round: 1, currentActorId: expect.any(String) },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    const stored = await storedInitiative(base)
    expect(stored.rounds).toHaveLength(1)
    expect(stored.participants).toHaveLength(2)
    // Replaying START, a continuation and the terminal answered from held history without a
    // second round, order or occurrence. The receipt and command rows live only in the room (D85).
    expect(stored.occurrences).toHaveLength(1)
    // Command rows and rule receipts stay in the room for the Run (D85, D88); Convex holds one
    // replay-index row per room command. The checkpointed rows prove the room committed each
    // command once, under the caller's identity and input fingerprint, at the resulting version,
    // even though START and each continuation were sent again.
    await checkpointLiveRoom(base.campaign.id)
    const replayIndex = await base.t.run((ctx) =>
      ctx.db
        .query('encounterReplayIndex')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
    const sent = [
      { input: start, result: pending },
      { input: first, result: continued },
      { input: terminal, result: settled }
    ]
    for (const { input, result } of sent)
      expect(replayIndex.filter(({ commandId }) => commandId === input.command.commandId)).toEqual([
        expect.objectContaining({
          encounterId: base.run.id,
          actorUserId: base.owner.userId,
          commandFingerprint: checksumCanonicalJson({ command: input.command, scope: 'ENCOUNTER' }),
          version: result.projection.version
        })
      ])
  }, 30000)

  it('settles a tied score by the tie-break roll-off without asking the GM', async () => {
    const base = await setup()
    // Faces 10 and 10 tie the scores; the tie-break faces 6 and 7 then separate them.
    await queueRoomRolls(base.campaign.id, { rolls: [9, 9, 5, 6] })
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    for (let declared = 0; declared < 2; declared += 1) {
      if (result.occurrence?.pending?.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected a declaration.')
      result = await executeInRoom(
        base.owner.caller,
        declarationCommand({ encounterId: base.run.id, pending: result.occurrence.pending })
      )
    }
    expect(result).toMatchObject({
      projection: { status: 'ACTIVE', round: 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
  }, 30000)

  it('asks the GM for the order when the automatic scores and the tie-break rolls both tie', async () => {
    const base = await setup()
    // Faces 10 and 10 tie the scores, and the tie-break faces 6 and 6 tie again.
    await queueRoomRolls(base.campaign.id, { rolls: [9, 9, 5, 5] })
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    for (let declared = 0; declared < 2; declared += 1) {
      if (result.occurrence?.pending?.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected a declaration.')
      result = await executeInRoom(
        base.owner.caller,
        declarationCommand({ encounterId: base.run.id, pending: result.occurrence.pending })
      )
    }
    const order = result.occurrence?.pending
    if (order?.kind !== 'INITIATIVE_ORDER') throw new Error('Expected the GM order decision.')
    expect(result).toMatchObject({
      projection: { status: 'PREPARED', round: 0 },
      occurrence: { status: 'PENDING' }
    })
    const settled = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: order.encounterVersion,
        occurrenceId: order.occurrenceId,
        expectedOccurrenceVersion: order.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: order.requestId,
          entityId: order.optionIds[0]!
        }
      }
    })
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', round: 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    expect((await storedInitiative(base)).rounds).toHaveLength(1)
  }, 30000)

  it('settles Assisted declarations through score evidence and GM order', async () => {
    const base = await setup({ rolls: 'PROMPT' })
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    for (let steps = 0; result.occurrence?.status === 'PENDING'; steps += 1) {
      expect(steps).toBeLessThan(12)
      const pending = result.occurrence.pending
      if (!pending) throw new Error('Missing Assisted initiative request.')
      const resolution =
        pending.kind === 'INITIATIVE_DECLARATION'
          ? declarationCommand({ encounterId: base.run.id, pending }).command.resolution
          : pending.kind === 'INITIATIVE_EVIDENCE'
            ? { kind: 'ENTER_INTEGER' as const, requestId: pending.request.requestId, value: 12 }
            : pending.kind === 'INITIATIVE_ORDER'
              ? {
                  kind: 'INITIATIVE_ENTITY' as const,
                  requestId: pending.requestId,
                  entityId: pending.optionIds[0]!
                }
              : null
      if (!resolution) throw new Error('Unexpected Assisted initiative request.')
      result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          correlationId: null,
          resolution
        }
      })
    }
    expect(result).toMatchObject({
      projection: { status: 'ACTIVE', round: 1 },
      occurrence: { status: 'COMPLETE' }
    })
    expect((await storedInitiative(base)).rounds).toHaveLength(1)
  }, 30000)

  it('reissues declarations when EACH_ROUND wraps', async () => {
    const base = await setup({ cadence: 'EACH_ROUND' })
    await queueRoomRolls(base.campaign.id, { rolls: [4, 9] })
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    for (let index = 0; index < 2; index += 1) {
      if (
        !result.occurrence?.pending ||
        result.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
      )
        throw new Error('Expected declaration.')
      result = await executeInRoom(
        base.owner.caller,
        declarationCommand({ encounterId: base.run.id, pending: result.occurrence.pending })
      )
    }
    expect(result.projection).toMatchObject({ status: 'ACTIVE', round: 1 })
    const next = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: result.projection.version
      }
    })
    const turn = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: next.projection.version
      }
    })
    expect(turn.occurrence?.pending?.kind).toBe('INITIATIVE_DECLARATION')
    expect((await storedInitiative(base)).rounds).toHaveLength(1)
    if (!turn.occurrence?.pending || turn.occurrence.pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected second-round declaration.')
    // The room holds the Run: release it so the direct write is what it hydrates next.
    await closeRoom(base.campaign.id)
    const beforeRound = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', base.run.id).eq('round', 1))
        .unique()
      if (!row) throw new Error('Expected current initiative round.')
      await ctx.db.patch(row._id, { version: row.version + 1 })
      return row
    })
    const changedRound = await storedInitiative(base)
    await expectRoomCause(
      executeInRoom(
        base.owner.caller,
        declarationCommand({ encounterId: base.run.id, pending: turn.occurrence.pending })
      ),
      /Initiative outgoing advancement is stale/
    )
    expect(await storedInitiative(base)).toEqual(changedRound)
    await closeRoom(base.campaign.id)
    await base.t.run((ctx) => ctx.db.patch(beforeRound._id, { version: beforeRound.version }))
    // Closing the room dropped its queued dice; the second round draws its own.
    await queueRoomRolls(base.campaign.id, { rolls: [4, 9] })
    const nextRoundFirst = await executeInRoom(
      base.owner.caller,
      declarationCommand({ encounterId: base.run.id, pending: turn.occurrence.pending })
    )
    if (
      !nextRoundFirst.occurrence?.pending ||
      nextRoundFirst.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
    )
      throw new Error('Expected second second-round declaration.')
    const secondRound = await executeInRoom(
      base.owner.caller,
      declarationCommand({ encounterId: base.run.id, pending: nextRoundFirst.occurrence.pending })
    )
    expect(secondRound.projection).toMatchObject({ status: 'ACTIVE', round: 2 })
    expect((await storedInitiative(base)).rounds).toHaveLength(2)
  }, 30000)

  it('refuses a declaration whose staged Run binding was tampered with', async () => {
    const base = await setup()
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const occurrence = await ctx.db.query('encounterRuleOccurrences').unique()
      if (!occurrence) throw new Error('Expected declaration occurrence.')
      const snapshot = await readPendingSnapshot(
        { db: createConvexEncounterStoreReader(ctx) },
        occurrence
      )
      if (
        snapshot?.snapshotKind !== 'AGGREGATE_CHOICE' ||
        snapshot.applicationContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION'
      )
        throw new Error('Expected declaration context.')
      const root = snapshot.applicationContext.root
      const stagedInitiativeRoundState = {
        ...root.stagedInitiativeRoundState,
        round: { ...root.stagedInitiativeRoundState.round, encounterId: crypto.randomUUID() }
      }
      const tampered = {
        ...snapshot,
        applicationContext: {
          ...snapshot.applicationContext,
          root: { ...root, stagedInitiativeRoundState }
        }
      }
      await ctx.db.patch(occurrence._id, {
        pendingSnapshotChecksum: await writePendingSnapshot(
          { db: createConvexEncounterStore(ctx) },
          occurrence,
          tampered
        )
      })
    })
    await expect(
      base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).rejects.toThrow()
  }, 30000)

  it('refuses a changed actor cohort before accepting another declaration', async () => {
    const base = await setup()
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const pending = result.occurrence?.pending
    if (pending?.kind !== 'INITIATIVE_DECLARATION') throw new Error('Expected declaration.')
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const occurrence = await ctx.db.query('encounterRuleOccurrences').unique()
      if (!occurrence) throw new Error('Expected declaration occurrence.')
      const snapshot = await readPendingSnapshot(
        { db: createConvexEncounterStoreReader(ctx) },
        occurrence
      )
      if (snapshot?.applicationContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION')
        throw new Error('Expected declaration context.')
      const root = snapshot.applicationContext.root
      const tampered = serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...snapshot,
        applicationContext: {
          ...snapshot.applicationContext,
          root: {
            ...root,
            initiativeBeforePin: {
              ...root.initiativeBeforePin,
              actorIds: [crypto.randomUUID(), ...root.initiativeBeforePin.actorIds.slice(1)].sort()
            }
          }
        }
      })
      await ctx.db.patch(occurrence._id, {
        pendingSnapshotChecksum: await writePendingSnapshot(
          { db: createConvexEncounterStore(ctx) },
          occurrence,
          tampered
        )
      })
    })
    const before = await storedInitiative(base)
    await expectRoomCause(
      executeInRoom(base.owner.caller, declarationCommand({ encounterId: base.run.id, pending })),
      /Initiative response state is unavailable/
    )
    expect(await storedInitiative(base)).toEqual(before)
  }, 30000)

  it('refuses a declaration from a controller who lost the Character assignment', async () => {
    const { base, run, characterActor, started } = await startCharacterDeclarationRun()
    let result = started
    for (let step = 0; step < 2; step += 1) {
      await checkpointLiveRoom(base.campaign.id)
      const pending = result.occurrence?.pending
      if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected declaration.')
      const response = declarationCommand({ encounterId: run.id, pending })
      if (pending.actorId === characterActor.id) {
        await closeRoom(base.campaign.id)
        await base.t.run(async (ctx) => {
          const assignment = await ctx.db
            .query('campaignCharacterAssignments')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
            )
            .unique()
          if (!assignment) throw new Error('Expected current Character assignment.')
          await ctx.db.delete(assignment._id)
        })
        await expect(executeInRoom(base.player.caller, response)).rejects.toThrow(
          /NOT_ACTOR_CONTROLLER/
        )
        return
      }
      result = await executeInRoom(base.owner.caller, response)
    }
    throw new Error('Expected a declaration addressed to the Character.')
  }, 30000)

  it('shows a Character declaration only to its current controller and the GM', async () => {
    const { base, run, characterActor, started } = await startCharacterDeclarationRun()
    let result = started
    for (let step = 0; step < 2; step += 1) {
      await checkpointLiveRoom(base.campaign.id)
      const pending = result.occurrence?.pending
      if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected declaration.')
      if (pending.actorId === characterActor.id) {
        expect(
          await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).toMatchObject({ kind: 'INITIATIVE_DECLARATION', actorId: characterActor.id })
        // D87: a decision addressed to the player opens the pre-start Run to them.
        expect(
          await base.player.caller.query(api.encounters.projectionReads.get, {
            encounterId: run.id
          })
        ).toMatchObject({ id: run.id, status: 'PREPARED' })
        expect(
          await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).toHaveLength(1)
        const response = declarationCommand({ encounterId: run.id, pending })
        await closeRoom(base.campaign.id)
        await base.t.run(async (ctx) => {
          const membership = await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
            )
            .unique()
          if (!membership) throw new Error('Expected Character controller membership.')
          await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
        })
        await expect(
          base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).rejects.toThrow()
        await expect(
          base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).rejects.toThrow()
        await expect(executeInRoom(base.player.caller, response)).rejects.toThrow(
          'Campaign not found.'
        )
        await closeRoom(base.campaign.id)
        await base.t.run(async (ctx) => {
          const membership = await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
            )
            .unique()
          if (!membership) throw new Error('Expected Character controller membership.')
          await ctx.db.patch(membership._id, { status: 'ACTIVE', leftAt: null })
        })
        const stale = {
          command: {
            ...response.command,
            commandId: crypto.randomUUID(),
            expectedOccurrenceVersion: pending.occurrenceVersion + 1
          }
        }
        await checkpointLiveRoom(base.campaign.id)
        const beforeStale = await base.t.run((ctx) =>
          ctx.db.query('encounterRuleOccurrences').collect()
        )
        await expect(executeInRoom(base.player.caller, stale)).rejects.toThrow(/VERSION_STALE/)
        await checkpointLiveRoom(base.campaign.id)
        expect(
          await base.t.run((ctx) => ctx.db.query('encounterRuleOccurrences').collect())
        ).toEqual(beforeStale)
        // closeRoom dropped the queue. The Character adds +4 to its face, so random faces 4 apart
        // would tie and leave the Run PREPARED. Faces 10 apart cannot tie, whichever declares first.
        await queueRoomRolls(base.campaign.id, { rolls: [2, 12] })
        result = await executeInRoom(base.player.caller, response)
        expect(encounterPlayerProjectionDtoSchema.safeParse(result.projection).success).toBe(true)
        expect(result.occurrence?.pending).toBeNull()
        await expect(executeInRoom(base.player.caller, response)).resolves.toEqual(result)
        result = encounterCommandResultDtoSchema.parse({
          ...result,
          occurrence: result.occurrence && {
            ...result.occurrence,
            pending: await readPending(base, base.owner.caller, run.id)
          }
        })
      } else {
        // D87: a pre-start decision addressed to someone else leaves the Run unavailable to them.
        await expect(
          base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).rejects.toThrow('Encounter is unavailable.')
        await expect(
          base.player.caller.query(api.encounters.projectionReads.get, { encounterId: run.id })
        ).rejects.toThrow('Encounter is unavailable.')
        expect(await readRoomTimeline(base.player.caller, base.campaign.id)).toEqual([])
        expect(
          await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).toEqual([])
        await expect(
          executeInRoom(base.player.caller, declarationCommand({ encounterId: run.id, pending }))
        ).rejects.toThrow(/NOT_ACTOR_CONTROLLER/)
        result = await executeInRoom(
          base.owner.caller,
          declarationCommand({ encounterId: run.id, pending })
        )
      }
    }
    expect(result.projection.status).toBe('ACTIVE')
    await checkpointLiveRoom(base.campaign.id)
    expect(
      await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      })
    ).toBeNull()
    expect(
      await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
        campaignId: base.campaign.id
      })
    ).toEqual([])
    const declared = (await storedInitiative(base)).participants.find(
      (participant) => participant.actorId === characterActor.id
    )?.declaration?.primary
    if (declared?.kind !== 'CHARACTER_ACTION' || declared.equipmentInstanceId === null)
      throw new Error('Expected a declared Character equipment action.')
    const sheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    expect(
      sheet?.inventory.items.find((item) => item.id === declared.equipmentInstanceId)?.equippedSlot
    ).toBeNull()
  }, 30000)

  it.each(['PLAYER', 'OWNER'] as const)(
    'commits private declarations with %s responding first',
    async (firstRole) => {
      vi.stubEnv('BETTER_AUTH_SECRET', 'private-declaration-continuation-secret-at-least-32-bytes')
      const base = await setupCharacterRun()
      await equipAllCharacterItems(base)
      const initiative = createEncounterInitiativeDefinitions([
        { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
      ])
      await base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions: initiative.definitions
      })
      const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
      const { version, updatedAt: _updatedAt, ...fields } = settings
      await base.owner.caller.mutation(saveSettings, {
        ...fields,
        expectedVersion: version,
        automationMode: 'ASSISTED',
        initiativePolicyDefinitionId: initiative.policyIds[0]!,
        initiativeTieDefinitionId: null
      })
      const blueprint = await base.owner.caller.mutation(createBlueprint, {
        gameSystemId: base.campaign.gameSystemId,
        name: 'Private declaration controllers',
        commandId: crypto.randomUUID(),
        enemies: [{ kind: 'CUSTOM', label: 'First', maxHitPoints: 3 }]
      })
      const characterActorId =
        firstRole === 'PLAYER'
          ? '00000000-0000-4000-8000-000000000011'
          : 'ffffffff-ffff-4fff-8fff-fffffffffff1'
      const customActorId =
        firstRole === 'PLAYER'
          ? 'ffffffff-ffff-4fff-8fff-fffffffffff2'
          : '00000000-0000-4000-8000-000000000012'
      const createRunCommandId = crypto.randomUUID()
      const randomUUID = crypto.randomUUID.bind(crypto)
      let createdUuidCount = 0
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        createdUuidCount += 1
        if (createdUuidCount === 4) return characterActorId
        if (createdUuidCount === 6) return customActorId
        return randomUUID()
      })
      const run = await base.owner.caller
        .mutation(createRun, {
          campaignId: base.campaign.id,
          blueprintId: blueprint.id,
          commandId: createRunCommandId
        })
        .finally(() => uuidSpy.mockRestore())
      await attachFixtureRoom(base.t, base.campaign.id)
      const characterActor = run.actors.find((actor) => actor.kind === 'CHARACTER')
      if (!characterActor) throw new Error('Expected assigned Character actor.')
      expect(characterActor.id).toBe(characterActorId)
      expect(run.actors.find((actor) => actor.kind === 'CUSTOM')?.id).toBe(customActorId)
      // Faces 3 and 13 stay apart whatever the Character's modifier.
      await queueRoomRolls(base.campaign.id, { rolls: [2, 12] })
      const start = {
        type: 'START' as const,
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
      let current = await executeInRoom(base.owner.caller, { command: start })
      if (current.occurrence?.pending?.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected the first native declaration request.')
      expect(current.occurrence.pending.actorId === characterActor.id).toBe(firstRole === 'PLAYER')
      let pendingCommits = 0
      let playerDeclarations = 0
      let ownerDeclarations = 0
      let finalResponderUserId: string | null = null
      for (let step = 0; step < 4; step += 1) {
        await checkpointLiveRoom(base.campaign.id)
        // A player's result hides the GM's declaration, so the GM reads it for the next step.
        const pending =
          current.occurrence?.pending ??
          (await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          }))
        if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
          throw new Error('Expected an issued declaration.')
        const role = pending.actorId === characterActor.id ? 'PLAYER' : 'OWNER'
        const caller = role === 'PLAYER' ? base.player.caller : base.owner.caller
        const visible = base.player.caller.query(
          api.encounters.pendingReads.pendingRuleOccurrence,
          { encounterId: run.id }
        )
        if (role === 'PLAYER') expect((await visible)?.kind).toBe('INITIATIVE_DECLARATION')
        else await expect(visible).rejects.toThrow('Encounter is unavailable.')
        expect(
          await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).toHaveLength(role === 'PLAYER' ? 1 : 0)
        const { command } = declarationCommand({ encounterId: run.id, pending })
        if (command.resolution.kind !== 'INITIATIVE_DECLARATION')
          throw new Error('Expected a declaration response command.')
        const before = await storedInitiative(base)
        const answer = (member: typeof base.player) => executeInRoom(member.caller, { command })
        if (role === 'PLAYER') {
          await expect(
            executeInRoom(base.player.caller, {
              command: { ...start, commandId: crypto.randomUUID() }
            })
          ).rejects.toThrow(/GM_ONLY/)
          await closeRoom(base.campaign.id)
          const membership = await base.t.run((ctx) =>
            ctx.db
              .query('campaignMemberships')
              .withIndex('by_campaignId_userId', (q) =>
                q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
              )
              .unique()
          )
          if (!membership) throw new Error('Expected Character controller membership.')
          await base.t.run((ctx) =>
            ctx.db.patch(membership._id, {
              status: 'LEFT',
              leftAt: new Date().toISOString()
            })
          )
          await expect(answer(base.player)).rejects.toThrow('Campaign not found.')
          await closeRoom(base.campaign.id)
          await base.t.run((ctx) =>
            ctx.db.patch(membership._id, {
              status: 'ACTIVE',
              leftAt: null
            })
          )
          // closeRoom dropped the queue; the faces stay 10 apart again for the settling declaration.
          await queueRoomRolls(base.campaign.id, { rolls: [2, 12] })
          expect(await storedInitiative(base)).toEqual(before)
        } else {
          await expect(answer(base.player)).rejects.toThrow(/NOT_ACTOR_CONTROLLER/)
        }
        await expect(
          executeInRoom(caller, {
            command: {
              ...command,
              expectedOccurrenceVersion: command.expectedOccurrenceVersion + 1
            }
          })
        ).rejects.toThrow(/VERSION_STALE/)
        await expectRoomCause(
          executeInRoom(caller, {
            command: {
              ...command,
              resolution: { ...command.resolution, requestId: crypto.randomUUID() }
            }
          }),
          // A player's unknown request cannot name a controlled actor, so it is indistinguishable
          // from an unavailable Campaign (turnResponseAuthority.ts:75-76); the GM sees the cause.
          role === 'PLAYER' ? /Campaign not found/ : /Initiative declaration is unavailable/
        )
        expect(await storedInitiative(base)).toEqual(before)
        current = await answer(role === 'PLAYER' ? base.player : base.owner)
        expect(await executeInRoom(caller, { command })).toEqual(current)
        if (role === 'PLAYER') playerDeclarations += 1
        else ownerDeclarations += 1
        if (current.projection.status !== 'ACTIVE') {
          if (role === 'PLAYER') {
            expect(current.occurrence?.pending).toBeNull()
            expect(JSON.stringify(current.projection)).not.toContain('healthBand')
          }
          const retained = (await storedInitiative(base)).occurrences.find(
            (entry) => entry.encounterId === run.id
          )
          if (!retained) throw new Error('Expected retained private declaration response.')
          const retainedSnapshot = await base.t.run((ctx) =>
            readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, retained)
          )
          if (retainedSnapshot?.applicationContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION')
            throw new Error('Expected retained initiative declaration root.')
          expect(retainedSnapshot.applicationContext.root.resolutionCommands.at(-1)).toMatchObject({
            kind: 'INITIATIVE_DECLARATION',
            actorUserId: role === 'PLAYER' ? base.player.userId : base.owner.userId,
            initiativeActorId: pending.actorId
          })
          pendingCommits += 1
          continue
        }
        finalResponderUserId = role === 'PLAYER' ? base.player.userId : base.owner.userId
        break
      }
      expect(ownerDeclarations).toBe(1)
      expect(playerDeclarations).toBe(1)
      expect(pendingCommits).toBe(1)
      expect(current.projection).toMatchObject({ status: 'ACTIVE', round: 1 })
      expect(current.occurrence?.pending).toBeNull()
      const settled = await storedInitiative(base)
      expect(settled.rounds.filter((entry) => entry.encounterId === run.id)).toHaveLength(1)
      expect(settled.occurrences.filter((entry) => entry.encounterId === run.id)).toHaveLength(1)
      expect(finalResponderUserId).toBe(
        firstRole === 'PLAYER' ? base.owner.userId : base.player.userId
      )
      expect(
        await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: run.id
        })
      ).toBeNull()
    },
    120_000
  )

  it('settles declarations from two assigned Character controllers through the player action entrypoint', async () => {
    const base = await setupCharacterRun()
    const secondUser = await base.t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Second declaration player',
            // Registered accounts always have a username; the Character's Initiative card is authored by its controller.
            username: 'seconddeclarationplayer',
            email: 'second-declaration-player@example.invalid',
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const secondSession = await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: secondUser._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const secondPlayer = base.t.withIdentity({
      subject: secondUser._id,
      sessionId: secondSession._id
    })
    const secondIdentity = await secondPlayer.query(api.account.identity, {})
    if (!secondIdentity) throw new Error('Expected second Character controller identity.')
    // The Run party follows membership join order, so the earlier-joined second Character is
    // snapshotted first and declares last.
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: secondIdentity.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: new Date(Date.parse(base.campaign.createdAt) - 1).toISOString(),
        leftAt: null
      })
    )
    const secondDraft = await secondPlayer.mutation(api.characters.drafts.create, {
      id: '00000000-0000-4000-8000-000000000100',
      systemId: base.character.systemId
    })
    const secondCharacter = characterAuthoredDtoSchema.parse({
      ...base.character,
      id: secondDraft.payload.character.id,
      userId: secondIdentity.userId,
      label: 'Second declaration Character',
      status: 'DRAFT'
    })
    await secondPlayer.mutation(api.characters.commit.commit, {
      expectedDraftId: secondDraft.id,
      mode: 'create',
      character: secondCharacter
    })
    await secondPlayer.mutation(api.campaigns.assignments.assign, {
      campaignId: base.campaign.id,
      characterId: secondCharacter.id
    })

    const playerSheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!playerSheet) throw new Error('Expected first Character Sheet.')
    let playerVersion = playerSheet.meta.streamVersion
    for (const item of playerSheet.inventory.items) {
      await base.player.caller.mutation(api.characters.sheetCommands.execute, {
        id: base.character.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: playerVersion,
          itemId: item.id
        }
      })
      playerVersion += 1
    }
    const secondSheet = await secondPlayer.query(api.characters.sheet.get, {
      id: secondCharacter.id
    })
    if (!secondSheet) throw new Error('Expected second Character Sheet.')
    let secondVersion = secondSheet.meta.streamVersion
    for (const item of secondSheet.inventory.items) {
      await secondPlayer.mutation(api.characters.sheetCommands.execute, {
        id: secondCharacter.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: secondVersion,
          itemId: item.id
        }
      })
      secondVersion += 1
    }

    const initiative = createEncounterInitiativeDefinitions([
      { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
    ])
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: initiative.definitions
    })
    const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await base.owner.caller.mutation(saveSettings, {
      ...fields,
      expectedVersion: version,
      automationMode: 'ASSISTED',
      initiativePolicyDefinitionId: initiative.policyIds[0]!,
      initiativeTieDefinitionId: null
    })
    const blueprint = await base.owner.caller.mutation(createBlueprint, {
      gameSystemId: base.campaign.gameSystemId,
      name: 'Two controller declarations',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Required opponent', maxHitPoints: 3 }]
    })
    const randomUuid = vi.spyOn(crypto, 'randomUUID')
    let uuidValue = 0xffffffff
    randomUuid.mockImplementation(() => {
      const prefix = (uuidValue--).toString(16).padStart(8, '0')
      return `${prefix}-0000-4000-8000-000000000000`
    })
    let run: EncounterGmProjectionDto
    try {
      run = await base.owner.caller.mutation(createRun, {
        campaignId: base.campaign.id,
        blueprintId: blueprint.id,
        commandId: crypto.randomUUID()
      })
    } finally {
      randomUuid.mockRestore()
    }
    await attachFixtureRoom(base.t, base.campaign.id)
    expect(
      [...run.actors]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((actor) => actor.sourceId)
    ).toEqual([null, base.character.id, secondCharacter.id])

    // Faces 3, 10 and 17 stay apart whatever the Characters' modifiers.
    await queueRoomRolls(base.campaign.id, { rolls: [2, 9, 16] })
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
    })
    let pending = await readPending(base, base.owner.caller, run.id)
    for (let response = 0; response < 2; response += 1) {
      if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected a pending declaration before terminal resolution.')
      const pendingActorId = pending.actorId
      const actor = run.actors.find((candidate) => candidate.id === pendingActorId)
      if (!actor) throw new Error('Expected pending Encounter actor.')
      const command = declarationCommand({ encounterId: run.id, pending })
      if (actor.sourceId === base.character.id) {
        await expect(
          secondPlayer.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).rejects.toThrow('Encounter is unavailable.')
        await executeInRoom(base.player.caller, command)
      } else if (actor.sourceId === secondCharacter.id) {
        await expect(
          base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).rejects.toThrow('Encounter is unavailable.')
        await executeInRoom(secondPlayer, command)
      } else {
        await executeInRoom(base.owner.caller, command)
      }
      pending = await readPending(base, base.owner.caller, run.id)
    }
    const finalPending = pending
    if (!finalPending || finalPending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected final Character declaration.')
    const finalActor = run.actors.find((actor) => actor.id === finalPending.actorId)
    if (finalActor?.sourceId !== secondCharacter.id)
      throw new Error('Expected final declaration from the second Character controller.')
    await expect(
      base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      })
    ).rejects.toThrow('Encounter is unavailable.')
    const terminal = declarationCommand({ encounterId: run.id, pending: finalPending })
    const settled = await executeInRoom(secondPlayer, terminal)
    expect(settled.projection.status).toBe('ACTIVE')
    expect(encounterPlayerProjectionDtoSchema.safeParse(settled.projection).success).toBe(true)
    expect(settled.projection.actors.every((actor) => !('currentHitPoints' in actor))).toBe(true)
    const beforeReplay = await storedInitiative(base)
    await expect(executeInRoom(secondPlayer, terminal)).resolves.toEqual(settled)
    expect(await storedInitiative(base)).toEqual(beforeReplay)

    const currentSheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!currentSheet) throw new Error('Expected first Character Sheet after settlement.')
    await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'CREATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: currentSheet.meta.streamVersion,
        title: 'Turn note',
        body: 'Advance after a sheet change',
        groupId: 'session-notes'
      }
    })
    const advanced = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: settled.projection.version
      }
    })
    expect(advanced.projection).toMatchObject({
      status: 'ACTIVE',
      round: 1,
      version: settled.projection.version + 1
    })
    expect(advanced.projection.currentActorId).not.toBe(settled.projection.currentActorId)
    const afterAdvance = await storedInitiative(base)
    expect(afterAdvance.rounds).toEqual(beforeReplay.rounds)
    expect(
      afterAdvance.participants.map(({ actorId, initiativeScore, turnOrderOrdinal }) => ({
        actorId,
        initiativeScore,
        turnOrderOrdinal
      }))
    ).toEqual(
      beforeReplay.participants.map(({ actorId, initiativeScore, turnOrderOrdinal }) => ({
        actorId,
        initiativeScore,
        turnOrderOrdinal
      }))
    )
  }, 30000)

  it('declares a published Creature feature without spending its charge', async () => {
    const base = await setup()
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          ...automaticChargedCreature,
          subjectKind: 'CREATURE',
          document: automaticChargedCreature
        })
      ]
    })
    const blueprint = await base.owner.caller.mutation(createBlueprint, {
      gameSystemId: base.campaign.gameSystemId,
      name: 'Creature declaration',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CREATURE', sourceId: automaticChargedCreatureId }]
    })
    const run = await base.owner.caller.mutation(createRun, {
      campaignId: base.campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    await attachFixtureRoom(base.t, base.campaign.id)
    const actor = run.actors.find((value) => value.kind === 'CREATURE')
    if (!actor) throw new Error('Expected Creature actor.')
    const before = await base.t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
    )
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
    })
    const pending = result.occurrence?.pending
    if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected Creature declaration.')
    const option = pending.primaryOptions.find(
      (value) => value.kind === 'CREATURE_FEATURE_ACTION' && value.label === 'Bite'
    )
    if (!option) throw new Error('Expected charged Creature feature declaration option.')
    const response = declarationCommand({
      encounterId: run.id,
      pending: { ...pending, primaryOptions: [option] }
    })
    result = await executeInRoom(base.owner.caller, response)
    expect(result.projection.status).toBe('ACTIVE')
    const readDeclared = async () => {
      await checkpointLiveRoom(base.campaign.id)
      return base.t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        actor: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
          .unique(),
        participant: await ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) =>
            q.eq('encounterId', run.id).eq('round', 1).eq('actorId', actor.id)
          )
          .unique(),
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', run.id))
          .unique(),
        rounds: await ctx.db
          .query('encounterInitiativeRounds')
          .withIndex('by_encounterId_round', (q) => q.eq('encounterId', run.id).eq('round', 1))
          .collect()
      }))
    }
    const after = await readDeclared()
    await expect(executeInRoom(base.owner.caller, response)).resolves.toEqual(result)
    expect(await readDeclared()).toEqual(after)
    expect(after.actor).toEqual(before)
    // The one receipt this Run wrote lives only in the room (D85); one round and one
    // declaration row show the declaration settled once.
    expect(after.rounds).toHaveLength(1)
    expect(after.participant?.declaration).toMatchObject({
      primary: {
        kind: 'CREATURE_FEATURE_ACTION',
        creatureSourceId: automaticChargedCreatureId,
        sourceRevision: actor.sourceRevision,
        sourceChecksum: checksumRuleDocument(automaticChargedCreature),
        ownerFeatureId: automaticChargedBiteFeatureId,
        effectId: automaticChargedBiteEffectId
      }
    })
  }, 30000)
})

/**
 * ENCOUNTER-9.1: every initiative die a declaration settles posts the Initiative card a GM-rolled
 * initiative posts, with the same visibility.
 */
describe('declared initiative roll cards', () => {
  /** Answers every pending step of the Run's initiative until it opens, as each member would. */
  async function settleInitiative(
    base: { campaign: { id: string }; owner: Awaited<ReturnType<typeof fixture>>['owner'] },
    runId: string,
    callerFor: (actorId: string) => RoomCaller,
    enterDice: readonly number[] | null
  ) {
    const entered = [...(enterDice ?? [])]
    for (let steps = 0; steps < 12; steps += 1) {
      const pending = await readPending(base, base.owner.caller, runId)
      if (!pending) return
      const resolve = (
        caller: RoomCaller,
        resolution: ResolveRuleOccurrenceInputDto['resolution']
      ) =>
        executeInRoom(caller, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: runId,
            commandId: crypto.randomUUID(),
            expectedVersion: pending.encounterVersion,
            occurrenceId: pending.occurrenceId,
            expectedOccurrenceVersion: pending.occurrenceVersion,
            correlationId: null,
            resolution
          }
        })
      if (pending.kind === 'INITIATIVE_DECLARATION')
        await executeInRoom(
          callerFor(pending.actorId),
          declarationCommand({ encounterId: runId, pending })
        )
      else if (pending.kind === 'INITIATIVE_EVIDENCE')
        await resolve(base.owner.caller, {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: entered.shift() ?? 10
        })
      else if (pending.kind === 'INITIATIVE_ORDER')
        await resolve(base.owner.caller, {
          kind: 'INITIATIVE_ENTITY',
          requestId: pending.requestId,
          entityId: pending.optionIds[0]!
        })
      else throw new Error('Unexpected initiative step.')
    }
    throw new Error('Initiative did not settle.')
  }

  const initiativeCards = (cards: readonly RollRecordDto[]) =>
    cards.filter((card) => card.source.kind === 'INITIATIVE')

  async function storedScores(base: Parameters<typeof storedInitiative>[0]) {
    const { participants } = await storedInitiative(base)
    return new Map(
      participants.map((row) => {
        if (row.initiativeScore === null) throw new Error('Expected a settled initiative score.')
        return [row.actorId, row.initiativeScore]
      })
    )
  }

  it('posts one Initiative card for each auto-rolled declaration, with its die and total', async () => {
    const base = await setup()
    await queueRoomRolls(base.campaign.id, { rolls: [4, 9] })
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    await settleInitiative(base, base.run.id, () => base.owner.caller, null)
    const scores = await storedScores(base)
    const cards = initiativeCards(await readRoomRollCards(base.owner.caller, base.campaign.id))
    expect(cards).toHaveLength(2)
    // Declaration order: the 1st actor rolled face 5, the 2nd face 10, each plus the same modifier.
    const labelOf = (actorId: string) =>
      base.run.actors.find((actor) => actor.id === actorId)!.label
    const declared = [...scores].map(([actorId, score]) => ({ actorId, score }))
    for (const { actorId, score } of declared) {
      const card = cards.find((candidate) => candidate.characterLabel === labelOf(actorId))
      expect(card).toMatchObject({
        characterId: null,
        source: { kind: 'INITIATIVE', label: 'Initiative' },
        evidence: { total: score, terms: [{ rolls: [expect.any(Number)] }] }
      })
    }
    expect(cards.map((card) => card.evidence.terms[0]!.rolls[0]).sort((a, b) => a! - b!)).toEqual([
      5, 10
    ])
  }, 30000)

  it('posts one Initiative card with the value the GM entered for an Assisted declaration', async () => {
    const base = await setup({ rolls: 'PROMPT' })
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    await settleInitiative(base, base.run.id, () => base.owner.caller, [12, 7])
    const scores = await storedScores(base)
    const cards = initiativeCards(await readRoomRollCards(base.owner.caller, base.campaign.id))
    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.evidence.terms[0]!.rolls[0]).sort((a, b) => a! - b!)).toEqual([
      7, 12
    ])
    expect(cards.map((card) => card.evidence.total).sort((a, b) => a - b)).toEqual(
      [...scores.values()].sort((a, b) => a - b)
    )
  }, 30000)

  it('replays a retried declaration to the same card instead of posting another', async () => {
    const base = await setup()
    await queueRoomRolls(base.campaign.id, { rolls: [4, 9] })
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    await executeInRoom(base.owner.caller, start)
    const terminalPending = async () => {
      const pending = await readPending(base, base.owner.caller, base.run.id)
      if (pending?.kind !== 'INITIATIVE_DECLARATION') throw new Error('Expected a declaration.')
      return pending
    }
    await executeInRoom(
      base.owner.caller,
      declarationCommand({ encounterId: base.run.id, pending: await terminalPending() })
    )
    const terminal = declarationCommand({
      encounterId: base.run.id,
      pending: await terminalPending()
    })
    const settled = await executeInRoom(base.owner.caller, terminal)
    const before = initiativeCards(await readRoomRollCards(base.owner.caller, base.campaign.id))
    expect(before).toHaveLength(2)
    await expect(executeInRoom(base.owner.caller, terminal)).resolves.toEqual(settled)
    await executeInRoom(base.owner.caller, start)
    expect(initiativeCards(await readRoomRollCards(base.owner.caller, base.campaign.id))).toEqual(
      before
    )
  }, 30000)

  it('keeps a hidden Creature’s card private to the GM and gives a player Character’s card to the table', async () => {
    const { base, run, characterActor, enemyActor } = await startCharacterDeclarationRun({
      hideEnemy: true
    })
    await queueRoomRolls(base.campaign.id, { rolls: [4, 9] })
    await settleInitiative(
      base,
      run.id,
      (actorId) => (actorId === characterActor.id ? base.player.caller : base.owner.caller),
      null
    )
    const scores = await storedScores(base)
    // Only the player's card reached the table, so the GM opens the table chat as their client does.
    await base.owner.caller.mutation(api.campaigns.conversations.open, {
      campaignId: base.campaign.id,
      kind: 'TABLE'
    })
    const tableCards = initiativeCards(await readRoomRollCards(base.owner.caller, base.campaign.id))
    // The Character's card is the table's, and the player loads the same one.
    expect(tableCards).toEqual([
      expect.objectContaining({
        characterId: base.character.id,
        characterLabel: characterActor.label,
        source: { kind: 'INITIATIVE', label: 'Initiative' },
        evidence: expect.objectContaining({ total: scores.get(characterActor.id) })
      })
    ])
    expect(initiativeCards(await readRoomRollCards(base.player.caller, base.campaign.id))).toEqual(
      tableCards
    )
    // The hidden Creature's card is the GM's alone: unrevealed in their private history.
    const retained = (await base.owner.caller.query(api.rolls.history, {})).filter(
      (record) => record.source.kind === 'INITIATIVE'
    )
    expect(retained).toEqual([
      expect.objectContaining({
        characterId: null,
        characterLabel: enemyActor.label,
        evidence: expect.objectContaining({ total: scores.get(enemyActor.id) }),
        gmCampaignRoll: expect.objectContaining({ revealedAt: null })
      })
    ])
    expect(
      (await base.player.caller.query(api.rolls.history, {})).filter(
        (record) => record.source.kind === 'INITIATIVE'
      )
    ).toEqual([])
  }, 30000)

  /** A Character whose Feral Instinct gives advantage on initiative, with one Custom enemy. */
  const feralInstinctCharacter = () => {
    const feralInstinct = barbarian.features?.find((feature) => feature.label === 'Feral Instinct')
    if (!feralInstinct) throw new Error('Missing SRD Feral Instinct.')
    return { features: [{ ...feralInstinct, availableAtLevel: 1, effects: [] }] }
  }

  /** The table's cards after the GM opens the table chat, as their client does. */
  async function tableInitiativeCards(
    base: Parameters<typeof storedInitiative>[0] & {
      owner: Awaited<ReturnType<typeof fixture>>['owner']
    }
  ) {
    await checkpointLiveRoom(base.campaign.id)
    await base.owner.caller.mutation(api.campaigns.conversations.open, {
      campaignId: base.campaign.id,
      kind: 'TABLE'
    })
    return initiativeCards(await readRoomRollCards(base.owner.caller, base.campaign.id))
  }

  it('rolls two d20s for a Character with advantage and posts one card with both faces and the mode', async () => {
    const { base, run, characterActor, enemyActor } = await startCharacterDeclarationRun({
      character: feralInstinctCharacter()
    })
    // The Character asks for two dice and the enemy for one, in either declaration order: the
    // faces 5, 15, 5 leave the Character's kept face 15 and the enemy's 5 whichever goes first.
    await queueRoomRolls(base.campaign.id, { rolls: [4, 14, 4] })
    await settleInitiative(
      base,
      run.id,
      (actorId) => (actorId === characterActor.id ? base.player.caller : base.owner.caller),
      null
    )
    const scores = await storedScores(base)
    const cards = await tableInitiativeCards(base)
    const characterCard = cards.find((card) => card.characterId === base.character.id)
    const enemyCard = cards.find((card) => card.characterLabel === enemyActor.label)
    expect(characterCard?.evidence).toMatchObject({
      mode: 'ADVANTAGE',
      total: scores.get(characterActor.id),
      terms: [{ count: 2, die: 20, subtotal: 15 }]
    })
    expect([...characterCard!.evidence.terms[0]!.rolls].sort((a, b) => a - b)).toEqual([5, 15])
    expect(
      characterCard!.evidence.terms[0]!.rolls[characterCard!.evidence.terms[0]!.keptRollIndex!]
    ).toBe(15)
    expect(enemyCard?.evidence).toMatchObject({
      keep: 'FIRST',
      total: scores.get(enemyActor.id),
      terms: [{ rolls: [5] }]
    })
    expect(cards).toHaveLength(2)
  }, 30000)

  it('asks a second time and posts one card with both faces when an advantage Character enters its dice', async () => {
    const { base, run, characterActor, enemyActor } = await startCharacterDeclarationRun({
      character: feralInstinctCharacter(),
      promptDice: true
    })
    // The Character is asked twice and the enemy once; 3, 18, 7 leave its kept face 18 either way.
    await settleInitiative(
      base,
      run.id,
      (actorId) => (actorId === characterActor.id ? base.player.caller : base.owner.caller),
      [3, 18, 7]
    )
    const scores = await storedScores(base)
    const cards = await tableInitiativeCards(base)
    const characterCard = cards.find((card) => card.characterId === base.character.id)
    expect(characterCard?.evidence).toMatchObject({
      mode: 'ADVANTAGE',
      total: scores.get(characterActor.id),
      terms: [{ count: 2, subtotal: 18 }]
    })
    expect(characterCard!.evidence.terms[0]!.rolls).toHaveLength(2)
    expect(
      cards.find((card) => card.characterLabel === enemyActor.label)?.evidence.terms[0]!.rolls
    ).toHaveLength(1)
  }, 30000)

  it('replays a retried advantage declaration to the same two faces and the same one card', async () => {
    const { base, run, characterActor } = await startCharacterDeclarationRun({
      character: feralInstinctCharacter()
    })
    await queueRoomRolls(base.campaign.id, { rolls: [4, 14, 4] })
    const nextDeclaration = async () => {
      const pending = await readPending(base, base.owner.caller, run.id)
      if (pending?.kind !== 'INITIATIVE_DECLARATION') throw new Error('Expected a declaration.')
      return {
        caller: pending.actorId === characterActor.id ? base.player.caller : base.owner.caller,
        input: declarationCommand({ encounterId: run.id, pending })
      }
    }
    const first = await nextDeclaration()
    await executeInRoom(first.caller, first.input)
    const terminal = await nextDeclaration()
    const settled = await executeInRoom(terminal.caller, terminal.input)
    const before = await tableInitiativeCards(base)
    expect(before).toHaveLength(2)
    expect(before.find((card) => card.characterId === base.character.id)?.evidence).toMatchObject({
      mode: 'ADVANTAGE',
      terms: [{ count: 2 }]
    })
    await expect(executeInRoom(terminal.caller, terminal.input)).resolves.toEqual(settled)
    expect(await tableInitiativeCards(base)).toEqual(before)
  }, 30000)
})

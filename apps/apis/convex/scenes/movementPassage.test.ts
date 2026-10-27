import { makeFunctionReference } from 'convex/server'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { describe, expect, it } from 'vitest'
import type {
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterRuleUsageSnapshot,
  withEncounterRuleUsageUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { api } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import {
  readCheckpointedTokenPosition,
  setupReactionMovementScene
} from '../../tests/fixtures/automaticSceneMovement'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { rejection } from '../../tests/fixtures/roomRefusals'
import { grantFixtureActorControl } from '../../tests/fixtures/spatialPreparation'
import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'

const importDefinitions = makeFunctionReference<
  'mutation',
  {
    contentSourceId: string
    definitions: readonly unknown[]
  },
  unknown
>('content/import:importDefinitions')
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

useLocalRoomWorker()

function optional(kind: 'CLIMB_ONTO_LARGER_CREATURE' | 'OVERRUN' | 'TUMBLE') {
  const definition = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (candidate) => candidate.document.kind === kind
  )
  if (!definition) throw new Error(`Missing ${kind} fixture definition.`)
  return definition
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
/** Actual Scene setup with two authored Creature snapshots and active optional-combat definitions. */
async function setupPassageScene(
  input: {
    rolls?: FixtureRolls
    perceptionRequirement?: 'SEE'
    laterBlocker?: boolean
    /** The blocker's ally (off the Scene) Helps it on its own turn before the mover's turn. */
    blockerHelp?: boolean
    path?: { x: number; y: number }[]
    /** Offers the SRD climb, against a blocker that is one size larger than the mover. */
    climb?: boolean
  } = {}
) {
  const base = await setupCreatureReactionRun(
    input.perceptionRequirement ?? null,
    true,
    Boolean(input.laterBlocker || input.blockerHelp),
    'AUTOMATIC'
  )
  const helper = input.blockerHelp ? base.additionalReactorActor : null
  if (input.blockerHelp && !helper) throw new Error('Passage helper fixture is unavailable.')
  if (input.rolls === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    optional('OVERRUN'),
    optional('TUMBLE'),
    ...(input.climb ? [optional('CLIMB_ONTO_LARGER_CREATURE')] : [])
  ]))
    await base.t.mutation(importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  const overrun = optional('OVERRUN').document.parameters
  const tumble = optional('TUMBLE').document.parameters
  if (overrun.kind !== 'OVERRUN' || tumble.kind !== 'TUMBLE')
    throw new Error('Passage definitions are invalid.')
  await base.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Passage fixture run is unavailable.')
    const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
    const optionalSnapshot = {
      schemaVersion: 1 as const,
      gameSystemId: state.gameSystemId,
      definitions: [
        optional('OVERRUN'),
        optional('TUMBLE'),
        ...(input.climb ? [optional('CLIMB_ONTO_LARGER_CREATURE')] : [])
      ].map((definition) => ({
        definitionId: definition.id,
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitionVersion: 1,
        definitionChecksum: definition.checksum,
        contractVersion: 1,
        label: definition.label,
        document: definition.document
      }))
    }
    const withOptionalCombat = encounterRunStateSchema.parse({
      ...state,
      optionalCombatSnapshot: optionalSnapshot,
      optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalSnapshot)
    })
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(withOptionalCombat),
      stateChecksum: checksumCanonicalJson(withOptionalCombat)
    })
  })
  if (input.climb)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.reactor.id)
        )
        .unique()
      if (!row) throw new Error('Passage fixture reactor is unavailable.')
      const state = await readTestActor(ctx, row)
      const { snapshot } = state
      if (!isRecord(snapshot) || !isRecord(snapshot.payload))
        throw new Error('Passage fixture reactor has no Creature snapshot.')
      await writeRunActor(
        { db: createConvexEncounterStore(ctx) },
        row._id,
        encounterRunActorStateSchema.parse({
          ...state,
          snapshot: { ...snapshot, payload: { ...snapshot.payload, size: 'LARGE' } }
        })
      )
    })
  const runVersion = async () => {
    const run = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
    )
    if (!run) throw new Error('Passage fixture run is unavailable.')
    return run.version
  }
  if (helper)
    for (const definitions of sourceImportBatches(SRD_BASIC_ACTION_DEFINITIONS))
      await base.t.mutation(importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
  await attachFixtureRoom(base.t, base.campaign.id)
  // The room holds the Run from its first command, so its version comes from each answer.
  let version = await runVersion()
  const setCurrentActor = async (actorId: string) => {
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version,
        actorId
      }
    })
    version = result.projection.version
  }
  await setCurrentActor(helper?.id ?? base.mover.id)
  if (helper) {
    await checkpointLiveRoom(base.campaign.id)
    const helpChoice = (
      await base.owner.caller.query(api.encounters.actionChoices.get, {
        encounterId: base.run.id,
        expectedVersion: await runVersion(),
        actorId: helper.id
      })
    )?.basicActionChoices.find((choice) => choice.label === 'Help')
    if (!helpChoice) throw new Error('The passage helper is not offered Help.')
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings: [],
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await runVersion(),
        actorId: helper.id,
        actionId: helpChoice.id,
        target: { kind: 'ACTOR', actorId: base.reactor.id },
        optionalCombatIntent: null,
        sceneContext: null
      }
    })
    version = result.projection.version
    await setCurrentActor(base.mover.id)
  }
  // The Scene's token binds are Convex writes the room refuses while it holds the Run (D85).
  await closeRoom(base.campaign.id)
  const additionalReactor = base.additionalReactorActor
  const actors = [base.reactor, base.mover]
  if (input.laterBlocker) {
    if (!additionalReactor) throw new Error('Passage blocker fixture is unavailable.')
    actors.push(additionalReactor)
  }
  const scene = await setupReactionMovementScene(
    { ...base, run: { ...base.run, version: await runVersion() } },
    actors,
    input.laterBlocker ? [350, 550] : [350],
    input.path ?? [
      { x: 150, y: 50 },
      { x: 650, y: 50 }
    ],
    true
  )
  return scene
}

/** The real room plans and commits a move in one step: the answer is the committed passage choice. */
async function issuePassage(value: Awaited<ReturnType<typeof setupPassageScene>>) {
  const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
  const choice = initial?.occurrence?.pending
  if (!initial || !choice || choice.kind !== 'MOVEMENT_PASSAGE_CHOICE')
    throw new Error('Expected the native movement passage choice.')
  return { choice, initial }
}

function resolveCommand(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  choice: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution
  }
}

async function respond(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  choice: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  const command = resolveCommand(value, choice, resolution)
  return { command, result: await executeInRoom(value.owner.caller, { command }) }
}

/** Sending a settled command again is a retry: the room answers it from its journal, without rolling. */
async function replayResponse(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  response: Awaited<ReturnType<typeof respond>>
) {
  return executeInRoom(value.owner.caller, { command: response.command })
}

/** Convex's rows after the room checkpoints what it holds (a Run's state is the room's until then, D85). */
async function checkpointedActors(value: Awaited<ReturnType<typeof setupPassageScene>>) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
      .collect()
  )
}

/** The Scene's token and rows as Convex holds them after a checkpoint. */
async function checkpointedScene(value: Awaited<ReturnType<typeof setupPassageScene>>) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) => ({
    scene: await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', value.sceneId))
      .unique(),
    entities: await ctx.db.query('sceneLiveEntities').collect(),
    states: await ctx.db.query('sceneLiveStates').collect()
  }))
}

/** The Rule Occurrence's pending snapshot as Convex holds it after a checkpoint. */
async function checkpointedPendingSnapshot(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  occurrenceId: string
) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) => {
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
      .unique()
    return (
      occurrence && readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, occurrence)
    )
  })
}

async function checkpointedPending(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  caller: typeof value.owner.caller
) {
  await checkpointLiveRoom(value.base.campaign.id)
  return caller.query(pendingRuleOccurrence, { encounterId: value.base.run.id })
}

/** Every row a settled passage may change as Convex holds it after a checkpoint, with the room's own history. */
async function checkpointedRows(value: Awaited<ReturnType<typeof setupPassageScene>>) {
  await checkpointLiveRoom(value.base.campaign.id)
  const timeline = await readRoomTimeline(value.owner.caller, value.base.campaign.id)
  return value.base.t.run(async (ctx) => ({
    actors: await ctx.db.query('encounterRunActors').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    scenes: await ctx.db.query('sceneLiveStates').collect(),
    sceneEntities: await ctx.db.query('sceneLiveEntities').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    timeline
  }))
}

function usedAllowances(actors: Awaited<ReturnType<typeof checkpointedActors>>) {
  return actors.reduce(
    (total, actor) =>
      total +
      Object.values(encounterRuleUsageSnapshot(readStoredRunActor(actor))).reduce(
        (sum, usage) => sum + usage,
        0
      ),
    0
  )
}

/** An unassigned player's answer is refused in the room as a domain rejection, not a redacted failure. */
async function expectNotActorController(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  command: ResolveRuleOccurrenceInputDto
) {
  await expect(executeInRoom(value.player.caller, { command })).rejects.toMatchObject({
    data: { code: 'DOMAIN_REJECTED', reason: 'NOT_ACTOR_CONTROLLER' }
  })
}

async function exhaustFixtureReaction(value: Awaited<ReturnType<typeof setupPassageScene>>) {
  await value.base.t.run(async (ctx) => {
    const actor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('id', value.base.reactor.id)
      )
      .unique()
    if (!actor) throw new Error('Passage fixture reactor is unavailable.')
    const state = await readTestActor(ctx, actor)
    const exhausted = encounterRunActorStateSchema.parse({
      ...state,
      resources: withEncounterRuleUsageUsed(state, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 1)
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, actor._id, exhausted)
  })
}

describe('native Scene movement passage', () => {
  it('publishes a passage choice and declines at the hostile contact without economy', async () => {
    const value = await setupPassageScene()
    const { choice, initial } = await issuePassage(value)
    expect(initial.delta).toMatchObject({ kind: 'TOKEN_MOVED', position: { x: 250, y: 50 } })
    expect(choice.options.map((option) => option.ruleKind).sort()).toEqual([
      'OVERRUN',
      'OVERRUN',
      'TUMBLE',
      'TUMBLE'
    ])
    const before = { actors: await checkpointedActors(value), ...(await checkpointedScene(value)) }
    const response = await respond(value, choice, { kind: 'PASSAGE_DECLINE' })
    // A completed answer carries no token delta: the token stays at the contact, read from the Scene.
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = { actors: await checkpointedActors(value), ...(await checkpointedScene(value)) }
    expect(after.actors.map((actor) => actor.stateChecksum)).toEqual(
      before.actors.map((actor) => actor.stateChecksum)
    )
    expect(after.scene?.version).toBe(before.scene?.version)
    expect(after.states).toEqual(before.states)
    expect(after.entities).toEqual(before.entities)
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
      x: 250,
      y: 50
    })
    await expect(replayResponse(value, response)).resolves.toEqual(response.result)
  }, 30_000)

  it('rejects voluntary movement whose endpoint overlaps a hostile footprint', async () => {
    const value = await setupPassageScene({
      path: [
        { x: 150, y: 50 },
        { x: 300, y: 50 }
      ]
    })
    // An occupied endpoint is a deliberate refusal; the message names no creature.
    expect(await rejection(executeSceneInRoom(value.owner.caller, value.rootInput))).toEqual({
      code: 'DOMAIN_REJECTED',
      reason: 'MOVEMENT_BLOCKED',
      message: "You can't end your move there."
    })
  }, 30_000)

  it('resumes an assisted spatial pause into Passage using the original movement distance', async () => {
    const value = await setupPassageScene({
      rolls: 'PROMPT',
      path: [
        { x: 150, y: 50 },
        { x: 700, y: 50 }
      ]
    })
    await exhaustFixtureReaction(value)
    await seedSpatialSaveEffect(value, {
      center: { x: 225, y: 50 },
      radius: 5,
      targetActorId: value.base.mover.id
    })
    const paused = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    expect(paused?.occurrence).toMatchObject({ status: 'PENDING' })
    const evidence = paused?.occurrence?.pending
    if (!evidence || evidence.kind !== 'D20_EVIDENCE')
      throw new Error(`Expected spatial pause d20 request; received ${evidence?.kind ?? 'none'}.`)
    const resumed = await respond(value, evidence, {
      kind: 'ENTER_DICE',
      requestId: evidence.request.requestId,
      rawFaces: evidence.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: evidence.request.rollMode
    })
    const choice = resumed.result.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_PASSAGE_CHOICE')
      throw new Error('Expected Passage after spatial pause.')
    const issued = await checkpointedPendingSnapshot(value, choice.occurrenceId)
    if (!issued) throw new Error('Resumed Passage choice is unavailable.')
    expect(issued.applicationContext).toMatchObject({
      movement: {
        root: {
          originalPath: [
            { x: 150, y: 50 },
            { x: 700, y: 50 }
          ]
        },
        contactPathDistance: 100
      }
    })
  }, 30_000)

  it('settles an automatic selected option once, continues its suffix, and replays without rerolling', async () => {
    const value = await setupPassageScene()
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    // The real room rolls the contest: the first die wins it (face 20), the second stays low.
    await queueRoomRolls(value.base.campaign.id, { rolls: [19, 0], repeat: 0 })
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const before = await checkpointedActors(value)
    const response = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await checkpointedActors(value)
    // The terminal position is the suffix's end; the passage receipt's audit is covered by the
    // producer test in apps/session-worker/test/nativeMovementPlanning.test.ts.
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
      x: 650,
      y: 50
    })
    expect(after.map((actor) => actor.stateChecksum)).not.toEqual(
      before.map((actor) => actor.stateChecksum)
    )
    // A retry is answered from the room's journal: other dice would change the answer if it rolled.
    await queueRoomRolls(value.base.campaign.id, { rolls: [0, 19], repeat: 0 })
    await expect(replayResponse(value, response)).resolves.toEqual(response.result)
    expect((await checkpointedActors(value)).map((actor) => actor.stateChecksum)).toEqual(
      after.map((actor) => actor.stateChecksum)
    )
  }, 30_000)

  it('keeps an assisted passage pending through both canonical d20 requests before consuming its allowance', async () => {
    const value = await setupPassageScene({
      rolls: 'PROMPT',
      perceptionRequirement: 'SEE'
    })
    const { choice } = await issuePassage(value)
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const selected = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    const initiator = selected.result.occurrence?.pending
    if (!initiator || initiator.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted initiator d20 request.')
    expect(selected.result.occurrence).toMatchObject({ status: 'PENDING' })
    const before = await checkpointedActors(value)
    const defender = await respond(value, initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.request.requestId,
      rawFaces: initiator.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: initiator.request.rollMode
    })
    const pending = defender.result.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted defender d20 request.')
    const completed = await respond(value, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: pending.request.rollMode
    })
    // The retained authored automatic reaction is offered as Use/Decline; once used, its d20
    // pauses as evidence.
    const reactionChoice = completed.result.occurrence?.pending
    if (
      !reactionChoice ||
      reactionChoice.kind !== 'MOVEMENT_REACTION' ||
      !reactionChoice.choice.options[0]
    )
      throw new Error('Expected the retained automatic reaction choice after the assisted contest.')
    const used = await respond(value, reactionChoice, {
      kind: 'OPTION',
      optionId: reactionChoice.choice.options[0].optionId
    })
    const reaction = used.result.occurrence?.pending
    if (!reaction || reaction.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the used automatic reaction d20 after the assisted contest.')
    const terminal = await respond(value, reaction, {
      kind: 'ENTER_DICE',
      requestId: reaction.request.requestId,
      rawFaces: reaction.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: reaction.request.rollMode
    })
    expect(terminal.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await checkpointedActors(value)
    expect(after.map((actor) => actor.stateChecksum)).not.toEqual(
      before.map((actor) => actor.stateChecksum)
    )
  }, 30_000)

  it("an ally's Help gives the blocker's contest check advantage, and its later reaction none (Q11)", async () => {
    const value = await setupPassageScene({
      rolls: 'PROMPT',
      perceptionRequirement: 'SEE',
      blockerHelp: true
    })
    const blockerGrants = async () => {
      await checkpointLiveRoom(value.base.campaign.id)
      return value.base.t.run((ctx) =>
        ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
            q.eq('encounterId', value.base.run.id).eq('targetActorId', value.base.reactor.id)
          )
          .collect()
      )
    }
    const { choice } = await issuePassage(value)
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const selected = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    const initiator = selected.result.occurrence?.pending
    if (!initiator || initiator.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted initiator d20 request.')
    expect(initiator.request.rollMode).toBe('NORMAL')
    const defender = await respond(value, initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.request.requestId,
      rawFaces: [20],
      rollMode: 'NORMAL'
    })
    const pending = defender.result.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted defender d20 request.')
    await expect(checkpointedPending(value, value.owner.caller)).resolves.toMatchObject({
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] }
    })
    expect(await blockerGrants()).toHaveLength(1)
    const completed = await respond(value, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: [1, 1],
      rollMode: 'ADVANTAGE'
    })
    expect(await blockerGrants()).toEqual([])
    // The blocker's retained opportunity attack can't use the Help again.
    const reactionChoice = completed.result.occurrence?.pending
    if (reactionChoice?.kind !== 'MOVEMENT_REACTION' || !reactionChoice.choice.options[0])
      throw new Error('Expected the retained reaction choice after the contest.')
    const used = await respond(value, reactionChoice, {
      kind: 'OPTION',
      optionId: reactionChoice.choice.options[0].optionId
    })
    const reaction = used.result.occurrence?.pending
    if (reaction?.kind !== 'D20_EVIDENCE') throw new Error('Expected the reaction d20.')
    expect(reaction.request.rollMode).toBe('NORMAL')
  }, 30_000)

  it('consumes the settled passage allowance once and replays without consuming again', async () => {
    const value = await setupPassageScene({ rolls: 'PROMPT' })
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const selected = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    const initiator = selected.result.occurrence?.pending
    if (!initiator || initiator.kind !== 'D20_EVIDENCE')
      throw new Error('Expected initiator d20 request.')
    const defender = await respond(value, initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.request.requestId,
      rawFaces: initiator.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: initiator.request.rollMode
    })
    const pending = defender.result.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected defender d20 request.')
    const before = await checkpointedRows(value)
    const response = await respond(value, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: pending.request.rollMode
    })
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await checkpointedRows(value)
    expect(usedAllowances(after.actors)).toBe(usedAllowances(before.actors) + 1)
    await expect(replayResponse(value, response)).resolves.toEqual(response.result)
    expect(await checkpointedRows(value)).toEqual(after)
  }, 60_000)

  // A room transaction that fails mid-commit cannot be provoked through the real room (it needs
  // storage fault injection), so its rollback (no state, identity, record or checksum kept) is proved
  // at its producer: session-worker roomEncounterStore.test.ts, "discards a failed command and its
  // identities, records and checksum". Here a terminal answer the room refuses stands in for the
  // failed attempt, then the retry settles once.
  it('spends nothing before the terminal step, spends its allowance once at the terminal step and replays the same command (V13.3)', async () => {
    const value = await setupPassageScene({ rolls: 'PROMPT' })
    await exhaustFixtureReaction(value)
    const checksums = async () =>
      (await checkpointedActors(value)).map((actor) => actor.stateChecksum)
    const spentBefore = await checksums()
    const allowancesBefore = usedAllowances(await checkpointedActors(value))

    // Nothing is spent at the passage choice, the selection or the first contest d20.
    const { choice } = await issuePassage(value)
    expect(await checksums()).toEqual(spentBefore)
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const selected = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    const initiator = selected.result.occurrence?.pending
    if (!initiator || initiator.kind !== 'D20_EVIDENCE')
      throw new Error('Expected initiator d20 request.')
    expect(await checksums()).toEqual(spentBefore)
    const defender = await respond(value, initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.request.requestId,
      rawFaces: initiator.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: initiator.request.rollMode
    })
    const pending = defender.result.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected defender d20 request.')
    expect(await checksums()).toEqual(spentBefore)
    expect(usedAllowances(await checkpointedActors(value))).toBe(allowancesBefore)

    // A terminal answer the room refuses (a stale occurrence version) spends and records nothing, and
    // the real answer then retries.
    await expect(
      executeInRoom(value.owner.caller, {
        command: resolveCommand(
          value,
          { ...pending, occurrenceVersion: pending.occurrenceVersion + 1 },
          {
            kind: 'ENTER_DICE',
            requestId: pending.request.requestId,
            rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
            rollMode: pending.request.rollMode
          }
        )
      })
    ).rejects.toMatchObject({ data: { code: 'DOMAIN_REJECTED' } })
    expect(await checksums()).toEqual(spentBefore)
    expect(usedAllowances(await checkpointedActors(value))).toBe(allowancesBefore)

    // The terminal step spends its allowance once.
    const response = await respond(value, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: pending.request.rollMode
    })
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const settled = await checkpointedRows(value)
    expect(usedAllowances(settled.actors)).toBe(allowancesBefore + 1)

    // An exact replay is answered from the room's journal: it rolls and spends nothing.
    await expect(replayResponse(value, response)).resolves.toEqual(response.result)
    expect(await checkpointedRows(value)).toEqual(settled)
  }, 60_000)

  it.each([
    ['tie', [20], [20]],
    ['failure', [1], [20]]
  ] as const)(
    'stops a %s passage at contact while consuming its allowance once',
    async (_, initiatorFaces, defenderFaces) => {
      const value = await setupPassageScene({ rolls: 'PROMPT' })
      await exhaustFixtureReaction(value)
      const { choice } = await issuePassage(value)
      const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
      if (!option) throw new Error('Expected an Overrun passage option.')
      const before = await checkpointedActors(value)
      const selected = await respond(value, choice, {
        kind: 'PASSAGE_OPTION',
        optionId: option.optionId
      })
      const initiator = selected.result.occurrence?.pending
      if (!initiator || initiator.kind !== 'D20_EVIDENCE')
        throw new Error('Expected initiator d20 request.')
      const defender = await respond(value, initiator, {
        kind: 'ENTER_DICE',
        requestId: initiator.request.requestId,
        rawFaces: [...initiatorFaces],
        rollMode: 'NORMAL'
      })
      const pending = defender.result.occurrence?.pending
      if (!pending || pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected defender d20 request.')
      const response = await respond(value, pending, {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [...defenderFaces],
        rollMode: 'NORMAL'
      })
      expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
      // The mover stops at the contact it never passed.
      expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
        x: 250,
        y: 50
      })
      const after = await checkpointedActors(value)
      expect(usedAllowances(after)).toBe(usedAllowances(before) + 1)
      await expect(replayResponse(value, response)).resolves.toEqual(response.result)
    },
    30_000
  )

  it("delivers a decision owed to the mover's player through their pending read, whatever the room acknowledged (D47)", async () => {
    const value = await setupPassageScene()
    await value.base.t.run((ctx) =>
      grantFixtureActorControl(ctx, {
        encounterId: value.base.run.id,
        actorId: value.base.mover.id,
        controllerUserIds: [value.player.userId]
      })
    )
    const { choice } = await issuePassage(value)
    // The room acknowledges a member who can't see a Scene change with its version only (D47);
    // the pending read answers by who owes the decision, never by what the Scene showed them.
    await expect(checkpointedPending(value, value.player.caller)).resolves.toMatchObject({
      kind: 'MOVEMENT_PASSAGE_CHOICE',
      occurrenceId: choice.occurrenceId,
      occurrenceVersion: choice.occurrenceVersion
    })
  }, 30_000)

  it('hides assisted Creature evidence from an unassigned player while the owner resolves both participants', async () => {
    const value = await setupPassageScene({ rolls: 'PROMPT' })
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    expect(await checkpointedPending(value, value.player.caller)).toBeNull()
    await expectNotActorController(
      value,
      resolveCommand(value, choice, { kind: 'PASSAGE_DECLINE' })
    )
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const initiator = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    const first = initiator.result.occurrence?.pending
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Expected Creature initiator d20 request.')
    expect(await checkpointedPending(value, value.player.caller)).toBeNull()
    await expectNotActorController(
      value,
      resolveCommand(value, first, {
        kind: 'ENTER_DICE',
        requestId: first.request.requestId,
        rawFaces: first.request.rollMode === 'NORMAL' ? [20] : [20, 20],
        rollMode: first.request.rollMode
      })
    )
    const defender = await respond(value, first, {
      kind: 'ENTER_DICE',
      requestId: first.request.requestId,
      rawFaces: first.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: first.request.rollMode
    })
    const second = defender.result.occurrence?.pending
    if (!second || second.kind !== 'D20_EVIDENCE')
      throw new Error('Expected Creature defender d20 request.')
    expect(await checkpointedPending(value, value.player.caller)).toBeNull()
    await expectNotActorController(
      value,
      resolveCommand(value, second, {
        kind: 'ENTER_DICE',
        requestId: second.request.requestId,
        rawFaces: second.request.rollMode === 'NORMAL' ? [1] : [1, 1],
        rollMode: second.request.rollMode
      })
    )
    const completed = await respond(value, second, {
      kind: 'ENTER_DICE',
      requestId: second.request.requestId,
      rawFaces: second.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: second.request.rollMode
    })
    expect(completed.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  }, 30_000)

  it('stops a successful passage at the sealed next hostile blocker without a second contest', async () => {
    const value = await setupPassageScene({ laterBlocker: true })
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    await queueRoomRolls(value.base.campaign.id, { rolls: [19, 0], repeat: 0 })
    const issued = await checkpointedPendingSnapshot(value, choice.occurrenceId)
    if (!issued) throw new Error('Issued passage choice is unavailable.')
    expect(issued.applicationContext).toMatchObject({
      movement: { nextPassageStop: { contact: { x: 450, y: 50 } } }
    })
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const response = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
      x: 450,
      y: 50
    })
    // The passage receipt's audit terminalPosition is held history the room keeps; its producer test
    // is apps/session-worker/test/nativeMovementPlanning.test.ts, "stops a successful passage at the sealed
    // next hostile blocker".
  }, 30_000)
})

describe('a won climb settles the cling its definition authors (MOVE-4.T2a)', () => {
  /** The Active Effects the room's checkpoint leaves on the blocker, as Convex holds them. */
  async function blockerEffects(value: Awaited<ReturnType<typeof setupPassageScene>>) {
    await checkpointLiveRoom(value.base.campaign.id)
    return value.base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', value.base.run.id).eq('id', value.base.reactor.id)
        )
        .unique()
      if (!row) throw new Error('Passage fixture blocker is unavailable.')
      return listActiveRuleEffects(
        { db: createConvexEncounterStoreReader(ctx) },
        turnEffectOwner(await readTestActor(ctx, row), value.base.run.id)
      )
    })
  }

  async function climb(rolls: number[]) {
    const value = await setupPassageScene({ climb: true })
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    await queueRoomRolls(value.base.campaign.id, { rolls, repeat: 0 })
    const option = choice.options.find((entry) => entry.ruleKind === 'CLIMB_ONTO_LARGER_CREATURE')
    if (!option) throw new Error('Expected a climb passage option.')
    const response = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    return { value, response }
  }

  it('creates the authored cling on the blocker once, owned and sourced by the climb, and replays without a second', async () => {
    const { value, response } = await climb([19, 0])
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    // The won climb enters the blocker's space (MOVE-4.T2b2).
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
      x: 350,
      y: 50
    })
    const effects = await blockerEffects(value)
    expect(effects).toHaveLength(1)
    const [effect] = effects
    expect(effect?.definition.origin).toMatchObject({
      kind: 'ENCOUNTER',
      sourceAggregateId: value.base.run.id,
      sourceActorId: value.base.mover.id
    })
    expect(effect?.owner).toEqual({
      kind: 'ENCOUNTER_ACTOR',
      encounterId: value.base.run.id,
      targetActorId: value.base.reactor.id
    })
    expect(JSON.stringify(effect?.definition.stateContributions)).toContain(
      'SOURCE_ATTACK_ROLL_INFLUENCE'
    )
    await queueRoomRolls(value.base.campaign.id, { rolls: [0, 19], repeat: 0 })
    await expect(replayResponse(value, response)).resolves.toEqual(response.result)
    expect(await blockerEffects(value)).toEqual(effects)
  }, 30_000)

  it('gives the blocker nothing when the climber loses the contest', async () => {
    const { value, response } = await climb([0, 19])
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(await blockerEffects(value)).toEqual([])
  }, 30_000)
})

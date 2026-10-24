import { makeFunctionReference } from 'convex/server'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { describe, expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActorTokenBindingCommandInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { readCheckpointedTokenPosition } from '../../tests/fixtures/automaticSceneMovement'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  readRoomTimeline,
  roomErrorLogs,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
// Keep handler compilation outside the per-operation test timer.
import '../content/import'
import '../betterAuth/adapter'
import '../auth'
import '../account'
import '../campaigns/create'
import '../encounters/blueprints'
import '../encounters/runs'
import '../encounters/actorTokenBindings'

useLocalRoomWorker()

const versionStale = { code: 'DOMAIN_REJECTED', reason: 'VERSION_STALE' }

const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  { projection: { version: number } }
>('encounters/actorTokenBindings:execute')
async function setup(selected = false) {
  const base = await setupCreatureReactionRun(null, selected, true)
  // The GM selects the reaction and rolls its dice; prompt for them as evidence.
  if (selected) await setAutoRollDice(base.t, base.owner.userId, false)
  if (!base.additionalReactorActor) throw new Error('Fixture additional reactor missing.')
  const sceneId = crypto.randomUUID()
  const definitionSaveId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const now = new Date().toISOString()
  const tokens: SceneDefinitionDto['tokens'] = [50, 150, 50].map((x, index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: index === 1 ? [base.other.userId] : [],
    width: 100,
    height: 100,
    hidden: false,
    locked: false,
    label: index === 0 ? 'Reactor' : 'Mover',
    position: { x, y: 50 },
    rotationDegrees: 0,
    senses: [],
    vision: null
  }))
  const settings = {
    campaignId: base.campaign.id,
    name: 'Response scene',
    ambientIllumination: 'BRIGHT' as const,
    daylight: false,
    fogMode: 'SHARED_PARTY' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid: {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    },
    map: {
      assetId: crypto.randomUUID(),
      width: 1000,
      height: 1000,
      tileManifestAssetId: null
    }
  }
  await base.t.run(async (ctx) => {
    const definitionId = crypto.randomUUID()
    const materializationCommandId = crypto.randomUUID()
    await ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      joinedAt: now,
      accessStartedAt: now,
      leftAt: null
    })
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...settings,
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId,
        version: 0,
        materializationCommandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: definitionSaveId,
        commandId: materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.owner.userId,
        definitionId,
        expectedVersion: null,
        settings,
        counts: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: 3
        },
        received: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: 3
        },
        status: 'PUBLISHED',
        liveSceneId: sceneId,
        entitiesRemoved: false,
        createdAt: now,
        expiresAt: Date.now() + 60_000
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId: definitionSaveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: base.campaign.id,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId,
      commandId: rootCommandId,
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: now
    })
  })
  let version = base.run.version
  for (const [index, actor] of [base.reactor, base.mover, base.additionalReactorActor].entries()) {
    const result = await base.owner.caller.mutation(bindActorToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id,
        expectedEncounterVersion: version,
        actorId: actor.id,
        sceneId,
        tokenId: tokens[index]!.id
      }
    })
    version = result.projection.version
  }
  await attachFixtureRoom(base.t, base.campaign.id)
  const rootInput = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId,
    commandId: rootCommandId,
    expectedSceneVersion: 0,
    expectedEncounterVersion: version,
    correlationId: null,
    tokenId: tokens[1]!.id,
    movementKind: 'VOLUNTARY' as const,
    path: [
      { x: 150, y: 50 },
      { x: 300, y: 50 }
    ]
  }
  return { base, sceneId, tokens, rootInput }
}

/** Convex's rows after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
async function stored(value: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) => ({
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    fog: await ctx.db.query('sceneFogLayers').collect()
  }))
}

describe('room movement response publication', () => {
  it('settles a selected GM Creature reaction through its issued evidence and replays the current occurrence', async () => {
    const value = await setup(true)
    const { owner } = value.base
    const rootMove = await executeSceneInRoom(owner.caller, value.rootInput)
    const root = rootMove.result
    const choice = root?.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected issued movement reaction choice.')
    const option = choice.choice.options[0]
    if (!option) throw new Error('Expected issued movement reaction option.')
    const selected: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'OPTION', optionId: option.optionId }
    }
    const beforePreparation = await stored(value)
    let lastCommand = selected
    let result = await executeInRoom(owner.caller, { command: selected })
    expect(result.occurrence?.status).toBe('PENDING')
    const beforeCompletion = beforePreparation.runs[0]
    if (!beforeCompletion) throw new Error('Expected encounter Run.')
    const evidenceKinds: string[] = []
    let sawSubsequentReactor = false
    while (result.occurrence?.status === 'PENDING') {
      const pending = result.occurrence.pending
      if (
        !pending ||
        (pending.kind !== 'MOVEMENT_REACTION' &&
          pending.kind !== 'D20_EVIDENCE' &&
          pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      )
        throw new Error('Expected selected reaction evidence request.')
      if (pending.kind !== 'MOVEMENT_REACTION') evidenceKinds.push(pending.kind)
      if (pending.kind === 'MOVEMENT_REACTION') sawSubsequentReactor = true
      const command: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution:
          pending.kind === 'MOVEMENT_REACTION'
            ? { kind: 'DECLINE' }
            : pending.kind === 'D20_EVIDENCE'
              ? {
                  kind: 'ENTER_DICE',
                  requestId: pending.request.requestId,
                  rawFaces: pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
                  rollMode: pending.request.rollMode
                }
              : {
                  kind: 'ENTER_INTEGER',
                  requestId: pending.request.requestId,
                  value: pending.request.max
                }
      }
      lastCommand = command
      result = await executeInRoom(owner.caller, { command })
      // Declining the last reactor completes the move; evidence and Use answers leave it pending.
      expect(result.occurrence?.status).toBe(
        pending.kind === 'MOVEMENT_REACTION' ? 'COMPLETE' : 'PENDING'
      )
    }
    // The natural 20 is a critical hit: the reaction's two damage dice are each rolled twice (D58).
    expect(evidenceKinds).toEqual([
      'D20_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE'
    ])
    expect(sawSubsequentReactor).toBe(true)
    expect(result.occurrence).toMatchObject({
      status: 'COMPLETE',
      pending: null
    })
    const completed = await stored(value)
    expect(completed.runs[0]?.version).toBe(beforeCompletion.version + 2)
    expect(completed.actors).not.toEqual(beforePreparation.actors)
    // The command receipts are room-held (D85); a member sees them as the Run's timeline entries.
    const timeline = await readRoomTimeline(owner.caller, value.base.campaign.id)
    expect(timeline.some((entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE')).toBe(true)
    const source = completed.actors.find((actor) => actor.id === choice.choice.reactorActorId)
    const target = completed.actors.find((actor) => actor.id === value.base.mover.id)
    const priorTarget = beforePreparation.actors.find((actor) => actor.id === value.base.mover.id)
    if (!source || !target || !priorTarget) throw new Error('Expected selected reaction actors.')
    expect(readStoredRunActor(source).resources).toMatchObject({
      ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
    })
    const targetState = readStoredRunActor(target)
    const priorTargetState = readStoredRunActor(priorTarget)
    if (targetState.kind === 'CHARACTER' || priorTargetState.kind === 'CHARACTER')
      throw new Error('Expected a Creature reaction target.')
    expect(targetState.currentHitPoints).toBeLessThan(priorTargetState.currentHitPoints)
    // A retry is answered with the Run as it now stands, and the root move from its journal.
    const retry = await executeInRoom(owner.caller, { command: lastCommand })
    expect(retry).toEqual(result)
    expect(retry.projection.version).toBe(completed.runs[0]?.version)
    await expect(
      executeSceneInRoom(owner.caller, value.rootInput, rootMove.expectedSessionSequence)
    ).resolves.toEqual({ ...rootMove, result: { ...root, replayed: true } })
    expect(await stored(value)).toEqual(completed)
  })

  it('races every reaction response to one winner and one stale loser, spending the reaction once', async () => {
    const value = await setup(true)
    const { owner, run, campaign } = value.base
    const rootMove = await executeSceneInRoom(owner.caller, value.rootInput)
    const root = rootMove.result
    const reactionStart = await stored(value)
    const losers: string[] = []
    let selected = false
    let pending = root?.occurrence?.pending ?? null
    while (pending) {
      if (
        pending.kind !== 'MOVEMENT_REACTION' &&
        pending.kind !== 'D20_EVIDENCE' &&
        pending.kind !== 'ACTION_OUTCOME_EVIDENCE'
      )
        throw new Error('Expected a movement reaction response.')
      const current = pending
      const option = pending.kind === 'MOVEMENT_REACTION' ? pending.choice.options[0] : undefined
      const resolution: ResolveRuleOccurrenceInputDto['resolution'] =
        pending.kind === 'MOVEMENT_REACTION'
          ? !selected && option
            ? { kind: 'OPTION', optionId: option.optionId }
            : { kind: 'DECLINE' }
          : pending.kind === 'D20_EVIDENCE'
            ? {
                kind: 'ENTER_DICE',
                requestId: pending.request.requestId,
                rawFaces: pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
                rollMode: pending.request.rollMode
              }
            : {
                kind: 'ENTER_INTEGER',
                requestId: pending.request.requestId,
                value: pending.request.max
              }
      if (resolution.kind === 'OPTION') selected = true
      const contenders = [crypto.randomUUID(), crypto.randomUUID()].map((commandId) => ({
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE' as const,
          commandId,
          encounterId: run.id,
          expectedVersion: current.encounterVersion,
          occurrenceId: current.occurrenceId,
          expectedOccurrenceVersion: current.occurrenceVersion,
          correlationId: null,
          resolution
        }
      }))
      const logsBeforeRace = roomErrorLogs().length
      const raced = await Promise.allSettled(
        contenders.map((input) => executeInRoom(owner.caller, input))
      )
      const winnerIndex = raced.findIndex((result) => result.status === 'fulfilled')
      const winner = raced[winnerIndex]
      const loser = raced[1 - winnerIndex]
      if (winner?.status !== 'fulfilled' || loser?.status !== 'rejected')
        throw new Error('Reaction response contention needs one winner and one stale loser.')
      // A stale answer is a domain rejection whether the winner completed the occurrence (moving
      // the Encounter version) or only advanced the occurrence: neither logs a cause.
      const expectStaleRefusal = (failure: unknown, causes: readonly string[]) => {
        expect(failure).toMatchObject({
          data: { ...versionStale, message: 'Encounter version is stale.' }
        })
        expect(causes).toEqual([])
      }
      expectStaleRefusal(loser.reason, roomErrorLogs().slice(logsBeforeRace))
      losers.push(contenders[1 - winnerIndex]!.command.commandId)
      const settled = await stored(value)
      // The room answers the winner's retry from its held history: the exact stored result, at
      // every step (live-sessions.md, "Every command takes the same path").
      await expect(executeInRoom(owner.caller, contenders[winnerIndex]!)).resolves.toEqual(
        winner.value
      )
      const logsBeforeRetry = roomErrorLogs().length
      const retried = await executeInRoom(owner.caller, contenders[1 - winnerIndex]!).then(
        () => {
          throw new Error('Expected the stale answer to be refused.')
        },
        (failure: unknown) => failure
      )
      expectStaleRefusal(retried, roomErrorLogs().slice(logsBeforeRetry))
      expect(await stored(value)).toEqual(settled)
      pending =
        winner.value.occurrence?.status === 'PENDING' ? winner.value.occurrence.pending : null
    }
    expect(selected).toBe(true)
    const final = await stored(value)
    const choice = root?.occurrence?.pending
    if (choice?.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the issued reaction choice.')
    const reactor = final.actors.find((actor) => actor.id === choice.choice.reactorActorId)
    if (!reactor) throw new Error('Expected the selected reactor.')
    expect(readStoredRunActor(reactor).resources).toMatchObject({
      ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
    })
    // A stale loser leaves no command, occurrence or timeline trace.
    const timeline = await readRoomTimeline(owner.caller, campaign.id)
    expect(JSON.stringify([final, timeline])).not.toMatch(new RegExp(losers.join('|')))
    // Each Run version the winners committed carries exactly one command: the receipts are
    // room-held (D85), so the timeline is where a member sees them.
    const committed = final.runs[0]!.version - reactionStart.runs[0]!.version
    expect(committed).toBeGreaterThan(0)
    expect(
      timeline.filter((entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE')
    ).toHaveLength(committed)
    await expect(
      executeSceneInRoom(owner.caller, value.rootInput, rootMove.expectedSessionSequence)
    ).resolves.toEqual({ ...rootMove, result: { ...root, replayed: true } })
    expect(await stored(value)).toEqual(final)
  }, 90_000)

  it('publishes repeated GM declines and replays the current complete occurrence', async () => {
    const value = await setup()
    const { owner, other } = value.base
    const rootMove = await executeSceneInRoom(owner.caller, value.rootInput)
    const root = rootMove.result
    expect(root?.occurrence).toMatchObject({
      status: 'PENDING',
      occurrenceVersion: 0
    })
    const rootOccurrence = root?.occurrence
    if (!root || !rootOccurrence?.pending) throw new Error('Expected response pending summary.')
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: rootOccurrence.pending.encounterVersion,
      occurrenceId: rootOccurrence.occurrenceId,
      expectedOccurrenceVersion: rootOccurrence.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'DECLINE' }
    }
    await expect(executeInRoom(other.caller, { command })).rejects.toMatchObject({
      data: { code: 'DOMAIN_REJECTED', reason: 'NOT_ACTOR_CONTROLLER' }
    })
    const before = await stored(value)
    const first = await executeInRoom(owner.caller, { command })
    expect(first.occurrence).toMatchObject({ status: 'PENDING', occurrenceVersion: 1 })
    const after = await stored(value)
    expect(after.runs[0]!.version).toBe(before.runs[0]!.version)
    if (!first.occurrence?.pending) throw new Error('Expected second pending choice.')
    const secondCommand: ResolveRuleOccurrenceInputDto = {
      ...command,
      commandId: crypto.randomUUID(),
      expectedVersion: first.occurrence.pending.encounterVersion,
      expectedOccurrenceVersion: first.occurrence.occurrenceVersion
    }
    const result = await executeInRoom(owner.caller, { command: secondCommand })
    // The reach contact is at x = 200, so the declined move finishes its remaining path.
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', occurrenceVersion: 2 })
    expect(
      await readCheckpointedTokenPosition(
        { base: value.base, owner, sceneId: value.sceneId },
        value.tokens[1]!.id
      )
    ).toEqual({ x: 300, y: 50 })
    const retryState = await stored(value)
    expect(retryState.runs[0]!.version).toBe(before.runs[0]!.version + 1)
    // The first decision's journaled receipt (pending, occurrence version 1) is shown over the Run as
    // it now stands, as every Encounter command's retry is (replayRoomEncounterCommand).
    const replayed = await executeInRoom(owner.caller, { command })
    expect(replayed).toEqual({ ...first, projection: result.projection })
    expect(replayed.projection.version).toBe(result.projection.version)
    await expect(
      executeSceneInRoom(owner.caller, value.rootInput, rootMove.expectedSessionSequence)
    ).resolves.toEqual({ ...rootMove, result: { ...root, replayed: true } })
    expect(await stored(value)).toEqual(retryState)
  })
})

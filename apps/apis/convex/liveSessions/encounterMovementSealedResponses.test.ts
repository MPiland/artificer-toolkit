import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
// @vitest-environment node
import { expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { readRoomPendingSnapshot } from '../../tests/fixtures/roomPendingSnapshots'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { readCheckpointedTokenPosition } from '../../tests/fixtures/automaticSceneMovement'

useLocalRoomWorker()

it('settles sealed movement responses through the room without replaying the crossed prefix', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 450, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })
  /**
   * Convex's rows, after the room checkpoints what it holds (a Run's history is the room's until
   * then, D85), with the room's command timeline: its receipts and command rows are held history.
   */
  const records = async () => {
    await checkpointLiveRoom(value.base.campaign.id)
    const timeline = await readRoomTimeline(value.owner.caller, value.base.campaign.id)
    return value.base.t.run(async (ctx) => ({
      timeline,
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
        .unique(),
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect(),
      effects: await ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) =>
          q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
        )
        .collect()
    }))
  }
  const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
  expect(initial).toMatchObject({ replayed: false })
  const snapshot = await readRoomPendingSnapshot(value.base.t, {
    campaignId: value.base.campaign.id,
    encounterId: value.base.run.id,
    rootCommandId: value.rootInput.commandId
  })
  if (!snapshot) throw new Error('Expected movement choice pause.')
  const prefix = snapshot.applicationContext
  if (
    prefix.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    prefix.appliedSpatialPrefix?.status !== 'BATCH_COMPLETE'
  )
    throw new Error('Expected a crossed spatial prefix before the choice.')
  const crossedEffects = prefix.appliedSpatialPrefix.executions.filter(
    (entry) => 'candidate' in entry
  )
  expect(crossedEffects.map((entry) => entry.candidate.candidate.effectId)).toContain(effect.id)
  const choice = initial?.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected a published movement choice.')
  expect((await records()).effects.map((entry) => entry.id)).not.toContain(effect.id)

  const baseline = await records()
  const appliedEffect = crossedEffects.find(
    (entry) => entry.candidate.candidate.effectId === effect.id
  )
  const baselineMover = baseline.actors.find((actor) => actor.id === value.base.mover.id)
  if (!appliedEffect || !baselineMover) throw new Error('Crossed movement effect is unavailable.')
  const baselineMoverState = readStoredRunActor(baselineMover)
  if (baselineMoverState.kind === 'CHARACTER') throw new Error('Expected a non-Character mover.')
  expect(baselineMoverState.currentHitPoints).toBe(
    appliedEffect.targetTransition.after.currentHitPoints
  )
  const command: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
  }
  const committed = await executeInRoom(value.owner.caller, { command })
  const after = await records()
  expect(committed.occurrence).toMatchObject({ status: 'PENDING' })
  expect(after.run?.version).toBe(baseline.run!.version + 1)
  expect(after.effects).toEqual(baseline.effects)
  expect(after.timeline).toHaveLength(baseline.timeline.length + 1)
  const secondChoice = committed.occurrence?.pending
  if (!secondChoice || secondChoice.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected the next issued movement choice.')
  const terminal = await executeInRoom(value.owner.caller, {
    command: {
      ...command,
      commandId: crypto.randomUUID(),
      expectedVersion: secondChoice.encounterVersion,
      occurrenceId: secondChoice.occurrenceId,
      expectedOccurrenceVersion: secondChoice.occurrenceVersion,
      resolution: { kind: 'DECLINE' }
    }
  })
  const terminalRecords = await records()
  expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(terminalRecords.effects).toEqual(after.effects)
  expect(terminalRecords.timeline).toHaveLength(after.timeline.length + 1)
  // A decision answer carries no token delta; the settled move shows as the token's end position.
  expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({ x: 450, y: 50 })
  const moverHitPoints = (actors: typeof after.actors) => {
    const mover = actors.find((actor) => actor.id === value.base.mover.id)
    if (!mover) throw new Error('Movement target actor is unavailable.')
    const state = readStoredRunActor(mover)
    if (state.kind === 'CHARACTER') throw new Error('Expected a non-Character mover.')
    return state.currentHitPoints
  }
  expect(moverHitPoints(terminalRecords.actors)).toBe(moverHitPoints(after.actors))
}, 120_000)

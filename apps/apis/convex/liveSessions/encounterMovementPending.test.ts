import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
// @vitest-environment node
import { expect, it } from 'vitest'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import { readRoomPendingSnapshot } from '../../tests/fixtures/roomPendingSnapshots'
import {
  checkpointLiveRoom,
  executeSceneInRoom,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

type Fixture = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>

/**
 * Convex's rows, after the room checkpoints what it holds (a Run's history is the room's until then,
 * D85), with the room's command timeline: its receipts and command rows are held history.
 */
async function records(value: Fixture) {
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
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', value.base.run.id))
      .collect()
  }))
}

/** The application context the room stored for the move's pause. */
async function readPauseContext(value: Fixture) {
  const snapshot = await readRoomPendingSnapshot(value.base.t, {
    campaignId: value.base.campaign.id,
    encounterId: value.base.run.id,
    rootCommandId: value.rootInput.commandId
  })
  if (!snapshot) throw new Error('The room stored no pending snapshot for the move.')
  return snapshot.applicationContext
}

it('publishes an Assisted spatial evidence pause without settling retained no-input contact', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const first = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 250, y: 50 },
    5
  )
  const later = await seedSpatialSaveEffect(value, {
    center: { x: 300, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  await setAutoRollDice(value.base.t, value.base.owner.userId, false)
  const before = await records(value)
  const published = await executeSceneInRoom(value.owner.caller, value.rootInput)
  const after = await records(value)
  expect(published.result?.occurrence).toMatchObject({ status: 'PENDING' })
  const context = await readPauseContext(value)
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' || context.phase.kind !== 'SPATIAL_EVIDENCE')
    throw new Error('Expected pending spatial evidence before reaction choice.')
  expect(
    context.completedSpatialExecutions.map((entry) => entry.candidate.candidate.effectId)
  ).toEqual([first.id])
  expect(context.phase.currentCandidate.candidate.effectId).toBe(later.id)
  expect(context.appliedSpatialPrefix).toBeNull()
  const nextReaction = context.reactionTimeline[0]
  if (!nextReaction || nextReaction.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected later reaction choice after spatial evidence.')
  expect(context.completedSpatialExecutions[0]!.candidate.candidate.pathDistance).toBeLessThan(
    context.phase.currentCandidate.candidate.pathDistance
  )
  expect(context.phase.currentCandidate.candidate.pathDistance).toBeLessThan(
    nextReaction.group.pathDistance
  )
  expect(after.run?.version).toBe(before.run?.version)
  expect(after.actors).toEqual(before.actors)
  expect(after.effects).toEqual(before.effects)
  expect(after.occurrences).toHaveLength(before.occurrences.length + 1)
  expect(published.result).toMatchObject({ replayed: false })
  // A pause commits no command row (the baseline's `runCommands` were unchanged here).
  expect(after.timeline).toHaveLength(before.timeline.length)
}, 60_000)

it('commits a spatial prefix once before a choice pause', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  const before = await records(value)
  const published = await executeSceneInRoom(value.owner.caller, value.rootInput)
  const after = await records(value)
  expect(published.result?.occurrence).toMatchObject({ status: 'PENDING' })
  const context = await readPauseContext(value)
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Expected reaction choice context.')
  const prefix = context.appliedSpatialPrefix
  if (prefix?.status !== 'BATCH_COMPLETE' || prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
    throw new Error('Expected applied spatial prefix.')
  expect(prefix.executions.map((entry) => entry.candidate.candidate.effectId)).toEqual([effect.id])
  expect(prefix.spatialEffectTransitions).toEqual([
    expect.objectContaining({
      effectId: effect.id,
      transition: expect.objectContaining({ kind: 'DELETE' })
    })
  ])
  const choice = context.reactionTimeline.find((entry) => entry.kind === 'CONTROLLER_CHOICE')
  if (!choice || choice.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected controller choice after the spatial contact.')
  expect(prefix.executions[0]!.candidate.candidate.pathDistance).toBeLessThan(
    choice.group.pathDistance
  )
  expect(after.run?.version).toBe(before.run!.version + 1)
  const beforeMover = before.actors.find((actor) => actor.id === value.base.mover.id)
  const afterMover = after.actors.find((actor) => actor.id === value.base.mover.id)
  if (!beforeMover || !afterMover) throw new Error('Spatial target actor is unavailable.')
  const beforeMoverState = readStoredRunActor(beforeMover)
  const afterMoverState = readStoredRunActor(afterMover)
  if (beforeMoverState.kind === 'CHARACTER' || afterMoverState.kind === 'CHARACTER')
    throw new Error('Expected a non-Character mover.')
  expect(afterMoverState.currentHitPoints).toBe(beforeMoverState.currentHitPoints - 1)
  expect(after.effects.map((entry) => entry.id)).not.toContain(effect.id)
  expect(published.result).toMatchObject({ replayed: false })
  expect(after.timeline).toHaveLength(before.timeline.length + 1)
}, 60_000)

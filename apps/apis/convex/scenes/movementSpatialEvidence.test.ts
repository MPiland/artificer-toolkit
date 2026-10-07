import { expect, it } from 'vitest'
import type {
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  readCheckpointedHitPoints,
  setupAutomaticSceneMovement,
  useMovementReactionsInRoom
} from '../../tests/fixtures/automaticSceneMovement'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { readRoomPendingSnapshot } from '../../tests/fixtures/roomPendingSnapshots'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import { api } from '../_generated/api'

useLocalRoomWorker()

type Scene = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>

const twoReactionPath = [
  { x: 150, y: 50 },
  { x: 600, y: 50 }
]

/** An Assisted scene whose entered (not rolled) dice the GM answers: the room rolls nothing itself. */
async function enteredDiceScene() {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: twoReactionPath
  })
  await setAutoRollDice(value.base.t, value.base.owner.userId, false)
  await invalidateRoomInputs(value.base.campaign.id, ['PREFERENCES'])
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })
  return value
}

/** Answers the room's pending movement decision as the GM. */
function answer(
  value: Scene,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  return executeInRoom(value.owner.caller, {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution
    }
  })
}

/** The save evidence the GM enters as a natural 1 (a failed save against the DC). */
function failSave(
  value: Scene,
  pending: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'D20_EVIDENCE' }>
) {
  return answer(value, pending, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
    rollMode: pending.request.rollMode
  })
}

async function effectIds(value: Scene) {
  await checkpointLiveRoom(value.base.campaign.id)
  const rows = await value.base.t.run((ctx) =>
    ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
      )
      .collect()
  )
  return rows.map((entry) => entry.id)
}

// The planner's order of spatial executions around the retained reactions is covered by the producer
// tests "settles a crossed spatial prefix before the first reaction contact" and "retains each used
// reaction in order and ends at the destination" in apps/session-worker/test/nativeMovementPlanning.test.ts;
// here it is read as the occurrence the room asks about next and the damage the saves leave behind.
it('publishes two assisted spatial save contacts before both retained reactions', async () => {
  const value = await enteredDiceScene()
  const firstEffect = await seedSpatialSaveEffect(value, {
    center: { x: 250, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const secondEffect = await seedSpatialSaveEffect(value, {
    center: { x: 325, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const startHitPoints = await readCheckpointedHitPoints(value, value.base.mover.id)

  const root = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
  let pending = root?.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected first spatial save evidence at contact 195.')
  pending = (await failSave(value, pending)).occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected second spatial save evidence at contact 270.')
  pending = (await failSave(value, pending)).occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected first retained reaction after spatial evidence.')
  const snapshot = await readRoomPendingSnapshot(value.base.t, {
    campaignId: value.base.campaign.id,
    encounterId: value.base.run.id,
    rootCommandId: value.rootInput.commandId
  })
  if (snapshot?.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Expected retained reaction context after both spatial saves.')
  // The path starts at x 150 and each contact is the circle's near edge less the mover's 50 radius.
  expect(
    snapshot.applicationContext.completedSpatialExecutions.map(
      (entry) => entry.candidate.candidate.pathDistance
    )
  ).toEqual([45, 120])
  pending = (await answer(value, pending, { kind: 'DECLINE' })).occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected second retained reaction.')
  const completed = await answer(value, pending, { kind: 'DECLINE' })
  expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const remaining = await effectIds(value)
  expect(remaining).not.toContain(firstEffect.id)
  expect(remaining).not.toContain(secondEffect.id)
  expect(await readCheckpointedHitPoints(value, value.base.mover.id)).toBe(startHitPoints - 2)
}, 30_000)

it('retains entered prefix dice through reactions and consumes the suffix save once', async () => {
  const value = await enteredDiceScene()
  const prefix = await seedSpatialSaveEffect(value, {
    center: { x: 275, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const suffix = await seedSpatialSaveEffect(value, {
    center: { x: 475, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const startHitPoints = await readCheckpointedHitPoints(value, value.base.mover.id)
  const root = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
  let pending = root?.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected prefix spatial evidence at contact 220.')
  pending = (await failSave(value, pending)).occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error(
      `Expected reaction after the entered prefix save; received ${pending?.kind ?? 'none'}.`
    )
  const snapshot = await readRoomPendingSnapshot(value.base.t, {
    campaignId: value.base.campaign.id,
    encounterId: value.base.run.id,
    rootCommandId: value.rootInput.commandId
  })
  if (snapshot?.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Expected retained reaction context after prefix spatial evidence.')
  const reactionContext = snapshot.applicationContext
  const firstReaction = reactionContext.reactionTimeline[0]
  if (!firstReaction || firstReaction.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected first retained controller choice.')
  expect(reactionContext.completedSpatialExecutions[0]?.candidate.candidate.pathDistance).toBe(70)
  expect(reactionContext.root.pathStartDistance).toBe(150)
  expect(firstReaction.group.pathDistance).toBe(150)
  expect(reactionContext.remainingSpatialCandidates[0]?.candidate.pathDistance).toBe(270)
  pending = (await answer(value, pending, { kind: 'DECLINE' })).occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected second reaction after the entered prefix save.')
  pending = (await answer(value, pending, { kind: 'DECLINE' })).occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected suffix SPATIAL_EVIDENCE after the reaction boundary.')
  // App rolls post to the table roll log, which needs a username.
  await value.owner.caller.mutation(api.account.updateProfile, {
    username: 'MovementGm',
    bio: null
  })
  // "Roll dice" rolls the save once on the server; the response only settles with that app roll.
  const appRoll = await executeInRoom(value.owner.caller, {
    command: {
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: value.base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode: null
    }
  })
  if (!appRoll.evidenceRoll) throw new Error('Expected the recorded suffix save roll.')
  expect(appRoll.evidenceRoll).toMatchObject({
    rollMode: pending.request.rollMode,
    derivedRollMode: pending.request.rollMode
  })
  expect(appRoll.evidenceRoll.faces).toEqual(
    pending.request.rollMode === 'NORMAL'
      ? [pending.request.min]
      : [pending.request.min, pending.request.min]
  )
  const completed = await answer(value, pending, {
    kind: 'SYSTEM_ROLL',
    requestId: pending.request.requestId,
    rollId: appRoll.evidenceRoll.rollId
  })
  expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const remaining = await effectIds(value)
  expect(remaining).not.toContain(prefix.id)
  expect(remaining).not.toContain(suffix.id)
  expect(await readCheckpointedHitPoints(value, value.base.mover.id)).toBe(startHitPoints - 2)
}, 30_000)

it('retains spatial executions across used automatic reactions before one suffix save roll', async () => {
  const value = await setupAutomaticSceneMovement({
    reactorPositions: [150, 150],
    path: twoReactionPath
  })
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })
  const prefix = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  const suffix = await seedSpatialSaveEffect(value, {
    center: { x: 475, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const startHitPoints = await readCheckpointedHitPoints(value, value.base.mover.id)
  // Assisted play offers both authored automatic reactions as Use/Decline; the GM uses each.
  const { occurrence } = await useMovementReactionsInRoom(value)
  expect(occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const remaining = await effectIds(value)
  expect(remaining).not.toContain(prefix.id)
  expect(remaining).not.toContain(suffix.id)
  // Each spatial contact deals 1 damage; the queued minimum dice make the used reactions' attacks miss.
  expect(await readCheckpointedHitPoints(value, value.base.mover.id)).toBe(startHitPoints - 2)
}, 30_000)

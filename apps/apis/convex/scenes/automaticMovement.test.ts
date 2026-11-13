import { expect, it } from 'vitest'
import {
  readCheckpointedHitPoints,
  setupAutomaticSceneMovement,
  useMovementReactionsInRoom
} from '../../tests/fixtures/automaticSceneMovement'
import {
  checkpointLiveRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'

useLocalRoomWorker()

type Setup = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>

/**
 * The next used reaction's dice: an attack d20 (14, a hit), two damage dice (the minimum) and the
 * mover's save against the Bite's knock-prone rider (a success).
 *
 * Restated (QUALITY-18.T2b3): a Use runs the reaction as the reactor's own action (D219), which
 * rolls that save where the inline engine never drew it, so each Use queues its own dice instead
 * of every reaction sharing one queue of three dice each.
 */
function queueReactionHit(value: Setup) {
  return queueRoomRolls(value.base.campaign.id, { rolls: [14, 0, 0, 14], repeat: 0 })
}

/** Commits the move and uses its two offered reactions, each a hit. */
async function useTwoReactionHits(value: Setup) {
  await queueReactionHit(value)
  const first = await useMovementReactionsInRoom(value, 1)
  await queueReactionHit(value)
  return useMovementReactionsInRoom(value, 1, first)
}

function readRunVersion(value: Setup) {
  return value.owner.caller.run(
    async (ctx) =>
      (
        await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
          .unique()
      )?.version
  )
}

/** The Scene's spatial effects as Convex holds them after the room checkpoints. */
async function readCheckpointedEffects(value: Setup) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.owner.caller.run((ctx) =>
    ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
      )
      .collect()
  )
}

// Assisted play offers each authored automatic reaction to its controller as Use/Decline; these
// tests use them as the GM (the reactors are Creatures). Reaction order, ordinals, source commands
// and the terminal position are room-held history, pinned in apps/session-worker/test/nativeMovementEvidence.test.ts
// ("used automatic reactions of a Creature walking east") and nativeMovementPlanning.test.ts.
it('commits used authored automatic movement reactions once', async () => {
  const value = await setupAutomaticSceneMovement()
  const startHitPoints = await readCheckpointedHitPoints(value, value.base.mover.id)
  const { occurrence } = await useTwoReactionHits(value)
  expect(occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  // Two reactions, one hit each: a repeated commit would take more.
  expect(await readCheckpointedHitPoints(value, value.base.mover.id)).toBe(startHitPoints - 8)
})

it('holds a committed automatic movement in the room until it checkpoints', async () => {
  const value = await setupAutomaticSceneMovement()
  await queueReactionHit(value)
  await checkpointLiveRoom(value.base.campaign.id)
  const before = await readRunVersion(value)
  await useMovementReactionsInRoom(value, 1)
  expect(await readRunVersion(value)).toBe(before)
  await checkpointLiveRoom(value.base.campaign.id)
  expect(await readRunVersion(value)).toBe((before ?? 0) + 1)
})

it('commits used automatic mechanics once before the next controller choice', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['AUTOMATIC', 'CHOICE'],
    reactorPositions: [50, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  await queueReactionHit(value)
  await checkpointLiveRoom(value.base.campaign.id)
  const before = await readRunVersion(value)
  const startHitPoints = await readCheckpointedHitPoints(value, value.base.mover.id)
  const { occurrence } = await useMovementReactionsInRoom(value, 1)
  expect(occurrence).toMatchObject({ status: 'PENDING' })
  await checkpointLiveRoom(value.base.campaign.id)
  expect(await readRunVersion(value)).toBe((before ?? 0) + 1)
  expect(await readCheckpointedHitPoints(value, value.base.mover.id)).toBe(startHitPoints - 4)
})

it('retains sequential used automatic reactions at distinct boundaries', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['AUTOMATIC', 'AUTOMATIC'],
    reactorPositions: [50, 150]
  })
  const startHitPoints = await readCheckpointedHitPoints(value, value.base.mover.id)
  const { occurrence } = await useTwoReactionHits(value)
  expect(occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(await readCheckpointedHitPoints(value, value.base.mover.id)).toBe(startHitPoints - 8)
})

it('settles a crossed spatial prefix before its used automatic reaction', async () => {
  const value = await setupAutomaticSceneMovement({
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
  const suffixEffect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 475, y: 50 },
    5
  )
  const { occurrence } = await useTwoReactionHits(value)
  expect(occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const effects = await readCheckpointedEffects(value)
  expect(effects.find((entry) => entry.id === effect.id)).toBeUndefined()
  expect(effects.find((entry) => entry.id === suffixEffect.id)).toBeUndefined()
}, 60_000)

it('settles a spatial prefix between a used automatic reaction and later controller choice', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['AUTOMATIC', 'CHOICE'],
    reactorPositions: [50, 250],
    path: [
      { x: 150, y: 50 },
      { x: 700, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 450, y: 50 },
    5
  )
  await queueReactionHit(value)
  await checkpointLiveRoom(value.base.campaign.id)
  const before = await readRunVersion(value)
  const { occurrence } = await useMovementReactionsInRoom(value, 1)
  expect(occurrence).toMatchObject({ status: 'PENDING' })
  const effects = await readCheckpointedEffects(value)
  expect(effects.find((entry) => entry.id === effect.id)).toBeUndefined()
  // Restated (QUALITY-18.T2b3): the used reaction commits as the reactor's own action and the
  // room's resume of the move then settles the crossed effect (D219), so the Run advances twice
  // where the Use answer committed both at once.
  expect(await readRunVersion(value)).toBe((before ?? 0) + 2)
}, 60_000)

import { expect, it } from 'vitest'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeSceneInRoom,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { seedSpatialTerminalFixture } from '../../tests/fixtures/spatialPreparation'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from '../encounters/encounterReadPorts'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

type Seeded = Awaited<ReturnType<typeof seedSpatialTerminalFixture>>

/** Convex's rows after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
async function current(value: Seeded) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run missing')
    const state = readRunState(row)
    const projection = await readEncounterGmProjection(encounterReadTransaction(ctx), state)
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      {
        encounterId: state.id,
        sceneId: value.base.sceneId
      }
    )
    const actor = await readRunActor(
      encounterReadTransaction(ctx),
      state,
      value.base.run.actors[0]!.id
    )
    if (actor.kind === 'CHARACTER') throw new Error('Expected a custom spatial actor.')
    return {
      actor,
      effects: await scope!.list(),
      runVersion: state.version,
      projection,
      occurrences: await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id))
        .collect(),
      liveStates: await ctx.db.query('sceneLiveStates').collect(),
      liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
      fogSaves: await ctx.db.query('sceneFogSaves').collect(),
      fogChunks: await ctx.db.query('sceneFogChunks').collect(),
      fogLayers: await ctx.db.query('sceneFogLayers').collect()
    }
  })
}

/** The seeded Assisted move, committed through the real room (no plan step exists to inspect). */
async function commit(...args: Parameters<typeof seedSpatialTerminalFixture>) {
  const value = await seedSpatialTerminalFixture(...args)
  await attachFixtureRoom(value.base.t, value.base.campaign.id)
  const before = await current(value)
  const { result } = await executeSceneInRoom(value.base.owner.caller, value.input)
  if (!result) throw new Error('Expected a committed Scene command result.')
  return { value, before, result, after: await current(value) }
}

// The planner's TERMINAL outcome for this move (terminal position, occurrence id) is covered by the
// producer tests in apps/session-worker; here it is read off the committed result.
it('commits a terminal movement once with its Scene move, Run state and timeline entry', async () => {
  const { value, before, result, after } = await commit()

  expect(result).toMatchObject({
    replayed: false,
    delta: { kind: 'TOKEN_MOVED', tokenId: value.tokenId },
    occurrence: { occurrenceVersion: 0, status: 'COMPLETE' }
  })
  if (result.delta?.kind !== 'TOKEN_MOVED' || !result.occurrence)
    throw new Error('Expected a committed terminal move.')
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.projection.version).toBe(before.projection.version + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toMatchObject([
    {
      collection: 'tokens',
      entityId: value.tokenId,
      value: { entity: { position: result.delta.position } }
    }
  ])
  const occurrences = after.occurrences.filter(
    (occurrence) => occurrence.id === result.occurrence?.occurrenceId
  )
  expect(occurrences).toMatchObject([
    { state: 'COMPLETED', version: 0, rootCommandId: value.input.commandId }
  ])
  expect(occurrences).toHaveLength(1)
  // The command's receipt and journal entry are room-held (D85); a member sees them as one timeline entry.
  const history = await readRoomTimeline(value.base.other.caller, value.base.campaign.id)
  expect(history.filter((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')).toHaveLength(1)

  const playerHistory = await readRoomTimeline(value.base.owner.caller, value.base.campaign.id)
  expect(playerHistory.filter((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')).toEqual([])
  expect(
    after.projection.actors.find((actor) => actor.id === after.actor.id)?.currentHitPoints
  ).toBe(after.actor.currentHitPoints)
})

it('commits a stationary terminal without moving the token or advancing the Scene', async () => {
  // The actor survives the hazard, so the move is not stopped where it drops to 0 (D156).
  const { before, result, after } = await commit(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 }
    ],
    2
  )

  expect(result).toMatchObject({ replayed: false, version: 0, delta: null })
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toEqual(before.liveEntities)
  expect(after.liveStates).toEqual(before.liveStates)
  expect(after.fogSaves).toEqual(before.fogSaves)
  expect(after.fogChunks).toEqual(before.fogChunks)
  expect(after.fogLayers).toEqual(before.fogLayers)
})

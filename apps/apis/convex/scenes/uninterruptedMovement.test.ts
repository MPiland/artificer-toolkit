import { expect, it } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createSpatialPreparationFixture,
  grantFixtureActorControl
} from '../../tests/fixtures/spatialPreparation'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeSceneInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { readOwnerFog } from '../../tests/fixtures/sceneFog'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { isScenePointExplored } from '@artificer-toolkit/shared/vtt'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'

useLocalRoomWorker()

async function setup(mode: 'MANUAL' | 'ASSISTED') {
  const fixture = await createSpatialPreparationFixture()
  const { base, tokenId } = fixture
  await base.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Missing movement fixture.')
    const state = { ...readRunState(run), automationMode: mode }
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
    await ctx.db.insert('encounterActorTokenBindings', {
      encounterId: base.run.id,
      actorId: base.run.actors[0]!.id,
      sceneId: base.sceneId,
      tokenId
    })
    // The moving player controls the bound actor; its Scene token control no longer applies.
    await grantFixtureActorControl(ctx, {
      encounterId: base.run.id,
      actorId: base.run.actors[0]!.id,
      controllerUserIds: [base.owner.userId]
    })
    for (const [ordinal, token] of base.tokens.entries()) {
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_ordinal', (q) =>
          q.eq('saveId', base.saveId).eq('value.collection', 'tokens').eq('ordinal', ordinal)
        )
        .unique()
      if (!row) throw new Error('Missing movement token.')
      const entity = {
        ...token,
        id: token.id.toLowerCase(),
        controlledByUserIds: [base.owner.userId],
        senses: [],
        vision: {
          enabled: true,
          brightRange: 1,
          dimRange: 1,
          angleDegrees: 360,
          directionDegrees: 0
        }
      }
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.patch(row._id, {
        entityId: entity.id,
        value,
        checksum: checksumCanonicalJson(value)
      })
    }
  })
  return fixture
}

/** Convex's rows after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
async function current(value: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    effects: await ctx.db.query('encounterSpatialRuleEffects').collect(),
    liveStates: await ctx.db.query('sceneLiveStates').collect(),
    liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
    fogSaves: await ctx.db.query('sceneFogSaves').collect(),
    fogLayers: await ctx.db.query('sceneFogLayers').collect(),
    fogChunks: await ctx.db.query('sceneFogChunks').collect()
  }))
}

// Why the planner found nothing to settle (MANUAL, or NO_CANDIDATES) is the producer's outcome, not a
// member-visible one: apps/session-worker/test/nativeMovementPlanning.test.ts covers the MANUAL reason
// ("moves through without a contest when the Encounter is manual") and
// packages/rules-runtime encounterMovementPublication.test.ts the NO_CANDIDATES reason.
it.each([
  { mode: 'MANUAL', movementKind: 'VOLUNTARY' },
  { mode: 'ASSISTED', movementKind: 'VOLUNTARY' },
  { mode: 'ASSISTED', movementKind: 'FORCED' },
  { mode: 'ASSISTED', movementKind: 'TELEPORT' }
] as const)(
  'commits $mode $movementKind movement and fog without a Run occurrence',
  async ({ mode, movementKind }) => {
    const value = await setup(mode)
    if (mode === 'MANUAL') await seedSpatialEffect(value.base)
    await attachFixtureRoom(value.base.t, value.base.campaign.id)
    const before = await current(value)
    const scene = await value.base.t.run((ctx) =>
      ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', value.base.sceneId))
        .unique()
    )
    if (!scene?.map) throw new Error('Missing movement Scene map.')
    const destination = value.input.path.at(-1)!
    const command = {
      ...value.input,
      movementKind,
      commandId: crypto.randomUUID()
    }
    const move = await executeSceneInRoom(value.base.owner.caller, command)
    expect(move.result).toMatchObject({
      version: 1,
      occurrence: null,
      replayed: false,
      delta: {
        kind: 'TOKEN_MOVED',
        tokenId: value.tokenId,
        position: value.input.path.at(-1)
      }
    })
    const after = await current(value)
    // The room commits the move's fog reveal with it; its result carries no fog patches to count.
    expect([after.fogLayers, after.fogChunks]).not.toEqual([before.fogLayers, before.fogChunks])
    expect(
      isScenePointExplored(
        await readOwnerFog(value.base, scene.id, { fogMode: scene.fogMode, map: scene.map }),
        value.base.owner.userId,
        destination
      )
    ).toBe(true)
    expect(after.run).toEqual(before.run)
    expect(after.actors).toEqual(before.actors)
    expect(after.occurrences).toEqual(before.occurrences)
    expect(after.effects).toEqual(before.effects)
    if (mode === 'ASSISTED' && movementKind === 'VOLUNTARY') await seedSpatialEffect(value.base)
    const beforeReplay = await current(value)
    // The room answers a retry from the command's journaled result, not by planning it again.
    await expect(
      executeSceneInRoom(value.base.owner.caller, command, move.expectedSessionSequence)
    ).resolves.toEqual({ ...move, result: { ...move.result, replayed: true } })
    expect(await current(value)).toEqual(beforeReplay)
  },
  30000
)

import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { readTestActor } from './storedActors'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type { sceneTokenMovementCommandInputDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MutationCtx } from '../../convex/_generated/server'
import { createEncounterSceneFixture } from './encounterScene'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { seedSpatialEffect } from './spatialEffect'
import { activateFixtureRun } from './activeInitiative'
import { attachFixtureRoom, executeSceneInRoom } from './localRoomWorker'
export async function createSpatialPreparationFixture() {
  const base = await createEncounterSceneFixture()
  const expectedEncounterVersion = await base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run missing')
    return readRunState(row).version
  })
  const commandId = crypto.randomUUID()
  const tokenId = base.tokens[0]!.id.toLowerCase()
  const input = {
    sceneId: base.sceneId,
    commandId,
    expectedSceneVersion: 0,
    type: 'MOVE_SCENE_TOKEN' as const,
    expectedEncounterVersion,
    correlationId: null,
    tokenId,
    movementKind: 'VOLUNTARY' as const,
    path: [
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ]
  }
  await base.t.run(async (ctx) => {
    await activateFixtureRun(ctx, base.run.id)
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId: base.sceneId,
      commandId,
      commandFingerprint: checksumCanonicalJson(input),
      createdAt: new Date().toISOString()
    })
  })
  await base.owner.caller.run(async (ctx) => {
    const sceneRow = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!sceneRow) throw new Error('Fixture Scene missing')
    const { _id: _sceneId, _creationTime: _sceneCreatedAt, ...rawScene } = sceneRow
    const scene = sceneStoredInitialStateSchema.parse(rawScene)
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: scene.definitionSaveId,
        commandId: scene.materializationCommandId,
        commandFingerprint: scene.materializationCommandFingerprint,
        ownerUserId: base.owner.userId,
        definitionId: scene.definitionId,
        expectedVersion: null,
        settings: {
          campaignId: scene.campaignId,
          name: scene.name,
          ambientIllumination: scene.ambientIllumination,
          daylight: scene.daylight,
          fogMode: scene.fogMode,
          visionRevealMode: scene.visionRevealMode,
          grid: scene.grid,
          map: scene.map
        },
        counts: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: base.tokens.length
        },
        received: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: base.tokens.length
        },
        status: 'PUBLISHED',
        liveSceneId: scene.id,
        entitiesRemoved: false,
        createdAt: scene.createdAt,
        expiresAt: Date.now() + 60_000
      })
    )
  })
  return { base, input, tokenId }
}

/**
 * The GM's UPDATE_ACTOR `controllerUserIds` grant (and, with `hitPoints`, its hit points), written
 * in place so the fixture's sealed Encounter version stays current. Encounter-bound tokens move for
 * their actor's controllers.
 */
export async function grantFixtureActorControl(
  ctx: MutationCtx,
  input: { encounterId: string; actorId: string; controllerUserIds: string[]; hitPoints?: number }
) {
  const actorRow = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) =>
      q.eq('encounterId', input.encounterId).eq('id', input.actorId)
    )
    .unique()
  if (!actorRow) throw new Error('Fixture Run actor missing')
  const actor = encounterRunActorStateSchema.parse({
    ...(await readTestActor(ctx, actorRow)),
    controllerUserIds: input.controllerUserIds,
    ...(input.hitPoints === undefined
      ? {}
      : { currentHitPoints: input.hitPoints, maxHitPoints: input.hitPoints })
  })
  await writeRunActor({ db: createConvexEncounterStore(ctx) }, actorRow._id, actor)
}

/**
 * Seeds a bound move over one spatial hazard in an Assisted Run, not yet sent to any room. The
 * bound actor has 1 hit point unless `hitPoints` gives it more, so the hazard's 1 damage need not
 * drop it to 0 (which ends a voluntary move, D156).
 */
export async function seedSpatialTerminalFixture(
  path?: ReturnType<typeof sceneTokenMovementCommandInputDtoSchema.parse>['path'],
  hitPoints?: number
) {
  const fixture = await createSpatialPreparationFixture()
  const { base, tokenId } = fixture
  const input = path ? { ...fixture.input, path } : fixture.input
  const sceneTokens = base.tokens.map((token) => ({
    ...token,
    id: token.id.toLowerCase(),
    controlledByUserIds: [base.owner.userId]
  }))
  await base.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Fixture Run missing')
    const state = { ...readRunState(run), automationMode: 'ASSISTED' as const }
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
      controllerUserIds: [base.owner.userId],
      ...(hitPoints === undefined ? {} : { hitPoints })
    })
    for (const token of sceneTokens) {
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_ordinal', (q) =>
          q
            .eq('saveId', base.saveId)
            .eq('value.collection', 'tokens')
            .eq('ordinal', sceneTokens.indexOf(token))
        )
        .unique()
      if (!row) throw new Error('Fixture token missing')
      const { _id, _creationTime, ...stored } = row
      const value = { collection: 'tokens' as const, entity: token }
      await ctx.db.replace(
        _id,
        sceneStoredDefinitionEntitySchema.parse({
          ...stored,
          entityId: token.id,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
  })
  const effect = await seedSpatialEffect(base)
  return { ...fixture, input, effect }
}

/**
 * A bound move over one seeded spatial hazard in an Assisted Run (it needs `useLocalRoomWorker`),
 * committed through the real room in one step.
 */
export async function commitSpatialTerminalFixtureInRoom(
  path?: ReturnType<typeof sceneTokenMovementCommandInputDtoSchema.parse>['path']
) {
  const seeded = await seedSpatialTerminalFixture(path)
  await attachFixtureRoom(seeded.base.t, seeded.base.campaign.id)
  const commit = await executeSceneInRoom(seeded.base.owner.caller, seeded.input)
  return { ...seeded, commit }
}

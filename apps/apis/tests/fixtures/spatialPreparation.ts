import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import {
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { createEncounterSceneFixture } from './encounterScene'
import { readRunProjection, readRunState } from '../../convex/encounters/documents'
import { readSessionVisionScope } from '../../convex/scenes/sessionVisionDocuments'
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
    const runRow = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!runRow) throw new Error('Fixture Run missing')
    const state = { ...readRunState(runRow), status: 'ACTIVE' as const }
    const projection = { ...readRunProjection(runRow), status: 'ACTIVE' as const }
    await ctx.db.patch(runRow._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId: base.sceneId,
      commandId,
      commandFingerprint: checksumCanonicalJson(input),
      createdAt: new Date().toISOString()
    })
  })
  const saveId = crypto.randomUUID()
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
    const capture = {
      campaignId: base.campaign.id,
      systemId: base.campaign.gameSystemId,
      sceneId: base.sceneId,
      expectedSceneVersion: 0,
      sessionId: base.session.id,
      expectedSessionVersion: base.session.version,
      expectedPresentationVersion: 0
    }
    const { freshness } = await readSessionVisionScope(ctx, capture)
    await ctx.db.insert(
      'sceneGeometrySaves',
      sceneStoredGeometrySaveSchema.parse({
        id: saveId,
        sceneId: base.sceneId,
        commandId,
        actorUserId: base.owner.userId,
        input,
        inputChecksum: checksumCanonicalJson(input),
        snapshotVersion: 0,
        sessionVision: { ...capture, freshness },
        status: 'RECEIVING',
        expiresAt: Date.now() + 60_000,
        fogSaves: []
      })
    )
  })
  return { base, input, saveId, tokenId }
}

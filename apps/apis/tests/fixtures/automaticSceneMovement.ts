import { makeFunctionReference } from 'convex/server'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { setupCreatureReactionRun } from './movementReaction'
import { readSessionVisionScope } from '../../convex/scenes/sessionVisionDocuments'

const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  { projection: { version: number } }
>('encounters/actorTokenBindings:execute')

/** Real native Scene/run setup for automatic movement tests and response tests. */
export async function setupAutomaticSceneMovement(
  input: {
    policies?: readonly ('AUTOMATIC' | 'CHOICE')[]
    path?: SceneDefinitionDto['tokens'][number]['position'][]
    reactorPositions?: readonly [number, number]
  } = {}
) {
  const policies = input.policies ?? ['AUTOMATIC', 'AUTOMATIC']
  const base = await setupCreatureReactionRun(
    null,
    true,
    policies.length > 1,
    policies[0]!,
    policies[1] ?? policies[0]!
  )
  if (!base.additionalReactorActor) throw new Error('Automatic fixture second reactor missing.')
  return {
    ...(await setupReactionMovementScene(
      base,
      [base.reactor, base.mover, base.additionalReactorActor],
      input.reactorPositions ?? [50, 50],
      input.path
    )),
    policies
  }
}

export async function setupReactionMovementScene<
  T extends Pick<
    Awaited<ReturnType<typeof setupCreatureReactionRun>>,
    't' | 'owner' | 'other' | 'campaign' | 'run'
  >
>(
  base: T,
  actors: EncounterGmProjectionDto['actors'],
  reactorPositions: readonly number[],
  path: SceneDefinitionDto['tokens'][number]['position'][] = [
    { x: 150, y: 50 },
    { x: 450, y: 50 }
  ]
) {
  const sceneId = crypto.randomUUID()
  const definitionSaveId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const now = new Date().toISOString()
  const tokens: SceneDefinitionDto['tokens'] = [
    reactorPositions[0]!,
    150,
    ...reactorPositions.slice(1)
  ].map((x, index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: index === 1 ? [base.other.userId] : [],
    width: 100,
    height: 100,
    hidden: false,
    locked: false,
    label: index === 1 ? 'Mover' : `Reactor ${index + 1}`,
    position: { x, y: 50 },
    rotationDegrees: 0,
    vision: null
  }))
  const settings = {
    campaignId: base.campaign.id,
    name: 'Automatic reaction Scene',
    ambientIllumination: 'BRIGHT' as const,
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
    map: { assetId: crypto.randomUUID(), width: 1000, height: 1000, tileManifestAssetId: null }
  }
  await base.t.run(async (ctx) => {
    const definitionId = crypto.randomUUID()
    const materializationCommandId = crypto.randomUUID()
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership)
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
        counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: tokens.length },
        received: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: tokens.length
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
        sessionId: base.run.sessionId,
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
  for (const [index, actor] of actors.entries()) {
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
  const rootInput = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId,
    commandId: rootCommandId,
    expectedSceneVersion: 0,
    expectedEncounterVersion: version,
    correlationId: null,
    tokenId: tokens[1]!.id,
    movementKind: 'VOLUNTARY' as const,
    path
  }
  const vision = await base.owner.caller.run(async (ctx) => {
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.sessionId))
      .unique()
    if (!session) throw new Error('Automatic fixture Session missing.')
    const scope = {
      campaignId: base.campaign.id,
      systemId: base.campaign.gameSystemId,
      sceneId,
      expectedSceneVersion: 0,
      sessionId: base.run.sessionId,
      expectedSessionVersion: session.version,
      expectedPresentationVersion: 0
    }
    return { ...scope, freshness: (await readSessionVisionScope(ctx, scope)).freshness }
  })
  const saveId = crypto.randomUUID()
  await base.owner.caller.run((ctx) =>
    ctx.db.insert(
      'sceneGeometrySaves',
      sceneStoredGeometrySaveSchema.parse({
        id: saveId,
        sceneId,
        commandId: rootCommandId,
        actorUserId: base.owner.userId,
        input: rootInput,
        inputChecksum: checksumCanonicalJson(rootInput),
        snapshotVersion: 0,
        sessionVision: vision,
        status: 'RECEIVING',
        expiresAt: Date.now() + 60_000,
        fogSaves: [],
        characterRevisions: []
      })
    )
  )
  const request = {
    saveId,
    baseOrdinal: 1,
    tokenOrdinals: tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal }))
  }
  return {
    base,
    owner: base.owner,
    player: base.other,
    sceneId,
    saveId,
    tokens,
    reactorTokenIds: tokens.filter((_, index) => index !== 1).map((token) => token.id),
    moverTokenId: tokens[1]!.id,
    rootInput,
    request,
    geometry: {
      sceneTokens: tokens,
      actorIdByTokenId: new Map(tokens.map((token, index) => [token.id, actors[index]!.id]))
    }
  }
}

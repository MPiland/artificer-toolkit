import { makeFunctionReference } from 'convex/server'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type {
  SceneSessionVisionCaptureInput,
  SceneSessionVisionScope
} from '@artificer-toolkit/schema/api/sceneSessionVision'
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
import { planMovementDecisionInRoom } from './liveSessionWorker'

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
    const scope = {
      campaignId: base.campaign.id,
      systemId: base.campaign.gameSystemId,
      sceneId,
      expectedSceneVersion: 0,
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
    movementCost: 0,
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

type SceneMovementRequest = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepareMovement = makeFunctionReference<
  'mutation',
  SceneMovementRequest,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')
const finishMovement = makeFunctionReference<
  'mutation',
  SceneMovementRequest,
  SceneGeometryCommandResult
>('scenes/geometryCommands:finish')
const observeMovement = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
/**
 * Assisted play offers every authored reaction, "automatic" ones included, to its controller as a
 * Use/Decline choice. Prepares the root movement (natively, before any room) or continues from a
 * planned decision (`start`), publishes its reaction choice, then answers Use with the first option as the GM through the room (the fixture
 * reactors are Creatures) for each further choice. Stops after `maxUses` Uses or at the first plan
 * that is not a reaction choice, and returns that plan's outcome with `publish` to commit it. Once a
 * Use is answered the Campaign stays live (`planMovementDecisionInRoom`).
 */
export async function useMovementReactions(
  value: Pick<Awaited<ReturnType<typeof setupReactionMovementScene>>, 'base' | 'owner' | 'request'>,
  maxUses = 10,
  /** A planned decision to continue from instead of the root movement. */
  start?: Awaited<ReturnType<typeof planMovementDecisionInRoom>>
): Promise<{
  prepared: Pick<SceneSpatialPreparation, 'outcome'>
  publish: () => Promise<SceneGeometryCommandResult>
  /** The last Use response command, which sources the continued movement's mechanics. */
  responseCommandId: string | null
}> {
  const { owner } = value
  if (!start)
    await owner.caller.mutation(observeMovement, {
      saveId: value.request.saveId,
      characterRevisions: []
    })
  let prepared: Pick<SceneSpatialPreparation, 'outcome'> = start
    ? { outcome: start.outcome }
    : await owner.caller.mutation(prepareMovement, value.request)
  let publish = start?.publish ?? (() => owner.caller.mutation(finishMovement, value.request))
  let responseCommandId: string | null = null
  for (let uses = 0; ; uses++) {
    const context =
      prepared.outcome.kind === 'PENDING'
        ? prepared.outcome.pendingSnapshot.applicationContext
        : null
    if (
      uses === maxUses ||
      context?.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
      context.phase.kind !== 'CHOICE'
    )
      return { prepared, publish, responseCommandId }
    const published = await publish()
    const pending = published.occurrence?.pending
    if (!pending || pending.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0])
      throw new Error('Expected the Assisted Use/Decline reaction choice.')
    responseCommandId = crypto.randomUUID()
    const plan = await planMovementDecisionInRoom(owner.caller, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: responseCommandId,
      encounterId: value.base.run.id,
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'OPTION', optionId: pending.choice.options[0].optionId }
    })
    prepared = { outcome: plan.outcome }
    publish = plan.publish
  }
}

const captureSessionVision = makeFunctionReference<
  'query',
  SceneSessionVisionCaptureInput,
  SceneSessionVisionScope
>('scenes/sessionVision:capture')

/** Recaptures the root save's session vision after a test changed its Scene vision inputs. */
export async function refreshMovementSaveVision(
  value: Pick<Awaited<ReturnType<typeof setupReactionMovementScene>>, 'base' | 'owner' | 'saveId'>
) {
  const save = await value.base.t.run((ctx) =>
    ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
      .unique()
  )
  if (!save?.sessionVision) throw new Error('Movement vision snapshot is unavailable.')
  const { freshness: _freshness, ...input } = save.sessionVision
  const vision = await value.owner.caller.query(captureSessionVision, input)
  await value.base.t.run((ctx) => ctx.db.patch(save._id, { sessionVision: vision }))
}

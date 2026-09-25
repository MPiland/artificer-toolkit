import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneGeometryBeginResultSchema,
  sceneGeometryCommandResultSchema,
  sceneGeometryStageFogInputSchema,
  sceneGeometryExecuteInputSchema,
  sceneNativeGeometryCommandInputSchema,
  sceneGeometryObserveInputSchema,
  sceneGeometrySaveLookupSchema,
  type SceneGeometryBeginResult,
  type SceneGeometryCommandResult,
  type SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneFogPatchInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import {
  sceneStoredFogChunkSchema,
  sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import {
  sceneStoredGeometrySaveSchema,
  type SceneStoredGeometrySave
} from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation, withSceneVisionTracking } from '../lib/mutations'
import { consumeSceneWriteRateLimit } from '../lib/rateLimits'
import { internal } from '../_generated/api'
// eslint-disable-next-line no-restricted-imports -- Preserve lazy return metadata and apply the same Scene vision tracking in the handler.
import { internalMutation as rawInternalMutation, type MutationCtx } from '../_generated/server'
import { parseFogSave } from './fogDocuments'
import {
  assertGeometryReceiving,
  assertStandaloneMovement,
  parseGeometryCommand,
  parseGeometrySave,
  readSpatialPreparation,
  readMovementResolution,
  readGeometrySave
} from './geometryDocuments'
import { geometryTarget, normalizeGeometryInput } from './geometryValues'
import { parseLiveEntity, readLiveScene } from './liveDocuments'
import { readPresentedVisionScene, readSessionVisionScope } from './sessionVisionDocuments'
import { assertSceneVisionCharacters } from './visionFreshness'
import {
  assertConvexOwnsSceneLiveState,
  requireActiveCampaignLiveAuthority
} from '../liveSessions/authorityGuard'

const SAVE_WINDOW = 24 * 60 * 60_000
const cleanupReference = makeFunctionReference<'mutation', { saveId: string }, null>(
  'scenes/geometryStaging:cleanup'
)
const fogCleanupReference = makeFunctionReference<'mutation', { saveId: string }, null>(
  'scenes/fogCommands:cleanup'
)

function active(campaign: { status: string }) {
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
}

export const begin = rawInternalMutation({
  args: zodToConvexFields(sceneGeometryExecuteInputSchema.shape),
  get returns() {
    return zodToConvex(sceneGeometryBeginResultSchema)
  },
  handler: async (ctx, args): Promise<SceneGeometryBeginResult> => {
    await consumeSceneWriteRateLimit(ctx)
    return beginSceneGeometry(withSceneVisionTracking(ctx), args)
  }
})

/** Both public movement and decision responses use the same private geometry/fog staging. */
export async function beginSceneGeometry(
  ctx: MutationCtx,
  args: SceneGeometryExecuteInput,
  movementResolution?: SceneStoredGeometrySave['movementResolution'],
  captureSessionVision = true,
  liveAuthority?: Parameters<typeof requireActiveCampaignLiveAuthority>[1]
): Promise<SceneGeometryBeginResult> {
  // Parse again so storage never trusts its caller.
  const input = normalizeGeometryInput(sceneNativeGeometryCommandInputSchema.parse(args.input))
  const bound = input.type === 'MOVE_SCENE_TOKEN' && input.expectedEncounterVersion !== null
  if (bound && !args.presentation)
    throw new Error('Bound Scene movement requires a presentation context.')
  const { header, campaign, userId } = await readLiveScene(
    ctx,
    input.sceneId,
    input.type === 'MOVE_SCENE_TOKEN' ? 'MEMBER' : 'OWNER'
  )
  active(campaign)
  if (liveAuthority) {
    if (!bound || liveAuthority.campaignId !== campaign.id)
      throw new Error('Live movement authority scope is inconsistent.')
    await requireActiveCampaignLiveAuthority(ctx, liveAuthority)
  } else if (input.type === 'SET_SCENE_DOOR_STATE' || input.type === 'MOVE_SCENE_TOKEN')
    await assertConvexOwnsSceneLiveState(ctx, campaign.id, header.id)
  const { presentation: fence } = sceneGeometryExecuteInputSchema.parse(args)
  const presented = fence
    ? await readPresentedVisionScene(ctx, { campaignId: campaign.id, sceneId: header.id })
    : undefined
  if (
    fence &&
    presented &&
    !captureSessionVision &&
    presented.presentation.version !== fence.expectedPresentationVersion
  )
    throw new Error('Scene vision presentation is stale.')
  const inputChecksum = checksumCanonicalJson(input)
  const priorSaveRow = await ctx.db
    .query('sceneGeometrySaves')
    .withIndex('by_sceneId_commandId', (q) =>
      q.eq('sceneId', header.id).eq('commandId', input.commandId)
    )
    .unique()
  const priorSave = priorSaveRow ? parseGeometrySave(priorSaveRow) : null
  if (
    priorSave &&
    checksumCanonicalJson(priorSave.movementResolution ?? null) !==
      checksumCanonicalJson(movementResolution ?? null)
  )
    throw new Error('Scene command ID was already used for different movement evidence.')
  if (bound && priorSave && priorSave.actorUserId !== userId)
    throw new Error('Scene geometry command belongs to another actor.')
  if (
    priorSave &&
    priorSave.sessionVision?.expectedPresentationVersion !== fence?.expectedPresentationVersion
  )
    throw new Error('Scene geometry command was already used for a different presentation.')
  const priorCommand = await ctx.db
    .query('sceneLiveCommands')
    .withIndex('by_sceneId_commandId', (q) =>
      q.eq('sceneId', header.id).eq('commandId', input.commandId)
    )
    .unique()
  if (priorCommand) {
    if (priorCommand.encoding !== 'GEOMETRY') throw new Error('Scene command ID was already used.')
    const prior = parseGeometryCommand(priorCommand, header.version)
    if (prior.inputChecksum !== inputChecksum) throw new Error('Scene command ID was already used.')
    if (!priorSave || priorSave.status !== 'PUBLISHED' || priorSave.inputChecksum !== inputChecksum)
      throw new Error('Stored Scene geometry save is inconsistent.')
    const preparation = readSpatialPreparation(priorSave)
    if (bound && !priorSave.movementResolution && preparation?.outcome.kind === 'PENDING') {
      const replay: SceneGeometryCommandResult = sceneGeometryCommandResultSchema.parse(
        await ctx.runMutation(internal.scenes.geometryCommands.finish, {
          saveId: priorSave.id,
          baseOrdinal: null
        })
      )
      return sceneGeometryBeginResultSchema.parse({
        kind: 'REPLAY',
        result: { ...prior.result, occurrence: replay.occurrence, replayed: true }
      })
    }
    return sceneGeometryBeginResultSchema.parse({
      kind: 'REPLAY',
      result: { ...prior.result, replayed: true }
    })
  }
  if (input.expectedSceneVersion > header.version)
    throw new Error('Scene version is ahead of the authoritative state.')
  await assertStandaloneMovement(ctx, campaign.id, input)
  const capture = fence
    ? {
        ...fence,
        campaignId: campaign.id,
        systemId: campaign.gameSystemId,
        sceneId: header.id,
        expectedSceneVersion: header.version
      }
    : undefined
  const sessionVision =
    captureSessionVision && capture && presented
      ? {
          ...capture,
          freshness: (
            await readSessionVisionScope(ctx, capture, {
              header,
              campaign,
              userId,
              ...presented
            })
          ).freshness
        }
      : undefined
  const target = geometryTarget(input)
  const overrideRow = await ctx.db
    .query('sceneLiveEntities')
    .withIndex('by_sceneId_collection_entityId', (q) =>
      q.eq('sceneId', header.id).eq('collection', target.collection).eq('entityId', target.entityId)
    )
    .unique()
  if (
    overrideRow &&
    parseLiveEntity(overrideRow, header.version).version > input.expectedSceneVersion
  )
    throw new Error('Scene target changed before this command completed.')
  let save
  if (priorSaveRow && priorSave) {
    if (priorSave.inputChecksum !== inputChecksum || priorSave.actorUserId !== userId)
      throw new Error('Scene geometry command was already used.')
    if (priorSave.status === 'EXPIRED' || priorSave.expiresAt <= Date.now())
      throw new Error('Scene geometry save expired.')
    if (priorSave.status === 'PUBLISHED')
      throw new Error('Stored Scene geometry save is inconsistent.')
    if (
      priorSave.snapshotVersion === header.version &&
      checksumCanonicalJson(priorSave.sessionVision ?? null) ===
        checksumCanonicalJson(sessionVision ?? null)
    )
      save = priorSave
    else {
      if (priorSave.movementResolution || readSpatialPreparation(priorSave))
        throw new Error('Spatial preparation is stale and cannot be rebased.')
      const { characterRevisions: _characterRevisions, ...priorSnapshot } = priorSave
      save = sceneStoredGeometrySaveSchema.parse({
        ...priorSnapshot,
        id: crypto.randomUUID(),
        snapshotVersion: header.version,
        ...(sessionVision ? { sessionVision } : {}),
        fogSaves: []
      })
      await ctx.db.replace(priorSaveRow._id, save)
      await ctx.scheduler.runAt(save.expiresAt, cleanupReference, {
        saveId: save.id
      })
    }
  } else {
    const expiresAt = Date.now() + SAVE_WINDOW
    save = sceneStoredGeometrySaveSchema.parse({
      id: crypto.randomUUID(),
      sceneId: header.id,
      commandId: input.commandId,
      actorUserId: userId,
      input,
      inputChecksum,
      ...(movementResolution ? { movementResolution } : {}),
      snapshotVersion: header.version,
      ...(sessionVision ? { sessionVision } : {}),
      status: 'RECEIVING',
      expiresAt,
      fogSaves: []
    })
    readMovementResolution(save)
    await ctx.db.insert('sceneGeometrySaves', save)
    await ctx.scheduler.runAt(expiresAt, cleanupReference, {
      saveId: save.id
    })
  }
  return sceneGeometryBeginResultSchema.parse({
    kind: 'READY',
    saveId: save.id,
    input: save.input,
    header,
    ...(save.movementResolution
      ? { movementStartDistance: readMovementResolution(save)!.root.pathStartDistance }
      : {}),
    ...(save.sessionVision ? { sessionVision: save.sessionVision } : {})
  })
}

export const observe = internalMutation({
  args: zodToConvexFields(sceneGeometryObserveInputSchema.shape),
  returns: zodToConvex(sceneGeometrySaveLookupSchema),
  handler: async (ctx, args) => {
    const input = sceneGeometryObserveInputSchema.parse(args)
    const { row, save, header, userId } = await readGeometrySave(ctx, input.saveId)
    assertGeometryReceiving(save, header.version, userId)
    if (!save.sessionVision)
      throw new Error('Scene geometry observations require a presentation context.')
    await readSessionVisionScope(ctx, save.sessionVision)
    await assertSceneVisionCharacters(ctx, input.characterRevisions)
    const revisions = [...input.characterRevisions].sort((a, b) =>
      a.characterId.localeCompare(b.characterId)
    )
    if (
      save.characterRevisions &&
      checksumCanonicalJson(save.characterRevisions) !== checksumCanonicalJson(revisions)
    ) {
      if (readSpatialPreparation(save))
        throw new Error('Spatial preparation is stale and cannot be rebased.')
      const next = sceneStoredGeometrySaveSchema.parse({
        ...save,
        id: crypto.randomUUID(),
        characterRevisions: revisions,
        fogSaves: []
      })
      await ctx.db.replace(row._id, next)
      await ctx.scheduler.runAt(next.expiresAt, cleanupReference, { saveId: next.id })
      return { saveId: next.id }
    }
    if (!save.characterRevisions) await ctx.db.patch(row._id, { characterRevisions: revisions })
    return { saveId: save.id }
  }
})

export const stageFog = internalMutation({
  args: zodToConvexFields(sceneGeometryStageFogInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = sceneGeometryStageFogInputSchema.parse(args)
    const {
      row: parentRow,
      save: parent,
      header,
      userId
    } = await readGeometrySave(ctx, input.saveId.toLowerCase())
    assertGeometryReceiving(parent, header.version, userId)
    if (parent.sessionVision && !parent.characterRevisions)
      throw new Error('Scene geometry Character observations are missing.')
    const layer = input.layer
    if (layer.chunks.length === 0) throw new Error('Geometry fog layer must contain chunks.')
    const columns = Math.ceil(layer.width / 32)
    if (layer.chunks.length !== columns * Math.ceil(layer.height / 32))
      throw new Error('Geometry fog replacement must cover the complete layer.')
    const chunks = [...layer.chunks].sort((left, right) => left.index - right.index)
    for (const chunk of chunks) {
      const expectedIndex = (chunk.y / 32) * columns + chunk.x / 32
      if (
        chunk.x % 32 !== 0 ||
        chunk.y % 32 !== 0 ||
        chunk.width !== Math.min(32, layer.width - chunk.x) ||
        chunk.height !== Math.min(32, layer.height - chunk.y) ||
        chunk.index !== expectedIndex
      )
        throw new Error('Geometry fog chunks must use canonical 32-cell tiles.')
    }
    const manifest = chunks.map((chunk) => ({
      index: chunk.index,
      checksum: checksumCanonicalJson(chunk)
    }))
    const existingReference = parent.fogSaves.find(
      (entry) => entry.ownerUserId === layer.ownerUserId
    )
    if (existingReference) {
      const existingRow = await ctx.db
        .query('sceneFogSaves')
        .withIndex('by_publicId', (q) => q.eq('id', existingReference.saveId))
        .unique()
      if (!existingRow) throw new Error('Stored geometry fog save is inconsistent.')
      const existing = parseFogSave(existingRow)
      if (
        existing.geometrySaveId !== parent.id ||
        existing.sceneId !== parent.sceneId ||
        existing.actorUserId !== parent.actorUserId ||
        existing.input.layer.ownerUserId !== layer.ownerUserId ||
        existing.input.layer.width !== layer.width ||
        existing.input.layer.height !== layer.height ||
        existing.input.expectedSceneVersion !== parent.snapshotVersion ||
        existing.status !== 'RECEIVING' ||
        existing.chunksRemoved ||
        existing.expiresAt <= Date.now() ||
        existing.receivedChunks !== existing.input.chunkManifest.length ||
        checksumCanonicalJson(existing.input.chunkManifest) !== checksumCanonicalJson(manifest)
      )
        throw new Error('Geometry fog layer was already staged differently.')
      return null
    }
    const saveId = crypto.randomUUID()
    const childInput = sceneFogPatchInputSchema.parse({
      type: 'PATCH_SCENE_FOG',
      sceneId: parent.sceneId,
      commandId: saveId,
      expectedSceneVersion: parent.snapshotVersion,
      layer: {
        ownerUserId: layer.ownerUserId,
        width: layer.width,
        height: layer.height
      },
      chunkManifest: manifest
    })
    const child = sceneStoredFogSaveSchema.parse({
      id: saveId,
      sceneId: parent.sceneId,
      commandId: saveId,
      actorUserId: parent.actorUserId,
      geometrySaveId: parent.id,
      input: childInput,
      inputChecksum: checksumCanonicalJson(childInput),
      status: 'RECEIVING',
      receivedChunks: chunks.length,
      expiresAt: parent.expiresAt,
      chunksRemoved: false
    })
    await ctx.db.insert('sceneFogSaves', child)
    for (const [ordinal, chunk] of chunks.entries())
      await ctx.db.insert(
        'sceneFogChunks',
        sceneStoredFogChunkSchema.parse({
          saveId,
          ordinal,
          chunk,
          checksum: checksumCanonicalJson(chunk)
        })
      )
    const nextParent = sceneStoredGeometrySaveSchema.parse({
      ...parent,
      fogSaves: [...parent.fogSaves, { saveId, ownerUserId: layer.ownerUserId }]
    })
    await ctx.db.replace(parentRow._id, nextParent)
    await ctx.scheduler.runAt(parent.expiresAt, fogCleanupReference, {
      saveId
    })
    return null
  }
})

export const cleanup = internalMutation({
  args: { saveId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', args.saveId.toLowerCase()))
      .unique()
    if (!row) return null
    const save = parseGeometrySave(row)
    if (save.status === 'PUBLISHED' || save.status === 'EXPIRED') return null
    if (save.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(save.expiresAt, cleanupReference, {
        saveId: save.id
      })
      return null
    }
    await ctx.db.patch(row._id, { status: 'EXPIRED' })
    return null
  }
})

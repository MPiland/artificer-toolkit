import { makeFunctionReference } from 'convex/server'
import type { z } from 'zod'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneGeometryBeginResultSchema,
  sceneGeometryStageFogInputSchema,
  sceneGeometryExecuteInputSchema,
  sceneNativeGeometryCommandInputSchema,
  sceneGeometryObserveInputSchema,
  sceneGeometrySaveLookupSchema,
  type SceneGeometryBeginResult,
  type SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { stageSceneGeometryFog as stageGeometryFog } from '@artificer-toolkit/encounter-persistence/sceneGeometryFogStaging'
import {
  sceneStoredGeometrySaveSchema,
  type SceneStoredGeometrySave
} from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  internalMutation,
  untrackedInternalMutation,
  withSceneVisionTracking
} from '../lib/mutations'
import { consumeSceneWriteRateLimit } from '../lib/rateLimits'
// eslint-disable-next-line no-restricted-imports -- Preserve lazy return metadata and apply the same Scene vision tracking in the handler.
import type { MutationCtx } from '../_generated/server'
import { parseFogSave } from './fogDocuments'
import { assertStandaloneMovement, readGeometrySave } from './geometryDocuments'
import {
  parseGeometryCommand,
  assertGeometryReceiving,
  parseGeometrySave,
  readSpatialPreparation,
  readMovementResolution
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import {
  geometryTarget,
  normalizeGeometryInput
} from '@artificer-toolkit/encounter-persistence/sceneGeometryValues'
import { parseLiveEntity, readLiveScene } from './liveDocuments'
import { readPresentedVisionScene, readSessionVisionScope } from './sessionVisionDocuments'
import { assertSceneVisionCharacters } from './visionFreshness'
import {
  assertConvexOwnsSceneLiveState,
  requireActiveCampaignLiveAuthority
} from '../liveSessions/authorityGuard'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { beforeWrite } from '@artificer-toolkit/encounter-persistence/transactionReads'
import { requireBoundTokenMoveControl } from '@artificer-toolkit/encounter-persistence/actorController'
import { encounterReadTransaction } from '../encounters/encounterPorts'

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

export const begin = untrackedInternalMutation({
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
  // The room admits a player's door change on a live Scene; the lock rule applies at publication.
  const liveSceneChange =
    liveAuthority !== undefined &&
    (input.type === 'MOVE_SCENE_TOKEN' || input.type === 'SET_SCENE_DOOR_STATE')
  const { header, campaign, membership, userId } = await readLiveScene(
    ctx,
    input.sceneId,
    input.type === 'MOVE_SCENE_TOKEN' || liveSceneChange ? 'MEMBER' : 'OWNER'
  )
  active(campaign)
  if (liveAuthority) {
    if (!liveSceneChange || liveAuthority.campaignId !== campaign.id)
      throw new Error('Live movement authority scope is inconsistent.')
    if (bound && !args.presentation)
      throw new Error('Bound Scene movement requires a presentation context.')
    await requireActiveCampaignLiveAuthority(ctx, liveAuthority)
  } else if (input.type === 'SET_SCENE_DOOR_STATE' || input.type === 'MOVE_SCENE_TOKEN') {
    await assertConvexOwnsSceneLiveState(ctx, campaign.id, header.id)
    // Only the Session room moves Encounter tokens, on its presented Scene (D42, D43).
    if (bound) rejectDomain('SCENE_NOT_PRESENTED')
  }
  const sceneBinding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_sceneId', (q) => q.eq('sceneId', header.id))
    .first()
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
    return sceneGeometryBeginResultSchema.parse({
      kind: 'REPLAY',
      result: { ...prior.result, replayed: true }
    })
  }
  if (input.expectedSceneVersion > header.version)
    throw new Error('Scene version is ahead of the authoritative state.')
  await assertStandaloneMovement(ctx, campaign.id, input)
  // A bound token follows its actor's controllers, never the Scene token's own list.
  if (bound && !movementResolution) {
    if (!sceneBinding) throw new Error('Bound Scene movement requires an Encounter binding.')
    await requireBoundTokenMoveControl(encounterReadTransaction(ctx), {
      campaign,
      membership,
      encounterId: sceneBinding.encounterId,
      tokenId: input.tokenId
    })
  }
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
    // Verified as it will be stored; the transaction's later reads of this save reuse it.
    readMovementResolution(beforeWrite(ctx.db, save))
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
    encounterId: sceneBinding?.encounterId ?? null,
    ...(save.movementResolution
      ? { movementStartDistance: readMovementResolution(save)!.root.pathStartDistance }
      : {}),
    ...(save.sessionVision ? { sessionVision: save.sessionVision } : {})
  })
}

/** Pins the Character revisions behind the save's Scene vision before fog is staged. */
export async function observeSceneGeometry(
  ctx: MutationCtx,
  args: z.input<typeof sceneGeometryObserveInputSchema>
): Promise<{ saveId: string }> {
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

export const observe = internalMutation({
  args: zodToConvexFields(sceneGeometryObserveInputSchema.shape),
  returns: zodToConvex(sceneGeometrySaveLookupSchema),
  handler: observeSceneGeometry
})

/** Stages one complete fog layer on the receiving save; staging the same layer again is a no-op. */
export async function stageSceneGeometryFog(
  ctx: MutationCtx,
  args: z.input<typeof sceneGeometryStageFogInputSchema>
): Promise<{ saveId: string }> {
  let parentRowId: Awaited<ReturnType<typeof readGeometrySave>>['row']['_id'] | null = null
  return stageGeometryFog(args, {
    readGeometrySave: async (saveId) => {
      const result = await readGeometrySave(ctx, saveId)
      parentRowId = result.row._id
      return result
    },
    readFogSave: async (saveId) => {
      const row = await ctx.db
        .query('sceneFogSaves')
        .withIndex('by_publicId', (q) => q.eq('id', saveId))
        .unique()
      return row ? parseFogSave(row) : null
    },
    insertFogSave: (save) => ctx.db.insert('sceneFogSaves', save),
    insertFogChunk: (chunk) => ctx.db.insert('sceneFogChunks', chunk),
    replaceGeometrySave: async (save) => {
      if (parentRowId === null) throw new Error('Scene geometry save is unavailable.')
      await ctx.db.replace(parentRowId, save)
    },
    scheduleCleanup: (expiresAt, saveId) =>
      ctx.scheduler.runAt(expiresAt, fogCleanupReference, { saveId })
  })
}

export const stageFog = internalMutation({
  args: zodToConvexFields(sceneGeometryStageFogInputSchema.shape),
  returns: zodToConvex(sceneGeometrySaveLookupSchema),
  handler: stageSceneGeometryFog
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

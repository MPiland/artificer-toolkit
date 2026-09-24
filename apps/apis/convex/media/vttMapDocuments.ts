import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import type { SceneDefinitionHeader } from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import { internal } from '../_generated/api'

export async function mapIsReferenced(ctx: QueryCtx, assetId: string) {
  const [definition, liveScene] = await Promise.all([
    ctx.db
      .query('sceneDefinitions')
      .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', assetId))
      .first(),
    ctx.db
      .query('campaignScenes')
      .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', assetId))
      .first()
  ])
  return definition !== null || liveScene !== null
}

export async function refreshMapReferenceFlag(ctx: MutationCtx, assetId: string) {
  const asset = await ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', assetId))
    .unique()
  if (!asset || asset.profile !== 'VTT_MAP') return
  const hasSceneReferences = await mapIsReferenced(ctx, asset.id)
  if (asset.hasSceneReferences !== hasSceneReferences)
    await ctx.db.patch(asset._id, { hasSceneReferences })
}

export async function requireMapUploader(ctx: QueryCtx, ownerUserId: string) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', ownerUserId))
    .unique()
  if (!profile) throw new Error('Scene map is unavailable.')
  return profile
}

export async function scheduleDetachedMapCleanup(ctx: MutationCtx, assetId: string) {
  if (await mapIsReferenced(ctx, assetId)) return
  const asset = await ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', assetId))
    .unique()
  if (!asset || asset.profile !== 'VTT_MAP' || asset.status === 'DELETED') return
  const cleanupAt = Date.now() + 24 * 60 * 60_000
  await ctx.db.patch(asset._id, { cleanupAt })
  await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, {
    assetId
  })
}

export async function requireSceneMap(
  ctx: QueryCtx,
  campaignId: string,
  map: SceneDefinitionHeader['map']
) {
  const row = await ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', map.assetId.toLowerCase()))
    .unique()
  if (!row || row.profile !== 'VTT_MAP' || row.status !== 'READY' || row.campaignId !== campaignId)
    throw new Error('Scene map is unavailable.')
  await requireMapUploader(ctx, row.ownerUserId)
  const { _id, _creationTime, ...stored } = row
  const asset = vttMapStoredAssetSchema.parse(stored)
  if (asset.width !== map.width || asset.height !== map.height || map.tileManifestAssetId !== null)
    throw new Error('Scene map dimensions or identity do not match the verified map.')
  return asset
}

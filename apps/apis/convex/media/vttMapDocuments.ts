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
  if (!asset || asset.profileClass !== 'VTT_MAP') return
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
  if (!asset || asset.profileClass !== 'VTT_MAP' || asset.status === 'DELETED') return
  const cleanupAt = Date.now() + 24 * 60 * 60_000
  await ctx.db.patch(asset._id, { cleanupAt })
  await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, {
    assetId
  })
}

/** Campaigns whose Scene definitions or live Scenes reference the map, each once. */
export async function mapCampaignIds(ctx: QueryCtx, assetId: string) {
  const campaignIds = new Set<string>()
  for await (const definition of ctx.db
    .query('sceneDefinitions')
    .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', assetId)))
    campaignIds.add(definition.campaignId)
  for await (const scene of ctx.db
    .query('campaignScenes')
    .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', assetId)))
    campaignIds.add(scene.campaignId)
  return campaignIds
}

/**
 * A Scene may use a READY map its writer owns, or one the Campaign already references (a map kept
 * after a Campaign transfer or account retention). `attachingUserId` is null when re-reading an
 * existing reference rather than attaching one.
 */
export async function requireSceneMap(
  ctx: QueryCtx,
  campaignId: string,
  map: SceneDefinitionHeader['map'],
  attachingUserId: string | null
) {
  const row = await ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', map.assetId.toLowerCase()))
    .unique()
  if (!row || row.profileClass !== 'VTT_MAP' || row.status !== 'READY')
    throw new Error('Scene map is unavailable.')
  if (
    attachingUserId !== null &&
    row.ownerUserId !== attachingUserId &&
    !(await mapCampaignIds(ctx, row.id)).has(campaignId)
  )
    throw new Error('Scene map is unavailable.')
  await requireMapUploader(ctx, row.ownerUserId)
  const { _id, _creationTime, ...stored } = row
  const asset = vttMapStoredAssetSchema.parse(stored)
  if (asset.width !== map.width || asset.height !== map.height || map.tileManifestAssetId !== null)
    throw new Error('Scene map dimensions or identity do not match the verified map.')
  return asset
}

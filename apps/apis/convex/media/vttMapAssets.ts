import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  createVttMapUploadIntentInputSchema,
  finalizeImageUploadInputSchema,
  finalizeVttMapUploadOutputSchema,
  type FinalizeVttMapUploadOutput
} from '@artificer-toolkit/schema/api/media'
import { mediaSinglePutUploadSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import {
  vttMapFinalizeInputSchema,
  vttMapProcessClaimSchema,
  vttMapStoredAssetSchema,
  type VttMapProcessClaim
} from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { internalQuery } from '../_generated/server'
import { mutation, internalMutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { charge, createMediaUpload, findAsset, MediaQuotaError, ownedAsset } from './assets'
import { requireMapUploader, requireSceneMap } from './vttMapDocuments'

const OPERATION_WINDOW = 15 * 60_000
const GRACE = 24 * 60 * 60_000

export const readDelivery = internalQuery({
  args: zodToConvexFields(finalizeImageUploadInputSchema.shape),
  returns: zodToConvex(vttMapStoredAssetSchema),
  handler: async (ctx, args) => {
    const { assetId } = finalizeImageUploadInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const asset = await findAsset(ctx, assetId.toLowerCase())
    if (!asset || asset.profile !== 'VTT_MAP' || asset.status !== 'READY')
      throw new Error('Map is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, asset.campaignId, userId)
    await requireMapUploader(ctx, asset.ownerUserId)
    if (membership.role !== 'OWNER') {
      const presentation = await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId_activeMapAssetId', (q) =>
          q.eq('campaignId', campaign.id).eq('activeMapAssetId', asset.id)
        )
        .first()
      if (!presentation || presentation.sceneId === null) throw new Error('Map is unavailable.')
      const session = await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('id', presentation.sessionId)
        )
        .unique()
      const scene = await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', presentation.sceneId!))
        .unique()
      if (
        !session ||
        session.status !== 'OPEN' ||
        !scene ||
        scene.campaignId !== campaign.id ||
        scene.map.assetId.toLowerCase() !== asset.id
      )
        throw new Error('Map is unavailable.')
      await requireSceneMap(ctx, campaign.id, scene.map)
    }
    const { _id, _creationTime, ...stored } = asset
    return vttMapStoredAssetSchema.parse(stored)
  }
})

function outputKeys(assetId: string, operationId: string) {
  const prefix = `ready/${assetId}/${operationId}`
  return [
    `${prefix}/display.webp`,
    `${prefix}/thumbnail.webp`,
    ...Array.from({ length: 8 * 8 }, (_, index) => {
      const row = Math.floor(index / 8)
      const column = index % 8
      return `${prefix}/tile-${row}-${column}.webp`
    })
  ]
}

async function requireActiveOwner(
  ctx: Parameters<typeof requireCampaignAuthority>[0],
  campaignId: string,
  userId: string
) {
  const authority = await requireCampaignAuthority(ctx, campaignId, userId)
  if (authority.membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  return authority
}

export const createUpload = mutation({
  args: zodToConvexFields(createVttMapUploadIntentInputSchema.shape),
  returns: zodToConvex(mediaSinglePutUploadSchema),
  handler: async (ctx, args) => {
    const { profile: _profile, target, ...input } = createVttMapUploadIntentInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireActiveOwner(ctx, target.campaignId, userId)
    return createMediaUpload(ctx, input, {
      type: 'VTT_MAP',
      campaignId: campaign.id
    })
  }
})

export const beginFinalize = internalMutation({
  args: { assetId: v.string() },
  returns: zodToConvex(vttMapProcessClaimSchema),
  handler: async (ctx, args): Promise<VttMapProcessClaim> => {
    const { authenticated, asset } = await ownedAsset(ctx, args.assetId.toLowerCase())
    if (asset.profile !== 'VTT_MAP') throw new Error('Map is unavailable.')
    await requireActiveOwner(ctx, asset.campaignId, authenticated.identity.userId)
    if (asset.operation) throw new Error('Map processing is still running. Try again shortly.')
    if (asset.status === 'READY')
      return {
        kind: 'CURRENT',
        result: { assetId: asset.id, status: 'READY' }
      }
    if (asset.status !== 'PENDING_UPLOAD' || !asset.rawObjectKey)
      throw new Error('Map is unavailable.')
    const operationId = crypto.randomUUID()
    const operation = {
      id: operationId,
      kind: 'INITIAL' as const,
      expiresAt: Date.now() + OPERATION_WINDOW,
      outputs: outputKeys(asset.id, operationId).map((objectKey) => ({
        objectKey
      }))
    }
    const { _id, _creationTime, ...stored } = asset
    const processing = vttMapStoredAssetSchema.parse({
      ...stored,
      status: 'PROCESSING',
      operation
    })
    await ctx.db.patch(asset._id, { status: 'PROCESSING', operation })
    await ctx.scheduler.runAt(operation.expiresAt, internal.media.assets.expireOperation, {
      assetId: asset.id,
      operationId
    })
    return { kind: 'PROCESS', asset: processing, operation }
  }
})

export const finishFinalize = internalMutation({
  args: zodToConvexFields(vttMapFinalizeInputSchema.shape),
  returns: zodToConvex(finalizeVttMapUploadOutputSchema),
  handler: async (ctx, args): Promise<FinalizeVttMapUploadOutput> => {
    const input = vttMapFinalizeInputSchema.parse(args)
    const { authenticated, asset } = await ownedAsset(ctx, input.assetId.toLowerCase())
    if (asset.profile !== 'VTT_MAP') throw new Error('Map is unavailable.')
    await requireActiveOwner(ctx, asset.campaignId, authenticated.identity.userId)
    const operation = asset.operation
    if (
      asset.status !== 'PROCESSING' ||
      !operation ||
      operation.id !== input.operationId ||
      Date.now() >= operation.expiresAt
    )
      throw new Error('Map processing is no longer current.')
    if (input.width * input.height > 64_000_000) throw new Error('Map dimensions are unavailable.')

    const expectedKeys = outputKeys(asset.id, operation.id)
    const expectedTiles = Math.ceil(input.height / 1024) * Math.ceil(input.width / 1024)
    const display = input.variants.filter((variant) => variant.kind === 'DISPLAY')
    const thumbnail = input.variants.filter((variant) => variant.kind === 'THUMBNAIL')
    const tiles = input.variants.filter((variant) => variant.kind === 'TILE')
    const validVariants =
      input.variants.length === expectedTiles + 2 &&
      operation.outputs.length === expectedKeys.length &&
      operation.outputs.every((output, index) => output.objectKey === expectedKeys[index]) &&
      display.length === 1 &&
      thumbnail.length === 1 &&
      tiles.length === expectedTiles &&
      new Set(input.variants.map((variant) => variant.objectKey)).size === input.variants.length &&
      display[0]?.objectKey === expectedKeys[0] &&
      thumbnail[0]?.objectKey === expectedKeys[1] &&
      tiles.every((tile) => {
        const expectedWidth = Math.min(1024, input.width - tile.column * 1024)
        const expectedHeight = Math.min(1024, input.height - tile.row * 1024)
        return (
          tile.row < Math.ceil(input.height / 1024) &&
          tile.column < Math.ceil(input.width / 1024) &&
          tile.width === expectedWidth &&
          tile.height === expectedHeight &&
          tile.objectKey === expectedKeys[2 + tile.row * 8 + tile.column]
        )
      }) &&
      new Set(tiles.map((tile) => `${tile.row}:${tile.column}`)).size === tiles.length
    if (!validVariants) throw new Error('Processed map output mismatch.')

    const variants = input.variants
    const bytes = variants.reduce((total, variant) => total + variant.byteSize, 0)
    const cleanupAt = Date.now() + GRACE
    try {
      await charge(ctx, authenticated.profile, bytes - asset.chargedBytes)
    } catch (error) {
      if (!(error instanceof MediaQuotaError)) throw error
      await ctx.db.patch(asset._id, { status: 'REJECTED' })
      return { assetId: asset.id, status: 'REJECTED' }
    }
    await ctx.db.patch(asset._id, {
      status: 'READY',
      width: input.width,
      height: input.height,
      variants,
      chargedBytes: bytes,
      operation: null,
      cleanupAt
    })
    await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, {
      assetId: asset.id
    })
    if (asset.rawObjectKey)
      await ctx.scheduler.runAt(
        Math.max(Date.now(), asset.uploadExpiresAt + OPERATION_WINDOW),
        internal.media.assets.cleanupRaw,
        { assetId: asset.id }
      )
    const retained = new Set(variants.map((variant) => variant.objectKey))
    const retiredKeys = operation.outputs
      .map((output) => output.objectKey)
      .filter((key) => !retained.has(key))
    if (retiredKeys.length)
      await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, {
        keys: retiredKeys
      })
    return { assetId: asset.id, status: 'READY' }
  }
})

export const rejectFinalize = internalMutation({
  args: { assetId: v.string(), operationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await findAsset(ctx, args.assetId)
    if (asset?.profile === 'VTT_MAP' && asset.operation?.id === args.operationId)
      await ctx.db.patch(asset._id, { status: 'REJECTED' })
    return null
  }
})

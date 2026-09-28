import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  createCampaignFileUploadIntentInputSchema,
  finalizeImageUploadInputSchema,
  finalizeImageUploadOutputSchema,
  type FinalizeImageUploadOutput
} from '@artificer-toolkit/schema/api/media'
import {
  mediaProcessingOperationSchema,
  mediaSinglePutUploadSchema
} from '@artificer-toolkit/schema/api/mediaAssets'
import {
  campaignFileProcessClaimSchema,
  campaignFileFinalizeInputSchema,
  type CampaignFileProcessClaim
} from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { mutation, internalMutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  createMediaUpload,
  findAsset,
  ownedAsset,
  charge,
  MediaQuotaError,
  reuseDuplicate,
  reusedAsset,
  storedImage
} from './assets'

export const createUpload = mutation({
  args: zodToConvexFields(createCampaignFileUploadIntentInputSchema.shape),
  returns: zodToConvex(mediaSinglePutUploadSchema),
  handler: async (ctx, args) => {
    const {
      target,
      profile: _profile,
      ...input
    } = createCampaignFileUploadIntentInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, target.campaignId, userId)
    // Upload authority is active membership, including archived Campaigns. Attachment
    // creation separately requires a writable Campaign, matching the existing service.
    return createMediaUpload(ctx, input, { ...target, campaignId: campaign.id })
  }
})

/**
 * Processing an upload is the owner's own business; which Campaign may reference the file is
 * decided when it is attached (ADR 0012 amendment).
 */
export const beginFinalize = internalMutation({
  args: zodToConvexFields(finalizeImageUploadInputSchema.shape),
  returns: zodToConvex(campaignFileProcessClaimSchema),
  handler: async (ctx, args): Promise<CampaignFileProcessClaim> => {
    const input = finalizeImageUploadInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const found = await findAsset(ctx, input.assetId.toLowerCase())
    if (found?.ownerUserId === userId) {
      const reused = await reusedAsset(ctx, found)
      if (reused)
        return { kind: 'CURRENT', result: { assetId: reused.id, status: 'READY', preview: null } }
    }
    const { asset } = await ownedAsset(ctx, input.assetId.toLowerCase())
    if (asset.profileClass === 'VTT_MAP') throw new Error('File is unavailable.')
    if (asset.operation) throw new Error('File processing is still running. Try again shortly.')
    if (asset.status === 'READY')
      return { kind: 'CURRENT', result: { assetId: asset.id, status: 'READY', preview: null } }
    if (asset.status !== 'PENDING_UPLOAD' || !asset.rawObjectKey)
      throw new Error('File is unavailable.')
    const text = asset.profileClass === 'TEXT_FILE'
    const operationId = crypto.randomUUID()
    const operation = mediaProcessingOperationSchema.parse({
      id: operationId,
      expiresAt: Date.now() + 15 * 60_000,
      outputs: (text ? (['SOURCE'] as const) : (['SOURCE', 'DISPLAY', 'THUMBNAIL'] as const)).map(
        (kind) => ({
          kind,
          objectKey: `ready/${asset.id}/${operationId}/${kind.toLowerCase()}.${text ? 'txt' : 'webp'}`
        })
      ),
      binding: null
    })
    await ctx.db.patch(asset._id, { status: 'PROCESSING', operation })
    await ctx.scheduler.runAt(operation.expiresAt, internal.media.assets.expireOperation, {
      assetId: asset.id,
      operationId: operation.id
    })
    return {
      kind: 'PROCESS',
      asset: storedImage({ ...asset, status: 'PROCESSING', operation }),
      operation
    }
  }
})

export const finishFinalize = internalMutation({
  args: zodToConvexFields(campaignFileFinalizeInputSchema.shape),
  returns: zodToConvex(finalizeImageUploadOutputSchema),
  handler: async (ctx, args): Promise<FinalizeImageUploadOutput> => {
    const input = campaignFileFinalizeInputSchema.parse(args)
    const { authenticated, asset } = await ownedAsset(ctx, input.assetId.toLowerCase())
    const operation = asset.profileClass === 'VTT_MAP' ? null : asset.operation
    if (
      asset.profileClass === 'VTT_MAP' ||
      asset.status !== 'PROCESSING' ||
      !operation ||
      operation.binding !== null ||
      operation.id !== input.operationId ||
      Date.now() >= operation.expiresAt
    )
      throw new Error('File processing is no longer current.')
    if (
      input.variants.length !== operation.outputs.length ||
      new Set(input.variants.map((variant) => variant.kind)).size !== input.variants.length ||
      input.variants.some(
        (variant) =>
          !operation.outputs.some(
            (output) => output.kind === variant.kind && output.objectKey === variant.objectKey
          )
      )
    )
      throw new Error('Processed file output mismatch.')
    const duplicate = await reuseDuplicate(
      ctx,
      authenticated.profile,
      asset,
      input.contentHash,
      input.variants.map((variant) => variant.objectKey)
    )
    if (duplicate) return { assetId: duplicate.id, status: 'READY', preview: null }
    const bytes = input.variants.reduce((sum, variant) => sum + variant.byteSize, 0)
    const cleanupAt = Date.now() + 24 * 60 * 60_000
    const ready = storedImage({
      ...asset,
      status: 'READY',
      variants: input.variants,
      contentHash: input.contentHash,
      chargedBytes: bytes,
      operation: null,
      cleanupAt
    })
    try {
      await charge(ctx, authenticated.profile, bytes - asset.chargedBytes)
    } catch (error) {
      if (!(error instanceof MediaQuotaError)) throw error
      await ctx.db.patch(asset._id, { status: 'REJECTED' })
      return { assetId: asset.id, status: 'REJECTED', preview: null }
    }
    await ctx.db.patch(asset._id, {
      status: 'READY',
      variants: ready.variants,
      contentHash: input.contentHash,
      chargedBytes: bytes,
      operation: null,
      cleanupAt
    })
    await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, { assetId: asset.id })
    if (asset.rawObjectKey)
      await ctx.scheduler.runAt(
        Math.max(Date.now(), asset.uploadExpiresAt + 15 * 60_000),
        internal.media.assets.cleanupRaw,
        { assetId: asset.id }
      )
    return { assetId: asset.id, status: 'READY', preview: null }
  }
})

export const rejectFinalize = internalMutation({
  args: { assetId: v.string(), operationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Internal action failure may arrive after session revocation. It can reject only its
    // pre-issued operation, never choose keys or affect a replacement.
    const asset = await findAsset(ctx, args.assetId)
    if (!asset || asset.profileClass === 'VTT_MAP' || asset.operation?.id !== args.operationId)
      return null
    await ctx.db.patch(asset._id, { status: 'REJECTED' })
    return null
  }
})

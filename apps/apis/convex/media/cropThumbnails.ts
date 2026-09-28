import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { normalizedImageCropSchema } from '@artificer-toolkit/schema/api/media'
import {
  mediaCropThumbnailClaimSchema,
  mediaCropThumbnailSchema,
  type MediaCropThumbnailClaim
} from '@artificer-toolkit/schema/api/mediaAssets'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import { internalMutation } from '../lib/mutations'
import { cropHash } from './crops'

const OPERATION_WINDOW = 15 * 60_000
const thumbnailVariant = () => mediaCropThumbnailSchema.shape.variant

async function readAsset(ctx: QueryCtx, assetId: string) {
  return ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', assetId))
    .unique()
}

/** Crop hashes the asset's current references use. Every cropped slot references its owner's art. */
export async function cropsInUse(ctx: QueryCtx, asset: Doc<'mediaAssets'>) {
  const [profile, portraits, slots] = await Promise.all([
    ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', asset.ownerUserId))
      .unique(),
    ctx.db
      .query('characters')
      .withIndex('by_portraitAssetId', (q) => q.eq('portraitAssetId', asset.id))
      .take(64),
    ctx.db
      .query('authoredImageSlots')
      .withIndex('by_assetId', (q) => q.eq('assetId', asset.id))
      .take(64)
  ])
  const crops = [
    profile?.avatarAssetId === asset.id ? profile.avatarCrop : undefined,
    ...portraits.map((character) => character.portraitCrop),
    ...slots.map((slot) => slot.crop)
  ].filter((crop) => crop !== undefined && crop !== null)
  return new Set(await Promise.all(crops.map(cropHash)))
}

/** Removes derived thumbnails no current reference frames; they regenerate on the next read. */
export async function pruneCropThumbnails(ctx: MutationCtx, asset: Doc<'mediaAssets'>) {
  if (asset.profileClass !== 'CONTENT_ART' || asset.cropThumbnails.length === 0) return
  const used = await cropsInUse(ctx, asset)
  const retired = asset.cropThumbnails.filter((thumbnail) => !used.has(thumbnail.cropHash))
  if (retired.length === 0) return
  await ctx.db.patch(asset._id, {
    cropThumbnails: asset.cropThumbnails.filter((thumbnail) => used.has(thumbnail.cropHash))
  })
  await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, {
    keys: retired.map((thumbnail) => thumbnail.variant.objectKey)
  })
}

export const claim = internalMutation({
  args: { assetId: v.string(), crop: zodToConvex(normalizedImageCropSchema) },
  returns: zodToConvex(mediaCropThumbnailClaimSchema),
  handler: async (ctx, args): Promise<MediaCropThumbnailClaim> => {
    // Called only by delivery actions that already authorized this reader for the reference.
    const crop = normalizedImageCropSchema.parse(args.crop)
    const asset = await readAsset(ctx, args.assetId)
    if (!asset || asset.profileClass !== 'CONTENT_ART' || asset.status !== 'READY')
      throw new Error('Image is unavailable.')
    const hash = await cropHash(crop)
    const current = asset.cropThumbnails.find((thumbnail) => thumbnail.cropHash === hash)
    if (current) return { kind: 'READY', variant: current.variant }
    if (!(await cropsInUse(ctx, asset)).has(hash)) throw new Error('Image is unavailable.')
    const objectKey = `ready/${asset.id}/crop/${hash}/${crypto.randomUUID()}.webp`
    // The key stays fenced for deletion until `record` commits it.
    await ctx.scheduler.runAfter(OPERATION_WINDOW, internal.media.cropThumbnails.retireUnrecorded, {
      assetId: asset.id,
      objectKey
    })
    return { kind: 'GENERATE', objectKey }
  }
})

export const record = internalMutation({
  args: {
    assetId: v.string(),
    crop: zodToConvex(normalizedImageCropSchema),
    variant: zodToConvex(thumbnailVariant())
  },
  returns: zodToConvex(thumbnailVariant()),
  handler: async (ctx, args) => {
    const crop = normalizedImageCropSchema.parse(args.crop)
    const variant = thumbnailVariant().parse(args.variant)
    const asset = await readAsset(ctx, args.assetId)
    if (!asset || asset.profileClass !== 'CONTENT_ART' || asset.status !== 'READY')
      throw new Error('Image is unavailable.')
    const cropHashValue = await cropHash(crop)
    const current = asset.cropThumbnails.find((thumbnail) => thumbnail.cropHash === cropHashValue)
    // A concurrent reader recorded the same framing first; its thumbnail wins.
    if (current) return current.variant
    if (asset.cropThumbnails.length >= 32) throw new Error('Image framing is unavailable.')
    await ctx.db.patch(asset._id, {
      cropThumbnails: [
        ...asset.cropThumbnails,
        mediaCropThumbnailSchema.parse({ cropHash: cropHashValue, crop, variant })
      ]
    })
    return variant
  }
})

export const retireUnrecorded = internalMutation({
  args: { assetId: v.string(), objectKey: v.string() },
  returns: v.null(),
  handler: async (ctx, { assetId, objectKey }) => {
    const asset = await readAsset(ctx, assetId)
    const recorded =
      asset?.profileClass === 'CONTENT_ART' &&
      asset.cropThumbnails.some((thumbnail) => thumbnail.variant.objectKey === objectKey)
    if (!recorded)
      await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, { keys: [objectKey] })
    return null
  }
})

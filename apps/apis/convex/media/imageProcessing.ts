'use node'

import type { ActionCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import {
  signedImageDeliveryDtoSchema,
  type MediaVariantKind,
  type NormalizedImageCrop,
  type SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import {
  mediaStoredVariantSchema,
  type MediaCropThumbnailClaim,
  type MediaReferencedImage,
  type MediaStoredAsset,
  type MediaStoredVariant
} from '@artificer-toolkit/schema/api/mediaAssets'
import { createMediaStorage } from './storage'
import { readMediaBytes } from './byteTransfer'
import { cropHash } from './crops'
import { cropMediaThumbnail, processMedia, MediaValidationError } from './processing'

// Authorization/operation claiming and final attachment stay in the owning domain.
export async function processImageClaim(
  ctx: ActionCtx,
  asset: MediaStoredAsset,
  operation: NonNullable<MediaStoredAsset['operation']>
): Promise<{ variants: MediaStoredVariant[]; contentHash: string }> {
  if (!asset.rawObjectKey) throw new MediaValidationError('Upload is unavailable.')
  const storage = createMediaStorage()
  const bytes = await readMediaBytes(
    await storage.getUrl(asset.rawObjectKey, { expiresIn: 300 }),
    6 * 1024 * 1024
  )
  const processed = await processMedia(bytes, asset.profileClass, asset.upload.declaredMimeType)
  const variants: MediaStoredVariant[] = []
  // Await each write: no sibling upload can finish after failure cleanup.
  for (const variant of processed.variants) {
    const output = operation.outputs.find((item) => item.kind === variant.kind)
    if (!output) throw new MediaValidationError('Image output is unavailable.')
    const stored = mediaStoredVariantSchema.parse({
      kind: variant.kind,
      objectKey: output.objectKey,
      byteSize: variant.bytes.byteLength,
      width: variant.width,
      height: variant.height,
      mimeType: variant.mimeType
    })
    await storage.store(ctx, variant.bytes, { key: stored.objectKey, type: stored.mimeType })
    variants.push(stored)
  }
  return { variants, contentHash: processed.contentHash }
}

/** The reference's framed thumbnail, derived from SOURCE the first time any reader needs it. */
async function cropThumbnail(ctx: ActionCtx, asset: MediaStoredAsset, crop: NormalizedImageCrop) {
  const hash = await cropHash(crop)
  const current = asset.cropThumbnails.find((thumbnail) => thumbnail.cropHash === hash)
  if (current) return current.variant
  const claim: MediaCropThumbnailClaim = await ctx.runMutation(
    internal.media.cropThumbnails.claim,
    { assetId: asset.id, crop }
  )
  if (claim.kind === 'READY') return claim.variant
  const source = asset.variants.find((item) => item.kind === 'SOURCE')
  if (!source) throw new Error('Image is unavailable.')
  const storage = createMediaStorage()
  const thumbnail = await cropMediaThumbnail(
    await readMediaBytes(
      await storage.getUrl(source.objectKey, { expiresIn: 300 }),
      source.byteSize
    ),
    crop
  )
  await storage.store(ctx, thumbnail.bytes, { key: claim.objectKey, type: thumbnail.mimeType })
  return ctx.runMutation(internal.media.cropThumbnails.record, {
    assetId: asset.id,
    crop,
    variant: {
      kind: 'THUMBNAIL',
      objectKey: claim.objectKey,
      byteSize: thumbnail.bytes.byteLength,
      width: thumbnail.width,
      height: thumbnail.height,
      mimeType: 'image/webp'
    }
  })
}

/** Signs one variant of a slot's image; THUMBNAIL is that slot's own framing when it has one. */
export async function deliverReferencedImage(
  ctx: ActionCtx,
  image: MediaReferencedImage | null,
  variantKind: MediaVariantKind,
  isDecorative: boolean
): Promise<SignedImageDeliveryDto | null> {
  if (!image) return null
  const variant =
    variantKind === 'THUMBNAIL' && image.crop
      ? await cropThumbnail(ctx, image.asset, image.crop)
      : image.asset.variants.find((item) => item.kind === variantKind)
  if (!variant || variant.mimeType !== 'image/webp') throw new Error('Image is unavailable.')
  return signedImageDeliveryDtoSchema.parse({
    assetId: image.asset.id,
    variantKind,
    url: await createMediaStorage().getUrl(variant.objectKey, { expiresIn: 300 }),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    width: variant.width,
    height: variant.height,
    mimeType: variant.mimeType,
    crop: image.crop,
    altText: null,
    isDecorative
  })
}

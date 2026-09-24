'use node'

import type { ActionCtx } from '../_generated/server'
import {
  mediaStoredVariantSchema,
  type MediaStoredAsset,
  type MediaStoredVariant
} from '@artificer-toolkit/schema/api/mediaAssets'
import { createMediaStorage } from './storage'
import { readMediaBytes } from './byteTransfer'
import {
  cropMediaThumbnail,
  processMedia,
  MediaValidationError,
  type ProcessedMedia
} from './processing'

// Authorization/operation claiming and final attachment stay in the owning domain.
export async function processImageClaim(
  ctx: ActionCtx,
  asset: MediaStoredAsset,
  operation: NonNullable<MediaStoredAsset['operation']>
): Promise<MediaStoredVariant[]> {
  const storage = createMediaStorage()
  let variants: ProcessedMedia['variants']
  const cloned = 'sourceVariants' in operation ? operation.sourceVariants : undefined
  if (cloned) {
    // A crop changes only framing. Copy verified variants byte-for-byte to their new keys.
    variants = []
    for (const variant of [cloned.source, cloned.display]) {
      const bytes = await readMediaBytes(
        await storage.getUrl(variant.objectKey, { expiresIn: 300 }),
        variant.byteSize
      )
      if (bytes.byteLength !== variant.byteSize)
        throw new MediaValidationError('Image data is incomplete.')
      variants.push({
        kind: variant.kind,
        width: variant.width,
        height: variant.height,
        mimeType: variant.mimeType,
        bytes
      })
    }
    variants.push(await cropMediaThumbnail(variants[0].bytes, operation.crop))
  } else if (operation.kind === 'INITIAL') {
    if (!asset.rawObjectKey) throw new MediaValidationError('Upload is unavailable.')
    const bytes = await readMediaBytes(
      await storage.getUrl(asset.rawObjectKey, { expiresIn: 300 }),
      6 * 1024 * 1024
    )
    const processed = await processMedia(bytes, asset.profile, asset.upload.declaredMimeType)
    const source = processed.variants.find((item) => item.kind === 'SOURCE')
    if (!source) throw new MediaValidationError('Image source is unavailable.')
    variants = [
      ...processed.variants.filter((item) => item.kind !== 'THUMBNAIL'),
      await cropMediaThumbnail(source.bytes, operation.crop)
    ]
  } else {
    const source = asset.variants.find((item) => item.kind === 'SOURCE')
    if (!source) throw new MediaValidationError('Image source is unavailable.')
    const bytes = await readMediaBytes(
      await storage.getUrl(source.objectKey, { expiresIn: 300 }),
      source.byteSize
    )
    variants = [await cropMediaThumbnail(bytes, operation.crop)]
  }
  const outputs: MediaStoredVariant[] = []
  // Await each write: no sibling upload can finish after failure cleanup.
  for (const variant of variants) {
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
    outputs.push(stored)
  }
  return outputs
}

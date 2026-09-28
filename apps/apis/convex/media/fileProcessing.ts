'use node'

import type { ActionCtx } from '../_generated/server'
import {
  mediaStoredFileVariantSchema,
  type MediaStoredAsset,
  type MediaStoredFileVariant
} from '@artificer-toolkit/schema/api/mediaAssets'
import { readMediaBytes } from './byteTransfer'
import { processMedia, MediaValidationError } from './processing'
import { createMediaStorage } from './storage'

export async function processCampaignFileClaim(
  ctx: ActionCtx,
  asset: MediaStoredAsset,
  operation: NonNullable<MediaStoredAsset['operation']>
): Promise<{ variants: MediaStoredFileVariant[]; contentHash: string }> {
  if (!asset.rawObjectKey) throw new MediaValidationError('Upload is unavailable.')
  const storage = createMediaStorage()
  const bytes = await readMediaBytes(
    await storage.getUrl(asset.rawObjectKey, { expiresIn: 300 }),
    6 * 1024 * 1024,
    'File'
  )
  if (bytes.byteLength !== asset.upload.declaredBytes)
    throw new MediaValidationError('File byte count does not match the upload intent.')
  const processed = await processMedia(bytes, asset.profileClass, asset.upload.declaredMimeType)
  const variants: MediaStoredFileVariant[] = []
  // Persist only preclaimed keys, sequentially; late writes remain covered by the operation fence.
  for (const variant of processed.variants) {
    const output = operation.outputs.find((item) => item.kind === variant.kind)
    if (!output) throw new MediaValidationError('File output is unavailable.')
    const stored = mediaStoredFileVariantSchema.parse({
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

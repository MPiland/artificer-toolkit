'use node'

import type { ActionCtx } from '../_generated/server'
import {
  vttMapStoredVariantSchema,
  type VttMapStoredAsset,
  type VttMapStoredVariant
} from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { readMediaBytes } from './byteTransfer'
import { MediaValidationError, processMedia } from './processing'
import { createMediaStorage } from './storage'

const MAX_BYTES = 25 * 1024 * 1024

export async function processVttMapClaim(
  ctx: ActionCtx,
  asset: VttMapStoredAsset,
  operation: NonNullable<VttMapStoredAsset['operation']>
): Promise<{
  width: number
  height: number
  variants: VttMapStoredVariant[]
  contentHash: string
}> {
  if (!asset.rawObjectKey) throw new MediaValidationError('Map upload is unavailable.')
  const storage = createMediaStorage()
  const bytes = await readMediaBytes(
    await storage.getUrl(asset.rawObjectKey, { expiresIn: 300 }),
    MAX_BYTES,
    'Map'
  )
  if (bytes.byteLength !== asset.upload.declaredBytes)
    throw new MediaValidationError('Map byte count does not match the upload intent.')
  const processed = await processMedia(bytes, 'VTT_MAP', asset.upload.declaredMimeType)
  const variants: VttMapStoredVariant[] = []
  for (const [index, variant] of processed.variants.entries()) {
    const objectKey = operation.outputs[index]?.objectKey
    if (!objectKey || variant.kind === 'SOURCE')
      throw new MediaValidationError('Map output is unavailable.')
    const stored = vttMapStoredVariantSchema.parse({
      kind: variant.kind,
      objectKey,
      byteSize: variant.bytes.byteLength,
      width: variant.width,
      height: variant.height,
      mimeType: variant.mimeType
    })
    await storage.store(ctx, variant.bytes, {
      key: stored.objectKey,
      type: stored.mimeType
    })
    variants.push(stored)
  }
  for (const tile of processed.tiles) {
    const objectKey = operation.outputs[2 + tile.row * 8 + tile.column]?.objectKey
    if (!objectKey) throw new MediaValidationError('Map tile output is unavailable.')
    const stored = vttMapStoredVariantSchema.parse({
      kind: 'TILE',
      row: tile.row,
      column: tile.column,
      objectKey,
      byteSize: tile.bytes.byteLength,
      width: tile.width,
      height: tile.height,
      mimeType: tile.mimeType
    })
    await storage.store(ctx, tile.bytes, {
      key: stored.objectKey,
      type: stored.mimeType
    })
    variants.push(stored)
  }
  return {
    width: processed.width,
    height: processed.height,
    variants,
    contentHash: processed.contentHash
  }
}

'use node'

import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  finalizeImageUploadInputSchema,
  finalizeVttMapUploadOutputSchema,
  signedVttMapDeliveryDtoSchema,
  type FinalizeVttMapUploadOutput,
  type SignedVttMapDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import type {
  VttMapProcessClaim,
  VttMapStoredAsset
} from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { MediaValidationError } from './processing'
import { processVttMapClaim } from './vttMapProcessing'
import { createMediaStorage } from './storage'

export const getDelivery = action({
  args: zodToConvexFields(finalizeImageUploadInputSchema.shape),
  returns: zodToConvex(signedVttMapDeliveryDtoSchema),
  handler: async (ctx, args): Promise<SignedVttMapDeliveryDto> => {
    const asset: VttMapStoredAsset = await ctx.runQuery(
      internal.media.vttMapAssets.readDelivery,
      finalizeImageUploadInputSchema.parse(args)
    )
    const overview = asset.variants.find((variant) => variant.kind === 'DISPLAY')
    const tiles = asset.variants
      .filter((variant) => variant.kind === 'TILE')
      .sort((left, right) => left.row - right.row || left.column - right.column)
    if (!overview || asset.width === null || asset.height === null || tiles.length === 0)
      throw new Error('Map is unavailable.')
    const storage = createMediaStorage()
    const expiresAt = new Date(Date.now() + 300_000).toISOString()
    const [overviewUrl, ...tileUrls] = await Promise.all([
      storage.getUrl(overview.objectKey, { expiresIn: 300 }),
      ...tiles.map((tile) => storage.getUrl(tile.objectKey, { expiresIn: 300 }))
    ])
    return signedVttMapDeliveryDtoSchema.parse({
      assetId: asset.id,
      expiresAt,
      width: asset.width,
      height: asset.height,
      overview: { url: overviewUrl, width: overview.width, height: overview.height },
      tiles: tiles.map((tile, index) => ({
        column: tile.column,
        row: tile.row,
        width: tile.width,
        height: tile.height,
        url: tileUrls[index]!
      }))
    })
  }
})

export const finalize = action({
  args: zodToConvexFields(finalizeImageUploadInputSchema.shape),
  returns: zodToConvex(finalizeVttMapUploadOutputSchema),
  handler: async (ctx, args): Promise<FinalizeVttMapUploadOutput> => {
    const claim: VttMapProcessClaim = await ctx.runMutation(
      internal.media.vttMapAssets.beginFinalize,
      finalizeImageUploadInputSchema.parse(args)
    )
    if (claim.kind === 'CURRENT') return claim.result
    const operation = {
      assetId: claim.asset.id,
      operationId: claim.operation.id
    }
    try {
      const processed = await processVttMapClaim(ctx, claim.asset, claim.operation)
      return await ctx.runMutation(internal.media.vttMapAssets.finishFinalize, {
        ...operation,
        ...processed
      })
    } catch (error) {
      if (error instanceof MediaValidationError) {
        await ctx.runMutation(internal.media.vttMapAssets.rejectFinalize, operation)
        return { assetId: claim.asset.id, status: 'REJECTED' }
      }
      await ctx.runMutation(internal.media.assets.failSave, operation)
      throw new Error('Could not finalize the map. Try again.')
    }
  }
})

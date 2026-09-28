'use node'

import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  mediaLibraryImageInputSchema,
  type MediaStoredVariant
} from '@artificer-toolkit/schema/api/mediaAssets'
import {
  signedImageDeliveryDtoSchema,
  type SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { createMediaStorage } from './storage'

export const getImage = action({
  args: zodToConvexFields(mediaLibraryImageInputSchema.shape),
  returns: zodToConvex(signedImageDeliveryDtoSchema),
  handler: async (ctx, args): Promise<SignedImageDeliveryDto> => {
    const input = mediaLibraryImageInputSchema.parse(args)
    const variant: MediaStoredVariant | null = await ctx.runQuery(
      internal.media.library.readOwnedVariant,
      input
    )
    if (!variant) throw new Error('Image is unavailable.')
    return signedImageDeliveryDtoSchema.parse({
      assetId: input.assetId,
      variantKind: input.variantKind,
      url: await createMediaStorage().getUrl(variant.objectKey, { expiresIn: 300 }),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      width: variant.width,
      height: variant.height,
      mimeType: variant.mimeType,
      crop: null,
      altText: null,
      isDecorative: true
    })
  }
})

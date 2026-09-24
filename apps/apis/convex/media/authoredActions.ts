'use node'

import * as zMini from 'zod/mini'

import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredImageLookupSchema,
  authoredImageSaveSchema,
  avatarBindingSchema,
  type AvatarBindingDto,
  type AuthoredImageProcessClaim,
  type MediaStoredAsset
} from '@artificer-toolkit/schema/api/mediaAssets'
import {
  mediaVariantKindSchema,
  signedImageDeliveryDtoSchema,
  type SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { createMediaStorage } from './storage'
import { processImageClaim } from './imageProcessing'
import { MediaValidationError } from './processing'

export const save = action({
  args: zodToConvexFields(authoredImageSaveSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args): Promise<AvatarBindingDto> => {
    const claim: AuthoredImageProcessClaim = await ctx.runMutation(
      internal.media.authoredAssets.beginSave,
      authoredImageSaveSchema.parse(args)
    )
    if (claim.kind === 'CURRENT') return claim.binding
    try {
      const variants = await processImageClaim(ctx, claim.asset, claim.operation)
      return await ctx.runMutation(internal.media.authoredAssets.finishSave, {
        assetId: claim.asset.id,
        operationId: claim.operation.id,
        variants
      })
    } catch (error) {
      await ctx.runMutation(internal.media.assets.failSave, {
        assetId: claim.asset.id,
        operationId: claim.operation.id
      })
      throw new Error(
        error instanceof MediaValidationError
          ? error.message
          : 'Could not save the image. Try again.'
      )
    }
  }
})

export const getImage = action({
  args: {
    target: zodToConvex(authoredImageLookupSchema),
    variantKind: zodToConvex(mediaVariantKindSchema)
  },
  returns: zodToConvex(zMini.nullable(signedImageDeliveryDtoSchema)),
  handler: async (ctx, { target, variantKind }): Promise<SignedImageDeliveryDto | null> => {
    const asset: MediaStoredAsset | null = await ctx.runQuery(
      internal.media.authoredAssets.read,
      target
    )
    if (!asset) return null
    const variant = asset.variants.find((item) => item.kind === variantKind)
    if (!variant) throw new Error('Image is unavailable.')
    return signedImageDeliveryDtoSchema.parse({
      assetId: asset.id,
      variantKind,
      url: await createMediaStorage().getUrl(variant.objectKey, { expiresIn: 300 }),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      width: variant.width,
      height: variant.height,
      mimeType: variant.mimeType,
      crop: asset.crop,
      altText: null,
      isDecorative: true
    })
  }
})

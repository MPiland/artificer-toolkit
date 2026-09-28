'use node'

import * as zMini from 'zod/mini'

import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  avatarBindingSchema,
  characterPortraitLookupSchema,
  characterPortraitSaveSchema,
  type AvatarBindingDto,
  type MediaProcessClaim,
  type MediaReferencedImage
} from '@artificer-toolkit/schema/api/mediaAssets'
import {
  mediaVariantKindSchema,
  signedImageDeliveryDtoSchema,
  type SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { deliverReferencedImage, processImageClaim } from './imageProcessing'
import { MediaValidationError } from './processing'

export const save = action({
  args: zodToConvexFields(characterPortraitSaveSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args): Promise<AvatarBindingDto> => {
    const claim: MediaProcessClaim = await ctx.runMutation(
      internal.media.characterPortraitAssets.beginSave,
      characterPortraitSaveSchema.parse(args)
    )
    if (claim.kind === 'CURRENT') return claim.binding
    try {
      const processed = await processImageClaim(ctx, claim.asset, claim.operation)
      return await ctx.runMutation(internal.media.imageSaves.finish, {
        assetId: claim.asset.id,
        operationId: claim.operation.id,
        ...processed
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
    target: zodToConvex(characterPortraitLookupSchema),
    variantKind: zodToConvex(mediaVariantKindSchema)
  },
  returns: zodToConvex(zMini.nullable(signedImageDeliveryDtoSchema)),
  handler: async (ctx, { target, variantKind }): Promise<SignedImageDeliveryDto | null> => {
    const image: MediaReferencedImage | null = await ctx.runQuery(
      internal.media.characterPortraitAssets.read,
      target
    )
    return deliverReferencedImage(ctx, image, variantKind, false)
  }
})

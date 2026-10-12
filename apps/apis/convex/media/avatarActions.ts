'use node'

import * as zMini from 'zod/mini'

import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { publicProfileInputSchema } from '@artificer-toolkit/schema/api/account'
import {
  avatarBindingSchema,
  avatarSaveInputSchema,
  type AvatarBindingDto,
  type MediaProcessClaim,
  type MediaReferencedImage
} from '@artificer-toolkit/schema/api/mediaAssets'
import {
  mediaVariantKindSchema,
  signedImageDeliveryDtoSchema,
  type SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import { action, internalAction } from '../_generated/server'
import { components, internal } from '../_generated/api'
import { createMediaStorage } from './storage'
import { MediaValidationError } from './processing'
import { deliverReferencedImage, processImageClaim } from './imageProcessing'

export const deleteObjectBytes = internalAction({
  args: { keys: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { keys }): Promise<null> => {
    if (keys.length > 7) throw new Error('Unexpected image object count.')
    const storage = createMediaStorage()
    for (const key of new Set(keys)) {
      // Unlike R2.deleteObject(), this returns only after provider confirmation.
      await ctx.runAction(components.r2.lib.deleteR2Object, { ...storage.config, key })
      await ctx.runMutation(components.r2.lib.deleteMetadata, {
        bucket: storage.config.bucket,
        key
      })
    }
    return null
  }
})

export const saveAvatar = action({
  args: zodToConvexFields(avatarSaveInputSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args): Promise<AvatarBindingDto> => {
    const claim: MediaProcessClaim = await ctx.runMutation(
      internal.media.assets.beginSave,
      avatarSaveInputSchema.parse(args)
    )
    if (claim.kind === 'CURRENT') return claim.binding
    const { asset, operation } = claim
    try {
      const processed = await processImageClaim(ctx, asset, operation)
      return await ctx.runMutation(internal.media.imageSaves.finish, {
        assetId: asset.id,
        operationId: operation.id,
        ...processed
      })
    } catch (error) {
      await ctx.runMutation(internal.media.assets.failSave, {
        assetId: asset.id,
        operationId: operation.id
      })
      throw new Error(
        error instanceof MediaValidationError
          ? error.message
          : 'Could not save the image. Try again.'
      )
    }
  }
})

export const getAvatarImage = action({
  args: { variantKind: zodToConvex(mediaVariantKindSchema) },
  returns: zodToConvex(zMini.nullable(signedImageDeliveryDtoSchema)),
  handler: async (ctx, { variantKind }): Promise<SignedImageDeliveryDto | null> => {
    const image: MediaReferencedImage | null = await ctx.runQuery(
      internal.media.assets.readAvatar,
      {}
    )
    return deliverReferencedImage(ctx, image, variantKind, false)
  }
})

export const getProfileAvatarImage = action({
  args: {
    ...zodToConvexFields(publicProfileInputSchema.shape),
    variantKind: zodToConvex(mediaVariantKindSchema)
  },
  returns: zodToConvex(zMini.nullable(signedImageDeliveryDtoSchema)),
  handler: async (ctx, { variantKind, ...profile }): Promise<SignedImageDeliveryDto | null> => {
    const image: MediaReferencedImage | null = await ctx.runQuery(
      internal.media.assets.readProfileAvatar,
      publicProfileInputSchema.parse(profile)
    )
    return deliverReferencedImage(ctx, image, variantKind, false)
  }
})

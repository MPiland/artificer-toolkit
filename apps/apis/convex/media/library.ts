import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  avatarBindingSchema,
  mediaImageAttachInputSchema,
  mediaLibraryImageInputSchema,
  mediaLibraryListInputSchema,
  mediaLibraryPageSchema,
  mediaStoredVariantSchema,
  type AvatarBindingDto,
  type MediaLibraryPage
} from '@artificer-toolkit/schema/api/mediaAssets'
import { query, internalQuery } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile } from '../lib/identity'
import { attachAvatar, ownedAsset } from './assets'
import { attachArtwork } from './authoredAssets'
import { attachPortrait } from './characterPortraitAssets'

/** "My images": the caller's own READY assets of one class, newest first. */
export const list = query({
  args: zodToConvexFields(mediaLibraryListInputSchema.shape),
  returns: zodToConvex(mediaLibraryPageSchema),
  handler: async (ctx, args): Promise<MediaLibraryPage> => {
    const input = mediaLibraryListInputSchema.parse(args)
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    const result = await ctx.db
      .query('mediaAssets')
      .withIndex('by_ownerUserId_profileClass_status', (q) =>
        q
          .eq('ownerUserId', authenticated.identity.userId)
          .eq('profileClass', input.profileClass)
          .eq('status', 'READY')
      )
      .order('desc')
      .paginate({ ...input.paginationOpts, maximumRowsRead: 48, maximumBytesRead: 1024 * 1024 })
    return mediaLibraryPageSchema.parse({
      ...result,
      page: result.page.map((asset) => {
        const size =
          asset.profileClass === 'VTT_MAP'
            ? asset
            : (asset.variants.find((variant) => variant.kind === 'SOURCE') ?? null)
        return {
          assetId: asset.id,
          profileClass: asset.profileClass,
          originalFileName: asset.upload.originalFileName,
          width: size?.width ?? null,
          height: size?.height ?? null,
          createdAt: new Date(asset._creationTime).toISOString()
        }
      })
    })
  }
})

/**
 * Attaches one of the caller's own images to a cropped slot. The slot's domain applies its own
 * write rules and framing, exactly as it does when binding a fresh upload.
 */
export const attachImage = mutation({
  args: zodToConvexFields(mediaImageAttachInputSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args): Promise<AvatarBindingDto> => {
    const { target, assetId, crop } = mediaImageAttachInputSchema.parse(args)
    if (target.type === 'ACCOUNT_AVATAR') return attachAvatar(ctx, assetId, crop)
    if (target.type === 'CHARACTER_PORTRAIT') return attachPortrait(ctx, target, assetId, crop)
    return attachArtwork(ctx, target, assetId, crop)
  }
})

/** Owner-only preview of an unattached image variant for the picker; never a slot's framing. */
export const readOwnedVariant = internalQuery({
  args: zodToConvexFields(mediaLibraryImageInputSchema.shape),
  returns: zodToConvex(zMini.nullable(mediaStoredVariantSchema)),
  handler: async (ctx, args) => {
    const input = mediaLibraryImageInputSchema.parse(args)
    const { asset } = await ownedAsset(ctx, input.assetId.toLowerCase())
    if (asset.status !== 'READY') throw new Error('Image is unavailable.')
    const variant = asset.variants.find((item) => item.kind === input.variantKind)
    return variant?.mimeType === 'image/webp' ? mediaStoredVariantSchema.parse(variant) : null
  }
})

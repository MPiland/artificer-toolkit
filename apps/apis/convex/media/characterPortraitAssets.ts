import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { NormalizedImageCrop } from '@artificer-toolkit/schema/api/media'
import {
  avatarBindingSchema,
  characterPortraitLookupSchema,
  characterPortraitSaveSchema,
  characterPortraitTargetSchema,
  characterPortraitUploadSchema,
  mediaProcessClaimSchema,
  mediaReferencedImageSchema,
  mediaSinglePutUploadSchema,
  type AvatarBindingDto,
  type CharacterPortraitLookup,
  type CharacterPortraitTarget,
  type MediaProcessClaim
} from '@artificer-toolkit/schema/api/mediaAssets'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { query, internalQuery } from '../lib/queries'
import { mutation, internalMutation } from '../lib/mutations'
import { getAuthenticatedProfile } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  beginImageUpload,
  createMediaUpload,
  findAsset,
  ownedAsset,
  releaseAsset,
  requireAttachableImage,
  storedImage
} from './assets'
import { sameCrop } from './crops'

function binding(character: { portraitAssetId?: string; portraitRevision?: number }) {
  return { assetId: character.portraitAssetId ?? null, revision: character.portraitRevision ?? 0 }
}

export async function ownedCharacter(ctx: QueryCtx | MutationCtx, target: CharacterPortraitTarget) {
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  const character = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', target.characterId))
    .unique()
  if (!character || character.userId !== authenticated.identity.userId)
    throw new Error('Character is unavailable.')
  return { authenticated, character }
}

/**
 * The owner reads their Character's portrait. With a Campaign scope, any active member of that
 * Campaign reads the portrait of a Character assigned in it, and nothing else (ADR 0034, D36).
 */
async function readableCharacter(ctx: QueryCtx, target: CharacterPortraitLookup) {
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  const character = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', target.characterId))
    .unique()
  if (!target.campaignId)
    return character?.userId === authenticated.identity.userId ? character : null
  const { campaign } = await requireCampaignAuthority(
    ctx,
    target.campaignId,
    authenticated.identity.userId
  )
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_characterId', (q) => q.eq('characterId', target.characterId.toLowerCase()))
    .unique()
  if (
    !character ||
    assignment?.campaignId !== campaign.id ||
    assignment.userId !== character.userId
  )
    throw new Error('Image is unavailable.')
  return character
}

export async function bindPortrait(
  ctx: MutationCtx,
  character: Doc<'characters'>,
  asset: Doc<'mediaAssets'>,
  crop: NormalizedImageCrop
): Promise<AvatarBindingDto> {
  const revision = (character.portraitRevision ?? 0) + 1
  await ctx.db.patch(character._id, {
    portraitAssetId: asset.id,
    portraitCrop: crop,
    portraitRevision: revision
  })
  await ctx.db.patch(asset._id, { cleanupAt: null })
  if (character.portraitAssetId) await releaseAsset(ctx, character.portraitAssetId)
  return { assetId: asset.id, revision }
}

export async function attachPortrait(
  ctx: MutationCtx,
  target: CharacterPortraitTarget,
  assetId: string,
  crop: NormalizedImageCrop
) {
  const { authenticated, character } = await ownedCharacter(ctx, target)
  const { asset } = await ownedAsset(ctx, assetId)
  if (character.portraitAssetId === asset.id && sameCrop(character.portraitCrop ?? null, crop))
    return binding(character)
  return bindPortrait(
    ctx,
    character,
    requireAttachableImage(asset, authenticated.identity.userId),
    crop
  )
}

export const bindingForCharacter = query({
  args: zodToConvexFields(characterPortraitLookupSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args) => {
    const character = await readableCharacter(ctx, characterPortraitLookupSchema.parse(args))
    return character ? binding(character) : { assetId: null, revision: 0 }
  }
})

export const createUpload = mutation({
  args: zodToConvexFields(characterPortraitUploadSchema.shape),
  returns: zodToConvex(mediaSinglePutUploadSchema),
  handler: async (ctx, args) => {
    const { target, ...input } = characterPortraitUploadSchema.parse(args)
    await ownedCharacter(ctx, target)
    return createMediaUpload(ctx, input, target)
  }
})

export const beginSave = internalMutation({
  args: zodToConvexFields(characterPortraitSaveSchema.shape),
  returns: zodToConvex(mediaProcessClaimSchema),
  handler: async (ctx, args): Promise<MediaProcessClaim> => {
    const input = characterPortraitSaveSchema.parse(args)
    const { character } = await ownedCharacter(ctx, input.target)
    const { asset } = await ownedAsset(ctx, input.assetId)
    if (asset.status === 'READY')
      return {
        kind: 'CURRENT',
        binding: await attachPortrait(ctx, input.target, asset.id, input.crop)
      }
    return beginImageUpload(ctx, asset, {
      ...input.target,
      crop: input.crop,
      expectedRevision: character.portraitRevision ?? 0
    })
  }
})

export const read = internalQuery({
  args: zodToConvexFields(characterPortraitLookupSchema.shape),
  returns: zodToConvex(zMini.nullable(mediaReferencedImageSchema)),
  handler: async (ctx, args) => {
    const character = await readableCharacter(ctx, characterPortraitLookupSchema.parse(args))
    if (!character?.portraitAssetId) return null
    const asset = await findAsset(ctx, character.portraitAssetId)
    if (!asset || asset.status !== 'READY' || asset.profileClass !== 'CONTENT_ART')
      throw new Error('Image is unavailable.')
    return { asset: storedImage(asset), crop: character.portraitCrop ?? null }
  }
})

export const remove = mutation({
  args: { target: zodToConvex(characterPortraitTargetSchema) },
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args) => {
    const { character } = await ownedCharacter(
      ctx,
      characterPortraitTargetSchema.parse(args.target)
    )
    if (!character.portraitAssetId) return binding(character)
    const revision = (character.portraitRevision ?? 0) + 1
    await ctx.db.patch(character._id, {
      portraitAssetId: undefined,
      portraitCrop: undefined,
      portraitRevision: revision
    })
    await releaseAsset(ctx, character.portraitAssetId)
    return { assetId: null, revision }
  }
})

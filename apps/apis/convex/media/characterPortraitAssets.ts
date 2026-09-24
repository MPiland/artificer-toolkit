import * as zMini from 'zod/mini'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  avatarBindingSchema,
  characterPortraitLookupSchema,
  characterPortraitOperationSchema,
  characterPortraitProcessClaimSchema,
  characterPortraitSaveSchema,
  characterPortraitTargetSchema,
  characterPortraitUploadSchema,
  mediaSinglePutUploadSchema,
  mediaStoredAssetSchema,
  mediaStoredVariantSchema,
  type CharacterPortraitTarget
} from '@artificer-toolkit/schema/api/mediaAssets'
import { query, internalQuery, type MutationCtx, type QueryCtx } from '../_generated/server'
import { mutation, internalMutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { getAuthenticatedProfile } from '../lib/identity'
import { charge, createMediaUpload, findAsset, ownedAsset } from './assets'

const GRACE = 24 * 60 * 60_000
const OPERATION_WINDOW = 15 * 60_000

function binding(character: { portraitAssetId?: string; portraitRevision?: number }) {
  return { assetId: character.portraitAssetId ?? null, revision: character.portraitRevision ?? 0 }
}

async function ownedCharacter(ctx: QueryCtx | MutationCtx, target: CharacterPortraitTarget) {
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

async function readableCharacter(ctx: QueryCtx, target: CharacterPortraitTarget) {
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  const character = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', target.characterId))
    .unique()
  return character?.userId === authenticated.identity.userId ? { authenticated, character } : null
}

export const bindingForCharacter = query({
  args: zodToConvexFields(characterPortraitLookupSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args) => {
    const readable = await readableCharacter(ctx, characterPortraitLookupSchema.parse(args))
    return readable ? binding(readable.character) : { assetId: null, revision: 0 }
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
  returns: zodToConvex(characterPortraitProcessClaimSchema),
  handler: async (ctx, args) => {
    const input = characterPortraitSaveSchema.parse(args)
    const { character } = await ownedCharacter(ctx, input.target)
    const { asset } = await ownedAsset(ctx, input.assetId)
    if (
      asset.profile !== 'CHARACTER_PORTRAIT' ||
      asset.characterTarget?.characterId !== input.target.characterId ||
      asset.operation ||
      (asset.status !== 'PENDING_UPLOAD' && asset.status !== 'READY')
    )
      throw new Error('Image is unavailable.')
    if (asset.status === 'PENDING_UPLOAD' && Date.now() > asset.uploadExpiresAt)
      throw new Error('Upload expired. Choose the image again.')
    if (
      asset.status === 'READY' &&
      character.portraitAssetId === asset.id &&
      asset.crop?.x === input.crop.x &&
      asset.crop.y === input.crop.y &&
      asset.crop.width === input.crop.width &&
      asset.crop.height === input.crop.height
    )
      return { kind: 'CURRENT' as const, binding: binding(character) }
    if (asset.status === 'READY' && character.portraitAssetId !== asset.id)
      throw new Error('Portrait changed. Reload before cropping.')
    const initial = asset.status === 'PENDING_UPLOAD'
    const operationId = crypto.randomUUID()
    const operation = characterPortraitOperationSchema.parse({
      id: operationId,
      kind: initial ? 'INITIAL' : 'CROP',
      crop: input.crop,
      target: input.target,
      expectedPortraitRevision: character.portraitRevision ?? 0,
      expiresAt: Date.now() + OPERATION_WINDOW,
      outputs: (initial ? ['SOURCE', 'DISPLAY', 'THUMBNAIL'] : ['THUMBNAIL']).map((kind) => ({
        kind,
        objectKey: `ready/${asset.id}/${operationId}/${kind.toLowerCase()}.webp`
      }))
    })
    await ctx.db.patch(asset._id, { status: initial ? 'PROCESSING' : 'READY', operation })
    await ctx.scheduler.runAt(operation.expiresAt, internal.media.assets.expireOperation, {
      assetId: asset.id,
      operationId
    })
    const { _id, _creationTime, ...stored } = asset
    return {
      kind: 'PROCESS' as const,
      asset: mediaStoredAssetSchema.parse(stored),
      operation
    }
  }
})

export const finishSave = internalMutation({
  args: {
    assetId: v.string(),
    operationId: v.string(),
    variants: v.array(zodToConvex(mediaStoredVariantSchema))
  },
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args) => {
    const { asset } = await ownedAsset(ctx, args.assetId)
    const operation = asset.operation
    if (
      asset.profile !== 'CHARACTER_PORTRAIT' ||
      !operation ||
      !('expectedPortraitRevision' in operation) ||
      operation.id !== args.operationId ||
      Date.now() >= operation.expiresAt ||
      asset.characterTarget?.characterId !== operation.target.characterId
    )
      throw new Error('Image processing is no longer current.')
    const { authenticated, character } = await ownedCharacter(ctx, operation.target)
    if ((character.portraitRevision ?? 0) !== operation.expectedPortraitRevision)
      throw new Error('Portrait changed during processing. Try again.')
    const outputs = args.variants.map((item) => mediaStoredVariantSchema.parse(item))
    if (
      outputs.length !== operation.outputs.length ||
      new Set(outputs.map((item) => item.kind)).size !== outputs.length ||
      outputs.some(
        (item) =>
          !operation.outputs.some(
            (expected) => expected.kind === item.kind && expected.objectKey === item.objectKey
          )
      )
    )
      throw new Error('Processed image output mismatch.')
    const variants = [
      ...asset.variants.filter((item) => !outputs.some((next) => next.kind === item.kind)),
      ...outputs
    ]
    if (variants.length !== 3) throw new Error('Processed image variants are incomplete.')
    const bytes = variants.reduce((sum, item) => sum + item.byteSize, 0)
    await charge(ctx, authenticated.profile, bytes - asset.chargedBytes)
    const previousId = character.portraitAssetId
    if (previousId && previousId !== asset.id) {
      const previous = await findAsset(ctx, previousId)
      if (
        !previous ||
        previous.ownerUserId !== asset.ownerUserId ||
        previous.profile !== 'CHARACTER_PORTRAIT' ||
        previous.characterTarget?.characterId !== operation.target.characterId
      )
        throw new Error('Stored portrait ownership mismatch.')
      const cleanupAt = Date.now() + GRACE
      await ctx.db.patch(previous._id, { cleanupAt })
      await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, { assetId: previous.id })
    }
    const retiredKeys = asset.variants
      .filter((old) => outputs.some((next) => next.kind === old.kind))
      .map((old) => old.objectKey)
    if (retiredKeys.length)
      await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, { keys: retiredKeys })
    await ctx.db.patch(asset._id, {
      status: 'READY',
      variants,
      crop: operation.crop,
      chargedBytes: bytes,
      operation: null,
      cleanupAt: null
    })
    const revision = (character.portraitRevision ?? 0) + 1
    await ctx.db.patch(character._id, { portraitAssetId: asset.id, portraitRevision: revision })
    if (asset.rawObjectKey)
      await ctx.scheduler.runAt(
        Math.max(Date.now(), asset.uploadExpiresAt + OPERATION_WINDOW),
        internal.media.assets.cleanupRaw,
        { assetId: asset.id }
      )
    return { assetId: asset.id, revision }
  }
})

export const read = internalQuery({
  args: zodToConvexFields(characterPortraitLookupSchema.shape),
  returns: zodToConvex(zMini.nullable(mediaStoredAssetSchema)),
  handler: async (ctx, args) => {
    const target = characterPortraitLookupSchema.parse(args)
    const readable = await readableCharacter(ctx, target)
    if (!readable) return null
    const { authenticated, character } = readable
    if (!character.portraitAssetId) return null
    const asset = await findAsset(ctx, character.portraitAssetId)
    if (
      !asset ||
      asset.ownerUserId !== authenticated.identity.userId ||
      asset.profile !== 'CHARACTER_PORTRAIT' ||
      asset.status !== 'READY' ||
      asset.characterTarget?.characterId !== target.characterId
    )
      throw new Error('Image is unavailable.')
    const { _id, _creationTime, ...stored } = asset
    return mediaStoredAssetSchema.parse(stored)
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
    const { asset } = await ownedAsset(ctx, character.portraitAssetId)
    if (
      asset.profile !== 'CHARACTER_PORTRAIT' ||
      asset.characterTarget?.characterId !== character.id
    )
      throw new Error('Image is unavailable.')
    const cleanupAt = Date.now() + GRACE
    await ctx.db.patch(asset._id, { cleanupAt })
    await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, { assetId: asset.id })
    const revision = (character.portraitRevision ?? 0) + 1
    await ctx.db.patch(character._id, { portraitAssetId: undefined, portraitRevision: revision })
    return { assetId: null, revision }
  }
})

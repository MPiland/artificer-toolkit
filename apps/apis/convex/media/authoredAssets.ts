import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { NormalizedImageCrop } from '@artificer-toolkit/schema/api/media'
import {
  authoredImageLookupSchema,
  authoredImageTargetSchema,
  authoredImageUploadSchema,
  authoredImageSaveSchema,
  avatarBindingSchema,
  mediaProcessClaimSchema,
  mediaReferencedImageSchema,
  mediaSinglePutUploadSchema,
  type AuthoredImageLookup,
  type AuthoredImageTarget,
  type AvatarBindingDto,
  type MediaProcessClaim
} from '@artificer-toolkit/schema/api/mediaAssets'
import type { Doc } from '../_generated/dataModel'
import { query, internalQuery, type MutationCtx, type QueryCtx } from '../_generated/server'
import { mutation, internalMutation } from '../lib/mutations'
import { getAuthenticatedProfile } from '../lib/identity'
import { canReadAuthoredRoot } from '../content/documents'
import { readImageSlot, ensureDraftImageSlot } from '../content/imageSlots'
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

export async function ownedDraft(ctx: QueryCtx, target: AuthoredImageTarget) {
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  const draft = await ctx.db
    .query('authoredDrafts')
    .withIndex('by_subjectId', (q) => q.eq('subjectId', target.subjectId))
    .unique()
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', target.subjectId))
    .unique()
  if (
    !draft ||
    draft.subjectKind !== target.subjectKind ||
    draft.userId !== authenticated.identity.userId ||
    (root &&
      (root.subjectKind !== target.subjectKind ||
        root.ownerUserId !== authenticated.identity.userId ||
        !(await canReadAuthoredRoot(ctx, root, authenticated.identity.userId))))
  )
    throw new Error('Save an owned draft before changing its artwork.')
  return { authenticated, draft }
}

async function readableSlot(ctx: QueryCtx, target: AuthoredImageLookup) {
  const authenticated = await getAuthenticatedProfile(ctx)
  const userId = authenticated?.identity.userId ?? null
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', target.subjectId))
    .unique()
  if (target.scope === 'ACTIVE') {
    if (
      !root ||
      root.subjectKind !== target.subjectKind ||
      !(await canReadAuthoredRoot(ctx, root, userId))
    )
      return null
  } else {
    const draft = await ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', target.subjectId))
      .unique()
    const ownsDraft =
      draft?.subjectKind === target.subjectKind && draft.userId === userId && userId !== null
    const ownsRoot =
      root?.subjectKind === target.subjectKind &&
      root.ownerUserId === userId &&
      userId !== null &&
      (await canReadAuthoredRoot(ctx, root, userId))
    if (!ownsDraft && !ownsRoot) return null
    if (root && !ownsRoot) return null
  }
  const slot =
    (await readImageSlot(ctx, target.subjectId, target.scope)) ??
    (target.scope === 'DRAFT' ? await readImageSlot(ctx, target.subjectId, 'ACTIVE') : null)
  if (slot && slot.subjectKind !== target.subjectKind)
    throw new Error('Stored artwork identity mismatch.')
  return slot
}

async function touchDraft(ctx: MutationCtx, draft: Doc<'authoredDrafts'>) {
  await ctx.db.patch(draft._id, {
    updatedAt: new Date(
      Math.max(Date.now(), (draft.updatedAt ? Date.parse(draft.updatedAt) : 0) + 1)
    ).toISOString()
  })
}

/** Artwork changes only the draft slot; ACTIVE keeps its own asset and framing until publication. */
export async function bindArtwork(
  ctx: MutationCtx,
  draft: Doc<'authoredDrafts'>,
  slot: Doc<'authoredImageSlots'>,
  asset: Doc<'mediaAssets'>,
  crop: NormalizedImageCrop
): Promise<AvatarBindingDto> {
  const revision = slot.revision + 1
  await ctx.db.patch(slot._id, { assetId: asset.id, crop, revision })
  await ctx.db.patch(asset._id, { cleanupAt: null })
  await touchDraft(ctx, draft)
  if (slot.assetId) await releaseAsset(ctx, slot.assetId)
  return { assetId: asset.id, revision }
}

export async function attachArtwork(
  ctx: MutationCtx,
  target: AuthoredImageTarget,
  assetId: string,
  crop: NormalizedImageCrop
) {
  const { authenticated, draft } = await ownedDraft(ctx, target)
  const { asset } = await ownedAsset(ctx, assetId)
  const slot = await ensureDraftImageSlot(ctx, target)
  if (slot.assetId === asset.id && sameCrop(slot.crop, crop))
    return { assetId: asset.id, revision: slot.revision }
  return bindArtwork(
    ctx,
    draft,
    slot,
    requireAttachableImage(asset, authenticated.identity.userId),
    crop
  )
}

export const binding = query({
  args: zodToConvexFields(authoredImageLookupSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args) => {
    const slot = await readableSlot(ctx, authoredImageLookupSchema.parse(args))
    return { assetId: slot?.assetId ?? null, revision: slot?.revision ?? 0 }
  }
})

export const read = internalQuery({
  args: zodToConvexFields(authoredImageLookupSchema.shape),
  returns: zodToConvex(zMini.nullable(mediaReferencedImageSchema)),
  handler: async (ctx, args) => {
    const slot = await readableSlot(ctx, authoredImageLookupSchema.parse(args))
    if (!slot?.assetId) return null
    const asset = await findAsset(ctx, slot.assetId)
    if (!asset || asset.profileClass !== 'CONTENT_ART' || asset.status !== 'READY')
      throw new Error('Image is unavailable.')
    return { asset: storedImage(asset), crop: slot.crop }
  }
})

export const createUpload = mutation({
  args: zodToConvexFields(authoredImageUploadSchema.shape),
  returns: zodToConvex(mediaSinglePutUploadSchema),
  handler: async (ctx, args) => {
    const { target, ...input } = authoredImageUploadSchema.parse(args)
    await ownedDraft(ctx, target)
    return createMediaUpload(ctx, input, target)
  }
})

export const beginSave = internalMutation({
  args: zodToConvexFields(authoredImageSaveSchema.shape),
  returns: zodToConvex(mediaProcessClaimSchema),
  handler: async (ctx, args): Promise<MediaProcessClaim> => {
    const input = authoredImageSaveSchema.parse(args)
    const { draft } = await ownedDraft(ctx, input.target)
    const { asset } = await ownedAsset(ctx, input.assetId)
    if (asset.status === 'READY')
      return {
        kind: 'CURRENT',
        binding: await attachArtwork(ctx, input.target, asset.id, input.crop)
      }
    const slot = await ensureDraftImageSlot(ctx, input.target)
    return beginImageUpload(ctx, asset, {
      ...input.target,
      draftId: draft._id,
      crop: input.crop,
      expectedRevision: slot.revision
    })
  }
})

export const remove = mutation({
  args: { target: zodToConvex(authoredImageTargetSchema) },
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args) => {
    const target = authoredImageTargetSchema.parse(args.target)
    const { draft } = await ownedDraft(ctx, target)
    const slot = await ensureDraftImageSlot(ctx, target)
    const revision = slot.revision + 1
    await ctx.db.patch(slot._id, { assetId: null, crop: null, revision })
    await touchDraft(ctx, draft)
    if (slot.assetId) await releaseAsset(ctx, slot.assetId)
    return { assetId: null, revision }
  }
})

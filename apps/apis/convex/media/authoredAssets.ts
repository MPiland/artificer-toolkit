import * as zMini from 'zod/mini'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredImageLookupSchema,
  authoredImageTargetSchema,
  authoredImageUploadSchema,
  authoredImageSaveSchema,
  authoredImageProcessClaimSchema,
  authoredImageOperationSchema,
  avatarBindingSchema,
  mediaSinglePutUploadSchema,
  mediaStoredAssetSchema,
  mediaStoredVariantSchema,
  type AuthoredImageLookup,
  type AuthoredImageTarget
} from '@artificer-toolkit/schema/api/mediaAssets'
import { query, internalQuery, type QueryCtx } from '../_generated/server'
import { mutation, internalMutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { getAuthenticatedProfile } from '../lib/identity'
import { canReadAuthoredRoot } from '../content/documents'
import { readImageSlot, ensureDraftImageSlot, retireOrphanImage } from '../content/imageSlots'
import { createMediaUpload, findAsset, ownedAsset, charge } from './assets'

async function ownedDraft(ctx: QueryCtx, target: AuthoredImageTarget) {
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
  returns: zodToConvex(zMini.nullable(mediaStoredAssetSchema)),
  handler: async (ctx, args) => {
    const target = authoredImageLookupSchema.parse(args)
    const slot = await readableSlot(ctx, target)
    if (!slot?.assetId) return null
    const asset = await findAsset(ctx, slot.assetId)
    if (
      !asset ||
      asset.profile !== 'AUTHORED_IMAGE' ||
      asset.status !== 'READY' ||
      asset.authoredTarget?.subjectId !== target.subjectId ||
      asset.authoredTarget.subjectKind !== target.subjectKind
    )
      throw new Error('Image is unavailable.')
    const { _id, _creationTime, ...stored } = asset
    return mediaStoredAssetSchema.parse(stored)
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
  returns: zodToConvex(authoredImageProcessClaimSchema),
  handler: async (ctx, args) => {
    const input = authoredImageSaveSchema.parse(args)
    const { authenticated, draft } = await ownedDraft(ctx, input.target)
    const { asset: source } = await ownedAsset(ctx, input.assetId)
    if (
      source.profile !== 'AUTHORED_IMAGE' ||
      source.authoredTarget?.subjectId !== input.target.subjectId ||
      source.authoredTarget.subjectKind !== input.target.subjectKind ||
      source.operation ||
      (source.status !== 'READY' && source.status !== 'PENDING_UPLOAD')
    )
      throw new Error('Image is unavailable.')
    const slot = await ensureDraftImageSlot(ctx, input.target)
    const current = slot.assetId ? await findAsset(ctx, slot.assetId) : null
    if (
      current?.status === 'READY' &&
      current.profile === 'AUTHORED_IMAGE' &&
      (current.id === source.id || current.copiedFromAssetId === source.id) &&
      current.crop?.x === input.crop.x &&
      current.crop.y === input.crop.y &&
      current.crop.width === input.crop.width &&
      current.crop.height === input.crop.height
    )
      return { kind: 'CURRENT' as const, binding: { assetId: current.id, revision: slot.revision } }
    if (source.status === 'READY' && slot.assetId !== source.id)
      throw new Error('Artwork changed. Reload before cropping.')
    if (source.status === 'PENDING_UPLOAD' && Date.now() > source.uploadExpiresAt)
      throw new Error('Upload expired.')
    let asset = source
    const sourceVariant =
      source.status === 'READY' ? source.variants.find((item) => item.kind === 'SOURCE') : undefined
    const displayVariant =
      source.status === 'READY'
        ? source.variants.find((item) => item.kind === 'DISPLAY')
        : undefined
    if (source.status === 'READY') {
      if (!sourceVariant || !displayVariant) throw new Error('Image source is unavailable.')
      // Never recrop in place: ACTIVE and DRAFT may still share the source asset.
      await charge(ctx, authenticated.profile, 6 * 1024 * 1024)
      const id = crypto.randomUUID()
      const rowId = await ctx.db.insert('mediaAssets', {
        id,
        ownerUserId: source.ownerUserId,
        profile: 'AUTHORED_IMAGE',
        authoredTarget: input.target,
        copiedFromAssetId: source.id,
        upload: { ...source.upload, idempotencyKey: crypto.randomUUID() },
        status: 'PROCESSING',
        rawObjectKey: null,
        uploadExpiresAt: Date.now(),
        chargedBytes: 6 * 1024 * 1024,
        variants: [],
        crop: null,
        operation: null,
        cleanupAt: Date.now() + 24 * 60 * 60_000
      })
      const inserted = await ctx.db.get(rowId)
      if (!inserted || inserted.profile !== 'AUTHORED_IMAGE')
        throw new Error('Image is unavailable.')
      asset = inserted
    }
    const operationId = crypto.randomUUID()
    const operation = authoredImageOperationSchema.parse({
      id: operationId,
      kind: 'INITIAL',
      crop: input.crop,
      target: input.target,
      draftId: draft._id,
      expectedSlotRevision: slot.revision,
      expiresAt: Date.now() + 15 * 60_000,
      ...(sourceVariant && displayVariant
        ? { sourceVariants: { source: sourceVariant, display: displayVariant } }
        : {}),
      outputs: (['SOURCE', 'DISPLAY', 'THUMBNAIL'] as const).map((kind) => ({
        kind,
        objectKey: `ready/${asset.id}/${operationId}/${kind.toLowerCase()}.webp`
      }))
    })
    await ctx.db.patch(asset._id, { status: 'PROCESSING', operation })
    await ctx.scheduler.runAt(operation.expiresAt, internal.media.assets.expireOperation, {
      assetId: asset.id,
      operationId
    })
    const { _id, _creationTime, ...stored } = asset
    return { kind: 'PROCESS' as const, asset: mediaStoredAssetSchema.parse(stored), operation }
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
      asset.profile !== 'AUTHORED_IMAGE' ||
      !operation ||
      !('draftId' in operation) ||
      operation.id !== args.operationId ||
      Date.now() >= operation.expiresAt
    )
      throw new Error('Image processing is no longer current.')
    const { authenticated, draft } = await ownedDraft(ctx, operation.target)
    const slot = await readImageSlot(ctx, operation.target.subjectId, 'DRAFT')
    if (
      draft._id !== operation.draftId ||
      !slot ||
      slot.revision !== operation.expectedSlotRevision ||
      slot.subjectKind !== operation.target.subjectKind
    )
      throw new Error('Artwork changed during processing.')
    const variants = args.variants.map((item) => mediaStoredVariantSchema.parse(item))
    if (
      variants.length !== 3 ||
      new Set(variants.map((item) => item.kind)).size !== 3 ||
      variants.some(
        (item) =>
          !operation.outputs.some(
            (expected) => expected.kind === item.kind && expected.objectKey === item.objectKey
          )
      )
    )
      throw new Error('Processed image output mismatch.')
    await charge(
      ctx,
      authenticated.profile,
      variants.reduce((sum, item) => sum + item.byteSize, 0) - asset.chargedBytes
    )
    await ctx.db.patch(asset._id, {
      status: 'READY',
      variants,
      crop: operation.crop,
      operation: null,
      chargedBytes: variants.reduce((sum, item) => sum + item.byteSize, 0),
      cleanupAt: null
    })
    const revision = slot.revision + 1
    await ctx.db.patch(slot._id, { assetId: asset.id, revision })
    await ctx.db.patch(draft._id, {
      updatedAt: new Date(
        Math.max(Date.now(), (draft.updatedAt ? Date.parse(draft.updatedAt) : 0) + 1)
      ).toISOString()
    })
    if (slot.assetId && slot.assetId !== asset.id) await retireOrphanImage(ctx, slot.assetId)
    if (asset.rawObjectKey)
      await ctx.scheduler.runAt(
        asset.uploadExpiresAt + 15 * 60_000,
        internal.media.assets.cleanupRaw,
        { assetId: asset.id }
      )
    return { assetId: asset.id, revision }
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
    await ctx.db.patch(slot._id, { assetId: null, revision })
    await ctx.db.patch(draft._id, {
      updatedAt: new Date(
        Math.max(Date.now(), (draft.updatedAt ? Date.parse(draft.updatedAt) : 0) + 1)
      ).toISOString()
    })
    if (slot.assetId) await retireOrphanImage(ctx, slot.assetId)
    return { assetId: null, revision }
  }
})

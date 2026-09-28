import { v } from 'convex/values'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import {
  avatarBindingSchema,
  avatarSaveInputSchema,
  avatarUploadInputSchema,
  mediaProcessClaimSchema,
  mediaProcessingOperationSchema,
  mediaReferencedImageSchema,
  mediaSinglePutUploadSchema,
  mediaStoredAssetFieldsSchema,
  mediaStoredAssetSchema,
  type AvatarBindingDto,
  type MediaImageBinding,
  type MediaImageSaveSettlement,
  type MediaProcessClaim,
  type MediaProfileClass,
  type MediaStoredAsset
} from '@artificer-toolkit/schema/api/mediaAssets'
import type { MediaTarget, NormalizedImageCrop } from '@artificer-toolkit/schema/api/media'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { query, internalQuery } from '../lib/queries'
import { mutation, internalMutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { getAuthenticatedProfile } from '../lib/identity'
import { createMediaStorage } from './storage'
import { mapIsReferenced } from './vttMapDocuments'
import { pruneCropThumbnails } from './cropThumbnails'
import { sameCrop } from './crops'

const MIB = 1024 * 1024
const GRACE = 24 * 60 * 60_000
// Node processing actions have a hard 10-minute limit. Cleanup waits longer so
// a killed/failed action cannot write objects after its tracked keys are deleted.
const OPERATION_WINDOW = 15 * 60_000
const assetIdArgs = { assetId: v.string() }

type StoredImage = Doc<'mediaAssets'> & { profileClass: MediaStoredAsset['profileClass'] }

export function storedImage(asset: StoredImage): MediaStoredAsset {
  const { _id, _creationTime, ...stored } = asset
  return mediaStoredAssetSchema.parse(stored)
}

/** Attaching requires the caller's own READY content art; the slot's rules are checked by its domain. */
export function requireAttachableImage(asset: Doc<'mediaAssets'>, userId: string): StoredImage {
  if (
    asset.ownerUserId !== userId ||
    asset.status !== 'READY' ||
    asset.profileClass !== 'CONTENT_ART'
  )
    throw new Error('Image is unavailable.')
  return asset
}

/** Re-evaluates an asset after a reference changed: prunes unused framing or starts its grace. */
export async function releaseAsset(ctx: MutationCtx, assetId: string) {
  await ctx.scheduler.runAfter(0, internal.media.assets.cleanup, { assetId })
}

function readyDuplicate(ctx: QueryCtx, asset: Doc<'mediaAssets'>, contentHash: string) {
  return ctx.db
    .query('mediaAssets')
    .withIndex('by_ownerUserId_profileClass_contentHash_status', (q) =>
      q
        .eq('ownerUserId', asset.ownerUserId)
        .eq('profileClass', asset.profileClass)
        .eq('contentHash', contentHash)
        .eq('status', 'READY')
    )
    .first()
}

/**
 * Finishing an upload whose normalized content matches the owner's READY asset of the same class
 * returns that asset and discards this upload's outputs and reservation (ADR 0012 amendment).
 */
export async function reuseDuplicate(
  ctx: MutationCtx,
  profile: Doc<'userProfiles'>,
  asset: Doc<'mediaAssets'>,
  contentHash: string,
  outputKeys: string[]
) {
  const existing = await readyDuplicate(ctx, asset, contentHash)
  if (!existing || existing.id === asset.id) return null
  await charge(ctx, profile, -asset.chargedBytes)
  await ctx.db.patch(asset._id, {
    status: 'DELETED',
    contentHash,
    variants: [],
    operation: null,
    chargedBytes: 0,
    cleanupAt: null
  })
  if (outputKeys.length)
    await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, { keys: outputKeys })
  if (asset.rawObjectKey)
    await ctx.scheduler.runAt(
      Math.max(Date.now(), asset.uploadExpiresAt + OPERATION_WINDOW),
      internal.media.assets.cleanupRaw,
      { assetId: asset.id }
    )
  // An unattached match gets a fresh grace period, as a newly finished upload would.
  if (existing.cleanupAt !== null) {
    const cleanupAt = Date.now() + GRACE
    await ctx.db.patch(existing._id, { cleanupAt })
    await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, { assetId: existing.id })
  }
  return existing
}

/** A replayed finish for an upload that was de-duplicated resolves to the asset it reused. */
export async function reusedAsset(ctx: QueryCtx, asset: Doc<'mediaAssets'>) {
  if (asset.status !== 'DELETED' || asset.contentHash === null) return null
  return readyDuplicate(ctx, asset, asset.contentHash)
}

export async function findAsset(ctx: QueryCtx | MutationCtx, id: string) {
  return ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
}
export async function ownedAsset(ctx: QueryCtx | MutationCtx, id: string) {
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  const asset = await findAsset(ctx, id)
  if (!asset || asset.ownerUserId !== authenticated.identity.userId || asset.status === 'DELETED') {
    throw new Error('Image is unavailable.')
  }
  return { authenticated, asset }
}
export class MediaQuotaError extends Error {}
export async function charge(ctx: MutationCtx, profile: Doc<'userProfiles'>, delta: number) {
  const next = (profile.mediaBytes ?? 0) + delta
  if (next < 0) throw new Error('Stored media usage is inconsistent.')
  const entitlement = await ctx.db
    .query('accountEntitlements')
    .withIndex('by_userId', (q) => q.eq('userId', profile.userId))
    .unique()
  if (delta > 0 && next > ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].storageBytes) {
    throw new MediaQuotaError('Image storage limit reached.')
  }
  await ctx.db.patch(profile._id, { mediaBytes: next })
}

function binding(profile: { avatarAssetId?: string; avatarRevision?: number }) {
  return {
    assetId: profile.avatarAssetId ?? null,
    revision: profile.avatarRevision ?? 0
  }
}

export const avatar = query({
  args: {},
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx) => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    return binding(authenticated.profile)
  }
})

export const createAvatarUpload = mutation({
  args: zodToConvexFields(avatarUploadInputSchema.shape),
  returns: zodToConvex(mediaSinglePutUploadSchema),
  handler: (ctx, args) => createMediaUpload(ctx, args, { type: 'ACCOUNT_AVATAR' })
})

/**
 * Called only after the owning domain has authorized a write to `target`. The asset belongs to its
 * uploader, not the target: the target only chooses the upload limits and the asset's class.
 */
export async function createMediaUpload(ctx: MutationCtx, args: unknown, target: MediaTarget) {
  const input =
    target.type === 'VTT_MAP'
      ? vttMapStoredAssetSchema.shape.upload.parse(args)
      : target.type === 'CAMPAIGN_FILE' || target.type === 'CAMPAIGN_HANDOUT_MAP'
        ? mediaStoredAssetFieldsSchema.shape.upload.parse(args)
        : avatarUploadInputSchema.parse(args)
  const profileClass: MediaProfileClass =
    target.type === 'VTT_MAP'
      ? 'VTT_MAP'
      : target.type === 'CAMPAIGN_HANDOUT_MAP'
        ? 'HANDOUT_MAP'
        : input.declaredMimeType === 'text/plain'
          ? 'TEXT_FILE'
          : 'CONTENT_ART'
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  const userId = authenticated.identity.userId
  let asset = await ctx.db
    .query('mediaAssets')
    .withIndex('by_ownerUserId_idempotencyKey', (q) =>
      q.eq('ownerUserId', userId).eq('upload.idempotencyKey', input.idempotencyKey)
    )
    .unique()
  if (
    asset &&
    (asset.status !== 'PENDING_UPLOAD' ||
      asset.profileClass !== profileClass ||
      asset.upload.originalFileName !== input.originalFileName ||
      asset.upload.declaredMimeType !== input.declaredMimeType ||
      asset.upload.declaredBytes !== input.declaredBytes)
  )
    throw new Error('Upload command has already been used.')
  if (!asset) {
    const reservationBytes = (profileClass === 'VTT_MAP' ? 25 : 6) * MIB
    await charge(ctx, authenticated.profile, reservationBytes)
    const id = crypto.randomUUID()
    const pending = {
      id,
      ownerUserId: userId,
      storageAssetId: id,
      upload: input,
      status: 'PENDING_UPLOAD',
      rawObjectKey: `pending/${id}/${crypto.randomUUID()}`,
      uploadExpiresAt: 0,
      chargedBytes: reservationBytes,
      contentHash: null,
      variants: [],
      operation: null,
      cleanupAt: null
    }
    const row =
      profileClass === 'VTT_MAP'
        ? vttMapStoredAssetSchema.parse({
            ...pending,
            profileClass,
            hasSceneReferences: false,
            width: null,
            height: null
          })
        : mediaStoredAssetSchema.parse({ ...pending, profileClass, cropThumbnails: [] })
    const rowId = await ctx.db.insert('mediaAssets', row)
    asset = await ctx.db.get(rowId)
  }
  if (!asset?.rawObjectKey) throw new Error('Upload is unavailable.')
  const storage = createMediaStorage()
  // The component's convenience signer omits body size. Bind the single PUT
  // to the authorized file so abandoned uploads cannot exceed reserved quota.
  const url = await getSignedUrl(
    storage.client,
    new PutObjectCommand({
      Bucket: storage.config.bucket,
      Key: asset.rawObjectKey,
      ContentLength: input.declaredBytes,
      ContentType: input.declaredMimeType
    }),
    {
      expiresIn: 900,
      signableHeaders: new Set(['content-length', 'content-type'])
    }
  )
  const seconds = Number(new URL(url).searchParams.get('X-Amz-Expires'))
  if (!Number.isInteger(seconds) || seconds <= 0 || seconds > 3600)
    throw new Error('Invalid upload expiry.')
  const expiresAt = Date.now() + seconds * 1000
  const cleanupAt = expiresAt + OPERATION_WINDOW
  await ctx.db.patch(asset._id, { uploadExpiresAt: expiresAt, cleanupAt })
  await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, {
    assetId: asset.id
  })
  return mediaSinglePutUploadSchema.parse({
    assetId: asset.id,
    method: 'PUT',
    url,
    expiresAt: new Date(expiresAt).toISOString()
  })
}

/** Claims processing of the caller's pending upload for a slot the domain has already authorized. */
export async function beginImageUpload(
  ctx: MutationCtx,
  asset: Doc<'mediaAssets'>,
  binding: MediaImageBinding
): Promise<MediaProcessClaim> {
  if (asset.profileClass !== 'CONTENT_ART') throw new Error('Image is unavailable.')
  if (asset.operation) throw new Error('Image processing is still running. Try again shortly.')
  if (asset.status !== 'PENDING_UPLOAD') throw new Error('Image is unavailable.')
  if (Date.now() > asset.uploadExpiresAt) throw new Error('Upload expired. Choose the image again.')
  const id = crypto.randomUUID()
  const operation = mediaProcessingOperationSchema.parse({
    id,
    expiresAt: Date.now() + OPERATION_WINDOW,
    outputs: (['SOURCE', 'DISPLAY', 'THUMBNAIL'] as const).map((kind) => ({
      kind,
      objectKey: `ready/${asset.id}/${id}/${kind.toLowerCase()}.webp`
    })),
    binding
  })
  await ctx.db.patch(asset._id, { status: 'PROCESSING', operation })
  await ctx.scheduler.runAt(operation.expiresAt, internal.media.assets.expireOperation, {
    assetId: asset.id,
    operationId: id
  })
  return { kind: 'PROCESS', asset: storedImage(asset), operation }
}

/**
 * Verifies an image upload's exact outputs and settles it: a READY duplicate of the owner's content
 * is reused, otherwise the upload becomes READY with its actual charge. The caller binds the slot.
 */
export async function settleImageUpload(ctx: MutationCtx, input: MediaImageSaveSettlement) {
  const { authenticated, asset } = await ownedAsset(ctx, input.assetId)
  const operation = asset.profileClass === 'CONTENT_ART' ? asset.operation : null
  if (
    asset.profileClass !== 'CONTENT_ART' ||
    asset.status !== 'PROCESSING' ||
    !operation?.binding ||
    operation.id !== input.operationId ||
    Date.now() >= operation.expiresAt
  )
    throw new Error('Image processing is no longer current.')
  if (
    input.variants.length !== operation.outputs.length ||
    new Set(input.variants.map((item) => item.kind)).size !== input.variants.length ||
    input.variants.some(
      (item) =>
        !operation.outputs.some(
          (expected) => expected.kind === item.kind && expected.objectKey === item.objectKey
        )
    )
  )
    throw new Error('Processed image output mismatch.')
  const userId = authenticated.identity.userId
  const duplicate = await reuseDuplicate(
    ctx,
    authenticated.profile,
    asset,
    input.contentHash,
    input.variants.map((item) => item.objectKey)
  )
  if (duplicate)
    return {
      authenticated,
      asset: requireAttachableImage(duplicate, userId),
      binding: operation.binding
    }
  const bytes = input.variants.reduce((sum, item) => sum + item.byteSize, 0)
  await charge(ctx, authenticated.profile, bytes - asset.chargedBytes)
  const ready = {
    status: 'READY' as const,
    variants: input.variants,
    contentHash: input.contentHash,
    chargedBytes: bytes,
    operation: null,
    cleanupAt: null
  }
  await ctx.db.patch(asset._id, ready)
  if (asset.rawObjectKey)
    await ctx.scheduler.runAt(
      Math.max(Date.now(), asset.uploadExpiresAt + OPERATION_WINDOW),
      internal.media.assets.cleanupRaw,
      { assetId: asset.id }
    )
  return { authenticated, asset: { ...asset, ...ready }, binding: operation.binding }
}

export async function bindAvatar(
  ctx: MutationCtx,
  profile: Doc<'userProfiles'>,
  asset: StoredImage,
  crop: NormalizedImageCrop
): Promise<AvatarBindingDto> {
  const revision = (profile.avatarRevision ?? 0) + 1
  await ctx.db.patch(profile._id, {
    avatarAssetId: asset.id,
    avatarCrop: crop,
    avatarRevision: revision
  })
  await ctx.db.patch(asset._id, { cleanupAt: null })
  if (profile.avatarAssetId) await releaseAsset(ctx, profile.avatarAssetId)
  return { assetId: asset.id, revision }
}

export async function attachAvatar(ctx: MutationCtx, assetId: string, crop: NormalizedImageCrop) {
  const { authenticated, asset } = await ownedAsset(ctx, assetId)
  const profile = authenticated.profile
  if (profile.avatarAssetId === asset.id && sameCrop(profile.avatarCrop ?? null, crop))
    return binding(profile)
  return bindAvatar(
    ctx,
    profile,
    requireAttachableImage(asset, authenticated.identity.userId),
    crop
  )
}

export const beginSave = internalMutation({
  args: zodToConvexFields(avatarSaveInputSchema.shape),
  returns: zodToConvex(mediaProcessClaimSchema),
  handler: async (ctx, args): Promise<MediaProcessClaim> => {
    const input = avatarSaveInputSchema.parse(args)
    const { authenticated, asset } = await ownedAsset(ctx, input.assetId)
    if (asset.status === 'READY')
      return { kind: 'CURRENT', binding: await attachAvatar(ctx, asset.id, input.crop) }
    return beginImageUpload(ctx, asset, {
      type: 'ACCOUNT_AVATAR',
      crop: input.crop,
      expectedRevision: authenticated.profile.avatarRevision ?? 0
    })
  }
})

export const readAvatar = internalQuery({
  args: {},
  returns: v.union(v.null(), zodToConvex(mediaReferencedImageSchema)),
  handler: async (ctx) => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    const profile = authenticated.profile
    if (!profile.avatarAssetId) return null
    const { asset } = await ownedAsset(ctx, profile.avatarAssetId)
    if (asset.status !== 'READY' || asset.profileClass !== 'CONTENT_ART')
      throw new Error('Image is unavailable.')
    return { asset: storedImage(asset), crop: profile.avatarCrop ?? null }
  }
})

export const removeAvatar = mutation({
  args: {},
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx) => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    const profile = authenticated.profile
    if (!profile.avatarAssetId) return binding(profile)
    const revision = (profile.avatarRevision ?? 0) + 1
    await ctx.db.patch(profile._id, {
      avatarAssetId: undefined,
      avatarCrop: undefined,
      avatarRevision: revision
    })
    await releaseAsset(ctx, profile.avatarAssetId)
    return { assetId: null, revision }
  }
})

export const expireOperation = internalMutation({
  args: { assetId: v.string(), operationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await findAsset(ctx, args.assetId)
    if (!asset?.operation || asset.operation.id !== args.operationId) return null
    if (Date.now() < asset.operation.expiresAt) {
      await ctx.scheduler.runAt(
        asset.operation.expiresAt,
        internal.media.assets.expireOperation,
        args
      )
      return null
    }
    await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, {
      keys: asset.operation.outputs.map((item) => item.objectKey)
    })
    const slotSave = asset.profileClass !== 'VTT_MAP' && asset.operation.binding !== null
    const retryFile = asset.status === 'PROCESSING' && !slotSave
    await ctx.db.patch(asset._id, {
      status: retryFile ? 'PENDING_UPLOAD' : slotSave ? 'REJECTED' : asset.status,
      operation: null,
      cleanupAt: retryFile ? Date.now() + GRACE : (asset.cleanupAt ?? Date.now() + GRACE)
    })
    // File and map operational failures retain their upload for retry after the write fence.
    // Explicit validation/quota rejection sets REJECTED before this expiry callback.
    // Failed slot saves release reserved quota and original bytes at the existing
    // upload-expiry deadline; the slot keeps its current image.
    await ctx.scheduler.runAfter(0, internal.media.assets.cleanup, {
      assetId: asset.id
    })
    return null
  }
})

export const failSave = internalMutation({
  args: { assetId: v.string(), operationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Internal failure callback can run after session revocation; it only retires
    // this exact pre-issued operation, never accepts an identity or new object key.
    const asset = await findAsset(ctx, args.assetId)
    if (!asset?.operation || asset.operation.id !== args.operationId) return null
    // A timed-out PUT can still settle at the provider. Keep the original fence;
    // the action's failure is not proof that no write remains in flight.
    await ctx.scheduler.runAt(
      asset.operation.expiresAt,
      internal.media.assets.expireOperation,
      args
    )
    return null
  }
})

export const cleanupRaw = internalMutation({
  args: assetIdArgs,
  returns: v.null(),
  handler: async (ctx, { assetId }) => {
    const asset = await findAsset(ctx, assetId)
    if (!asset?.rawObjectKey) return null
    const deadline = asset.uploadExpiresAt + OPERATION_WINDOW
    if (Date.now() < deadline) {
      await ctx.scheduler.runAt(deadline, internal.media.assets.cleanupRaw, {
        assetId
      })
      return null
    }
    await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, {
      keys: [asset.rawObjectKey]
    })
    await ctx.db.patch(asset._id, { rawObjectKey: null })
    return null
  }
})

export const cleanup = internalMutation({
  args: assetIdArgs,
  returns: v.null(),
  handler: async (ctx, { assetId }) => {
    const asset = await findAsset(ctx, assetId)
    if (!asset || asset.status === 'DELETED') return null
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', asset.ownerUserId))
      .unique()
    if (await assetIsReferenced(ctx, asset, profile)) {
      // A reference changed: drop framing no slot uses, and cancel any pending retirement.
      await pruneCropThumbnails(ctx, asset)
      if (asset.cleanupAt !== null) await ctx.db.patch(asset._id, { cleanupAt: null })
      return null
    }
    if (asset.cleanupAt === null) {
      // The last reference detached: READY content starts its recovery grace period.
      if (asset.status !== 'READY') return null
      const cleanupAt = Date.now() + GRACE
      await ctx.db.patch(asset._id, { cleanupAt })
      await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, { assetId })
      return null
    }
    const deadline = Math.max(
      asset.cleanupAt,
      asset.uploadExpiresAt + OPERATION_WINDOW,
      asset.operation?.expiresAt ?? 0
    )
    if (Date.now() < deadline) {
      await ctx.scheduler.runAt(deadline, internal.media.assets.cleanup, {
        assetId
      })
      return null
    }
    const keys = await ownedObjectKeys(ctx, asset)
    if (keys.length) await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, { keys })
    if (profile) await charge(ctx, profile, -asset.chargedBytes)
    await ctx.db.patch(asset._id, {
      status: 'DELETED',
      rawObjectKey: null,
      variants: [],
      ...(asset.profileClass === 'VTT_MAP' ? {} : { cropThumbnails: [] }),
      operation: null,
      chargedBytes: 0,
      cleanupAt: null
    })
    return null
  }
})

/** Any domain reference keeps an asset; cropped slots only ever reference their owner's art. */
async function assetIsReferenced(
  ctx: QueryCtx,
  asset: Doc<'mediaAssets'>,
  profile: Doc<'userProfiles'> | null
) {
  if (profile?.avatarAssetId === asset.id) return true
  if (asset.profileClass === 'VTT_MAP') return mapIsReferenced(ctx, asset.id)
  const [portrait, attachment, slot] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_portraitAssetId', (q) => q.eq('portraitAssetId', asset.id))
      .first(),
    ctx.db
      .query('campaignAttachments')
      .withIndex('by_assetId', (q) => q.eq('assetId', asset.id))
      .first(),
    ctx.db
      .query('authoredImageSlots')
      .withIndex('by_assetId', (q) => q.eq('assetId', asset.id))
      .first()
  ])
  return portrait !== null || attachment !== null || slot !== null
}

/**
 * The object keys retiring this asset may delete. Variants stay while another live row shares the
 * same stored objects (a retained Campaign copy or its source).
 */
async function ownedObjectKeys(ctx: QueryCtx, asset: Doc<'mediaAssets'>) {
  const sharers = await ctx.db
    .query('mediaAssets')
    .withIndex('by_storageAssetId', (q) => q.eq('storageAssetId', asset.storageAssetId))
    .take(16)
  const shared = sharers.some((row) => row._id !== asset._id && row.status !== 'DELETED')
  const keys = [
    asset.rawObjectKey,
    ...(shared ? [] : asset.variants.map((item) => item.objectKey)),
    ...(asset.profileClass === 'VTT_MAP'
      ? []
      : asset.cropThumbnails.map((thumbnail) => thumbnail.variant.objectKey)),
    ...(asset.operation?.outputs.map((item) => item.objectKey) ?? [])
  ].filter((key): key is string => key !== null)
  return [...new Set(keys)]
}

export const deleteObjects = internalMutation({
  args: {
    keys: v.array(v.string()),
    attemptId: v.optional(v.id('_scheduled_functions'))
  },
  returns: v.null(),
  handler: async (ctx, { keys, attemptId }) => {
    if (keys.length > 133) throw new Error('Unexpected media object count.')
    if (keys.length > 7) {
      for (let offset = 0; offset < keys.length; offset += 7)
        await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, {
          keys: keys.slice(offset, offset + 7)
        })
      return null
    }
    if (!keys.length) return null
    const previous = attemptId ? await ctx.db.system.get(attemptId) : null
    if (previous?.state.kind === 'success') return null
    const stillRunning = previous?.state.kind === 'pending' || previous?.state.kind === 'inProgress'
    const nextAttemptId = stillRunning
      ? attemptId
      : await ctx.scheduler.runAfter(0, internal.media.avatarActions.deleteObjectBytes, { keys })
    // Scheduling both atomically retains the keys even if the action never starts
    // or dies. Mutations retry platform failures; actions alone are at-most-once.
    await ctx.scheduler.runAfter(OPERATION_WINDOW, internal.media.assets.deleteObjects, {
      keys,
      attemptId: nextAttemptId
    })
    return null
  }
})

export const purgeAccount = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    // Called only after the profile is deleted. A surviving profile must never
    // allow an internal stale cleanup to remove a live account's images.
    if (
      await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    )
      return null
    const assets = await ctx.db
      .query('mediaAssets')
      .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
      .take(32)
    for (const asset of assets) {
      // F12 must resolve retained Campaign media before deleting its uploader.
      // A stale cleanup job must never erase a still-referenced Scene map.
      if (asset.profileClass === 'VTT_MAP' && (await mapIsReferenced(ctx, asset.id)))
        throw new Error('Account media cleanup is restricted by retained Scene maps.')
      const portraits = await ctx.db
        .query('characters')
        .withIndex('by_portraitAssetId', (q) => q.eq('portraitAssetId', asset.id))
        .take(32)
      for (const character of portraits) {
        if (character.userId !== userId) throw new Error('Stored portrait ownership mismatch.')
        await ctx.db.patch(character._id, {
          portraitAssetId: undefined,
          portraitCrop: undefined,
          portraitRevision: (character.portraitRevision ?? 0) + 1
        })
      }
      if (portraits.length === 32) {
        await ctx.scheduler.runAfter(0, internal.media.assets.purgeAccount, {
          userId
        })
        return null
      }
      const attachments = await ctx.db
        .query('campaignAttachments')
        .withIndex('by_assetId', (q) => q.eq('assetId', asset.id))
        .take(32)
      for (const attachment of attachments) await ctx.db.delete(attachment._id)
      if (attachments.length === 32) {
        await ctx.scheduler.runAfter(0, internal.media.assets.purgeAccount, {
          userId
        })
        return null
      }
      const keys = await ownedObjectKeys(ctx, asset)
      if (keys.length) {
        const deadline = Math.max(
          Date.now() + OPERATION_WINDOW,
          asset.uploadExpiresAt + OPERATION_WINDOW,
          asset.operation?.expiresAt ?? 0
        )
        await ctx.scheduler.runAt(deadline, internal.media.assets.deleteObjects, { keys })
      }
      await ctx.db.delete(asset._id)
    }
    if (assets.length === 32)
      await ctx.scheduler.runAfter(0, internal.media.assets.purgeAccount, {
        userId
      })
    return null
  }
})

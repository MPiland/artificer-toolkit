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
  mediaSinglePutUploadSchema,
  mediaStoredAssetSchema,
  mediaStoredVariantSchema,
  type ImageUploadMetadata,
  type AuthoredImageTarget,
  type CharacterPortraitTarget
} from '@artificer-toolkit/schema/api/mediaAssets'
import type {
  CreateCampaignFileUploadIntentInput,
  CreateVttMapUploadIntentInput
} from '@artificer-toolkit/schema/api/media'
import { campaignStoredFileAssetSchema } from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { query, internalQuery, type MutationCtx, type QueryCtx } from '../_generated/server'
import { mutation, internalMutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { getAuthenticatedProfile } from '../lib/identity'
import { createMediaStorage } from './storage'
import { mapIsReferenced } from './vttMapDocuments'

const MIB = 1024 * 1024
const GRACE = 24 * 60 * 60_000
// Node processing actions have a hard 10-minute limit. Cleanup waits longer so
// a killed/failed action cannot write objects after its tracked keys are deleted.
const OPERATION_WINDOW = 15 * 60_000
const assetIdArgs = { assetId: v.string() }

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
  handler: (ctx, args) => createMediaUpload(ctx, args)
})

// Called only after the owning domain has authorized its exact target.
export async function createMediaUpload(
  ctx: MutationCtx,
  args: ImageUploadMetadata | Omit<CreateCampaignFileUploadIntentInput, 'profile' | 'target'>,
  target?:
    | AuthoredImageTarget
    | CharacterPortraitTarget
    | CreateCampaignFileUploadIntentInput['target']
    | CreateVttMapUploadIntentInput['target']
) {
  const mapTarget = target?.type === 'VTT_MAP' ? target : undefined
  const campaignTarget =
    target?.type === 'CAMPAIGN_FILE' || target?.type === 'CAMPAIGN_HANDOUT_MAP' ? target : undefined
  const input = mapTarget
    ? vttMapStoredAssetSchema.shape.upload.parse(args)
    : campaignTarget
      ? campaignStoredFileAssetSchema.shape.upload.parse(args)
      : avatarUploadInputSchema.parse(args)
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  const userId = authenticated.identity.userId
  let asset = await ctx.db
    .query('mediaAssets')
    .withIndex('by_ownerUserId_idempotencyKey', (q) =>
      q.eq('ownerUserId', userId).eq('upload.idempotencyKey', input.idempotencyKey)
    )
    .unique()
  if (asset) {
    const campaignMediaTarget = mapTarget ?? campaignTarget
    const matchesTarget = campaignMediaTarget
      ? asset.profile === campaignMediaTarget.type &&
        'campaignId' in asset &&
        asset.campaignId === campaignMediaTarget.campaignId
      : target?.type === 'AUTHORED_IMAGE'
        ? asset.profile === 'AUTHORED_IMAGE' &&
          asset.authoredTarget?.subjectId === target.subjectId &&
          asset.authoredTarget.subjectKind === target.subjectKind
        : target?.type === 'CHARACTER_PORTRAIT'
          ? asset.profile === 'CHARACTER_PORTRAIT' &&
            asset.characterTarget?.characterId === target.characterId
          : asset.profile === 'ACCOUNT_AVATAR'
    if (
      asset.status !== 'PENDING_UPLOAD' ||
      !matchesTarget ||
      asset.upload.originalFileName !== input.originalFileName ||
      asset.upload.declaredMimeType !== input.declaredMimeType ||
      asset.upload.declaredBytes !== input.declaredBytes
    )
      throw new Error('Upload command has already been used.')
  }
  if (!asset) {
    const reservationBytes = (mapTarget ? 25 : 6) * MIB
    await charge(ctx, authenticated.profile, reservationBytes)
    const id = crypto.randomUUID()
    const pending = {
      id,
      ownerUserId: userId,
      upload: input,
      status: 'PENDING_UPLOAD',
      rawObjectKey: `pending/${id}/${crypto.randomUUID()}`,
      uploadExpiresAt: 0,
      chargedBytes: reservationBytes,
      variants: [],
      crop: null,
      operation: null,
      cleanupAt: null
    }
    const row = mapTarget
      ? vttMapStoredAssetSchema.parse({
          ...pending,
          profile: 'VTT_MAP',
          campaignId: mapTarget.campaignId,
          hasSceneReferences: false,
          width: null,
          height: null
        })
      : campaignTarget
        ? campaignStoredFileAssetSchema.parse({
            ...pending,
            profile: campaignTarget.type,
            campaignId: campaignTarget.campaignId
          })
        : mediaStoredAssetSchema.parse({
            ...pending,
            profile:
              target?.type === 'CHARACTER_PORTRAIT'
                ? 'CHARACTER_PORTRAIT'
                : target
                  ? 'AUTHORED_IMAGE'
                  : 'ACCOUNT_AVATAR',
            ...(target?.type === 'AUTHORED_IMAGE' ? { authoredTarget: target } : {}),
            ...(target?.type === 'CHARACTER_PORTRAIT' ? { characterTarget: target } : {})
          })
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

export const beginSave = internalMutation({
  args: zodToConvexFields(avatarSaveInputSchema.shape),
  returns: zodToConvex(mediaProcessClaimSchema),
  handler: async (ctx, args) => {
    const input = avatarSaveInputSchema.parse(args)
    const { authenticated, asset } = await ownedAsset(ctx, input.assetId)
    if (asset.profile !== 'ACCOUNT_AVATAR') throw new Error('Image is unavailable.')
    if (asset.operation) throw new Error('Image processing is still running. Try again shortly.')
    if (asset.status !== 'PENDING_UPLOAD' && asset.status !== 'READY')
      throw new Error('Image is unavailable.')
    if (asset.status === 'PENDING_UPLOAD' && Date.now() > asset.uploadExpiresAt)
      throw new Error('Upload expired. Choose the image again.')
    if (
      asset.status === 'READY' &&
      authenticated.profile.avatarAssetId === asset.id &&
      asset.crop?.x === input.crop.x &&
      asset.crop.y === input.crop.y &&
      asset.crop.width === input.crop.width &&
      asset.crop.height === input.crop.height
    ) {
      return {
        kind: 'CURRENT' as const,
        binding: binding(authenticated.profile)
      }
    }
    const id = crypto.randomUUID()
    const initial = asset.status === 'PENDING_UPLOAD'
    const kinds = initial ? (['SOURCE', 'DISPLAY', 'THUMBNAIL'] as const) : (['THUMBNAIL'] as const)
    const operation = {
      id,
      kind: initial ? ('INITIAL' as const) : ('CROP' as const),
      crop: input.crop,
      expectedAvatarRevision: authenticated.profile.avatarRevision ?? 0,
      expiresAt: Date.now() + OPERATION_WINDOW,
      outputs: kinds.map((kind) => ({
        kind,
        objectKey: `ready/${asset.id}/${id}/${kind.toLowerCase()}.webp`
      }))
    }
    await ctx.db.patch(asset._id, {
      status: initial ? 'PROCESSING' : 'READY',
      operation
    })
    await ctx.scheduler.runAt(operation.expiresAt, internal.media.assets.expireOperation, {
      assetId: asset.id,
      operationId: id
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
    const { authenticated, asset } = await ownedAsset(ctx, args.assetId)
    if (asset.profile !== 'ACCOUNT_AVATAR') throw new Error('Image is unavailable.')
    const operation = asset.operation
    if (operation && 'target' in operation) throw new Error('Image is unavailable.')
    if (!operation || operation.id !== args.operationId || Date.now() >= operation.expiresAt)
      throw new Error('Image processing is no longer current.')
    if ((authenticated.profile.avatarRevision ?? 0) !== operation.expectedAvatarRevision)
      throw new Error('Avatar changed during processing. Try again.')
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
    ) {
      throw new Error('Processed image output mismatch.')
    }
    const variants = [
      ...asset.variants.filter((item) => !outputs.some((next) => next.kind === item.kind)),
      ...outputs
    ]
    if (variants.length !== 3) throw new Error('Processed image variants are incomplete.')
    const bytes = variants.reduce((sum, item) => sum + item.byteSize, 0)
    await charge(ctx, authenticated.profile, bytes - asset.chargedBytes)
    const previousId = authenticated.profile.avatarAssetId
    if (previousId && previousId !== asset.id) {
      const previous = await findAsset(ctx, previousId)
      if (!previous || previous.ownerUserId !== asset.ownerUserId)
        throw new Error('Stored avatar ownership mismatch.')
      const cleanupAt = Date.now() + GRACE
      await ctx.db.patch(previous._id, { cleanupAt })
      await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, {
        assetId: previous.id
      })
    }
    const retiredKeys = asset.variants
      .filter((old) => outputs.some((next) => next.kind === old.kind))
      .map((old) => old.objectKey)
    if (retiredKeys.length)
      await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, {
        keys: retiredKeys
      })
    await ctx.db.patch(asset._id, {
      status: 'READY',
      variants,
      crop: operation.crop,
      chargedBytes: bytes,
      operation: null,
      cleanupAt: null
    })
    const revision = (authenticated.profile.avatarRevision ?? 0) + 1
    await ctx.db.patch(authenticated.profile._id, {
      avatarAssetId: asset.id,
      avatarRevision: revision
    })
    if (asset.rawObjectKey)
      await ctx.scheduler.runAt(
        Math.max(Date.now(), asset.uploadExpiresAt + OPERATION_WINDOW),
        internal.media.assets.cleanupRaw,
        { assetId: asset.id }
      )
    return { assetId: asset.id, revision }
  }
})

export const readAvatar = internalQuery({
  args: {},
  returns: v.union(v.null(), zodToConvex(mediaStoredAssetSchema)),
  handler: async (ctx) => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    if (!authenticated.profile.avatarAssetId) return null
    const { asset } = await ownedAsset(ctx, authenticated.profile.avatarAssetId)
    if (asset.status !== 'READY' || asset.profile !== 'ACCOUNT_AVATAR')
      throw new Error('Image is unavailable.')
    const { _id, _creationTime, ...stored } = asset
    return mediaStoredAssetSchema.parse(stored)
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
    const { asset } = await ownedAsset(ctx, profile.avatarAssetId)
    const cleanupAt = Date.now() + GRACE
    await ctx.db.patch(asset._id, { cleanupAt })
    await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, {
      assetId: asset.id
    })
    const revision = (profile.avatarRevision ?? 0) + 1
    await ctx.db.patch(profile._id, {
      avatarAssetId: undefined,
      avatarRevision: revision
    })
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
    const initial = asset.operation.kind === 'INITIAL'
    const retryFile =
      (asset.profile === 'CAMPAIGN_FILE' ||
        asset.profile === 'CAMPAIGN_HANDOUT_MAP' ||
        asset.profile === 'VTT_MAP') &&
      asset.status === 'PROCESSING'
    await ctx.db.patch(asset._id, {
      status: retryFile ? 'PENDING_UPLOAD' : initial ? 'REJECTED' : 'READY',
      operation: null,
      cleanupAt: retryFile ? Date.now() + GRACE : (asset.cleanupAt ?? Date.now() + GRACE)
    })
    // File operational failures retain their upload for retry after the write fence.
    // Explicit validation/quota rejection sets REJECTED before this expiry callback.
    // Initial image failures release reserved quota and original bytes at the existing
    // upload-expiry deadline; recrop failures leave the attached image unchanged.
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
    if (!asset || asset.cleanupAt === null || asset.status === 'DELETED') return null
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', asset.ownerUserId))
      .unique()
    if (profile?.avatarAssetId === asset.id) return null
    if (asset.profile === 'VTT_MAP' && (await mapIsReferenced(ctx, asset.id))) return null
    if (
      await ctx.db
        .query('characters')
        .withIndex('by_portraitAssetId', (q) => q.eq('portraitAssetId', asset.id))
        .first()
    )
      return null
    if (
      await ctx.db
        .query('campaignAttachments')
        .withIndex('by_assetId', (q) => q.eq('assetId', asset.id))
        .first()
    )
      return null
    if (
      await ctx.db
        .query('authoredImageSlots')
        .withIndex('by_assetId', (q) => q.eq('assetId', asset.id))
        .first()
    )
      return null
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
    const keys = [
      asset.rawObjectKey,
      ...asset.variants.map((item) => item.objectKey),
      ...(asset.operation?.outputs.map((item) => item.objectKey) ?? [])
    ].filter((key): key is string => key !== null)
    if (keys.length)
      await ctx.scheduler.runAfter(0, internal.media.assets.deleteObjects, {
        keys: [...new Set(keys)]
      })
    if (profile) await charge(ctx, profile, -asset.chargedBytes)
    await ctx.db.patch(asset._id, {
      status: 'DELETED',
      rawObjectKey: null,
      variants: [],
      operation: null,
      chargedBytes: 0,
      cleanupAt: null
    })
    return null
  }
})

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
      if (asset.profile === 'VTT_MAP' && (await mapIsReferenced(ctx, asset.id)))
        throw new Error('Account media cleanup is restricted by retained Scene maps.')
      const portraits = await ctx.db
        .query('characters')
        .withIndex('by_portraitAssetId', (q) => q.eq('portraitAssetId', asset.id))
        .take(32)
      for (const character of portraits) {
        if (
          character.userId !== userId ||
          asset.profile !== 'CHARACTER_PORTRAIT' ||
          asset.characterTarget?.characterId !== character.id
        )
          throw new Error('Stored portrait ownership mismatch.')
        await ctx.db.patch(character._id, {
          portraitAssetId: undefined,
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
      const keys = [
        asset.rawObjectKey,
        ...asset.variants.map((item) => item.objectKey),
        ...(asset.operation?.outputs.map((item) => item.objectKey) ?? [])
      ].filter((key): key is string => key !== null)
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

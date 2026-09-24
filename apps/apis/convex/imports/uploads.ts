import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_ENTRY_BYTES,
  importUploadCompletionRequestDtoSchema,
  importUploadCompletionResultDtoSchema,
  importUploadIntentRequestDtoSchema,
  importUploadIntentResultDtoSchema
} from '@artificer-toolkit/schema/api/imports'
import {
  importClaimRefDtoSchema,
  importPreviewSessionRefDtoSchema
} from '@artificer-toolkit/schema/api/importJobs'
import {
  importStoredPreviewDescriptorSchema,
  importStoredPreviewSessionSchema
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation, mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'

const UPLOAD_WINDOW_MS = 15 * 60_000
const cleanupClaim = makeFunctionReference<
  'mutation',
  { claimId: string; expiresAt: number },
  null
>('imports/uploads:cleanup')
const cleanupPreview = makeFunctionReference<
  'mutation',
  { previewId: string; expiresAt: number },
  null
>('imports/jobCleanup:cleanupPreview')

async function claimByPublicId(ctx: MutationCtx, claimId: string) {
  return ctx.db
    .query('importUploadClaims')
    .withIndex('by_claimId', (query) => query.eq('claimId', claimId))
    .unique()
}

async function claimByStorageId(ctx: MutationCtx, storageId: Id<'_storage'>) {
  return ctx.db
    .query('importUploadClaims')
    .withIndex('by_storageId', (query) => query.eq('storageId', storageId))
    .unique()
}

async function deleteUnclaimedUpload(ctx: MutationCtx, storageId: Id<'_storage'>) {
  if (!(await claimByStorageId(ctx, storageId)) && (await ctx.storage.getMetadata(storageId))) {
    await ctx.storage.delete(storageId)
  }
}

export function decideImportUploadMetadata(declaredBytes: number, actualBytes: number | null) {
  if (
    actualBytes === null ||
    !Number.isSafeInteger(actualBytes) ||
    actualBytes <= 0 ||
    actualBytes !== declaredBytes ||
    actualBytes > IMPORT_MAX_ENTRY_BYTES
  ) {
    return { status: 'REJECTED' as const, deleteStorage: actualBytes !== null }
  }
  return { status: 'READY' as const, actualBytes }
}

function completion(claimId: string, status: 'READY' | 'REJECTED') {
  return importUploadCompletionResultDtoSchema.parse({ claimId, status })
}

export const create = mutation({
  args: zodToConvexFields(importUploadIntentRequestDtoSchema.shape),
  returns: zodToConvex(importUploadIntentResultDtoSchema),
  handler: async (ctx, args) => {
    const input = importUploadIntentRequestDtoSchema.parse(args)
    const identity = await requireIdentity(ctx)
    const claimId = crypto.randomUUID()
    const createdAt = Date.now()
    const expiresAt = createdAt + UPLOAD_WINDOW_MS
    const uploadUrl = await ctx.storage.generateUploadUrl()
    await ctx.db.insert('importUploadClaims', {
      claimId,
      ownerUserId: identity.userId,
      entryId: input.entryId,
      name: input.name,
      declaredBytes: input.declaredBytes,
      status: 'PENDING',
      createdAt,
      expiresAt
    })
    await ctx.scheduler.runAt(expiresAt, cleanupClaim, { claimId, expiresAt })
    return importUploadIntentResultDtoSchema.parse({
      claimId,
      uploadUrl,
      expiresAt: new Date(expiresAt).toISOString()
    })
  }
})

export const finalize = mutation({
  args: {
    claimId: zodToConvex(importUploadCompletionRequestDtoSchema.shape.claimId),
    storageId: v.id('_storage')
  },
  returns: zodToConvex(importUploadCompletionResultDtoSchema),
  handler: async (ctx, args) => {
    const input = importUploadCompletionRequestDtoSchema.parse(args)
    const identity = await requireIdentity(ctx)
    const claim = await claimByPublicId(ctx, input.claimId)
    if (!claim || claim.ownerUserId !== identity.userId) {
      throw new Error('Upload claim is unavailable.')
    }
    if (claim.status !== 'PENDING') {
      if (claim.storageId === args.storageId) return completion(claim.claimId, 'READY')
      await deleteUnclaimedUpload(ctx, args.storageId)
      return completion(claim.claimId, 'REJECTED')
    }
    if (claim.expiresAt <= Date.now()) {
      await deleteUnclaimedUpload(ctx, args.storageId)
      await ctx.db.delete(claim._id)
      return completion(claim.claimId, 'REJECTED')
    }
    if (await claimByStorageId(ctx, args.storageId)) {
      return completion(claim.claimId, 'REJECTED')
    }
    const metadata = await ctx.storage.getMetadata(args.storageId)
    const decision = decideImportUploadMetadata(claim.declaredBytes, metadata?.size ?? null)
    if (decision.status === 'REJECTED') {
      if (decision.deleteStorage) await ctx.storage.delete(args.storageId)
      return completion(claim.claimId, 'REJECTED')
    }
    await ctx.db.patch(claim._id, {
      actualBytes: decision.actualBytes,
      storageId: args.storageId,
      status: 'READY'
    })
    return completion(claim.claimId, 'READY')
  }
})

export const registerFetched = internalMutation({
  args: {
    entryId: zodToConvex(importUploadIntentRequestDtoSchema.shape.entryId),
    name: zodToConvex(importUploadIntentRequestDtoSchema.shape.name),
    storageId: v.id('_storage')
  },
  returns: zodToConvex(importClaimRefDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    if (await claimByStorageId(ctx, args.storageId))
      throw new Error('Fetched import is unavailable.')
    const metadata = await ctx.storage.getMetadata(args.storageId)
    const actualBytes = metadata?.size ?? null
    if (
      actualBytes === null ||
      !Number.isSafeInteger(actualBytes) ||
      actualBytes <= 0 ||
      actualBytes > IMPORT_MAX_ENTRY_BYTES
    )
      throw new Error('Fetched import is unavailable.')

    const claimId = crypto.randomUUID()
    const createdAt = Date.now()
    const expiresAt = createdAt + UPLOAD_WINDOW_MS
    await ctx.db.insert('importUploadClaims', {
      claimId,
      ownerUserId: userId,
      entryId: args.entryId,
      name: args.name,
      declaredBytes: actualBytes,
      actualBytes,
      storageId: args.storageId,
      status: 'READY',
      createdAt,
      expiresAt
    })
    await ctx.scheduler.runAt(expiresAt, cleanupClaim, { claimId, expiresAt })
    return importClaimRefDtoSchema.parse({
      claimId,
      entryId: args.entryId,
      name: args.name
    })
  }
})

export const createPreview = internalMutation({
  args: {
    descriptor: zodToConvex(importStoredPreviewDescriptorSchema)
  },
  returns: zodToConvex(importPreviewSessionRefDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const descriptor = importStoredPreviewDescriptorSchema.parse(args.descriptor)
    const entries: Array<{ claimId: string; entryId: string; name: string }> = []
    const claims: Array<Doc<'importUploadClaims'>> = []
    let totalBytes = 0

    for (const entry of descriptor.entries) {
      const claim = await claimByPublicId(ctx, entry.claimId)
      if (
        !claim ||
        claim.ownerUserId !== userId ||
        claim.status !== 'READY' ||
        claim.previewId ||
        claim.jobId ||
        claim.expiresAt <= Date.now() ||
        claim.entryId !== entry.entryId ||
        (descriptor.source !== 'DND_BEYOND' && (!('name' in entry) || claim.name !== entry.name)) ||
        !claim.storageId ||
        !claim.actualBytes ||
        !Number.isSafeInteger(claim.actualBytes) ||
        claim.actualBytes > IMPORT_MAX_ENTRY_BYTES
      )
        throw new Error('Upload claim is unavailable.')
      totalBytes += claim.actualBytes
      if (totalBytes > IMPORT_MAX_BATCH_BYTES) throw new Error('Import batch is too large.')
      claims.push(claim)
      entries.push({
        claimId: claim.claimId,
        entryId: claim.entryId,
        name: claim.name
      })
    }

    const previewId = crypto.randomUUID()
    const nowMs = Date.now()
    const expiresAt = nowMs + UPLOAD_WINDOW_MS
    const now = new Date(nowMs).toISOString()
    for (const claim of claims)
      await ctx.db.patch(claim._id, { status: 'BOUND', previewId, expiresAt })

    await ctx.db.insert(
      'importPreviewSessions',
      importStoredPreviewSessionSchema.parse({
        id: previewId,
        ownerUserId: userId,
        source: descriptor.source,
        entries,
        descriptor,
        status: 'READY',
        jobId: null,
        expiresAt,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.scheduler.runAt(expiresAt, cleanupPreview, { previewId, expiresAt })
    return importPreviewSessionRefDtoSchema.parse({
      previewId,
      expiresAt: new Date(expiresAt).toISOString()
    })
  }
})

export const cleanup = internalMutation({
  args: { claimId: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { claimId, expiresAt }) => {
    const claim = await claimByPublicId(ctx, claimId)
    if (!claim || claim.expiresAt !== expiresAt || claim.expiresAt > Date.now()) return null
    if (claim.status === 'BOUND' || claim.previewId || claim.jobId) return null
    if (claim.storageId) await ctx.storage.delete(claim.storageId)
    await ctx.db.delete(claim._id)
    return null
  }
})

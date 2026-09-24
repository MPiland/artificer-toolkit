import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  beginImportJobInputSchema,
  importJobListInputSchema,
  importJobListPageSchema,
  importJobLookupSchema,
  importJobProgressDtoSchema,
  importJobSummaryDtoSchema,
  type ImportJobListPage,
  type ImportJobProgressDto,
  type ImportJobSummaryDto
} from '@artificer-toolkit/schema/api/importJobs'
import {
  importResultItemDtoSchema,
  importResultReportDtoSchema
} from '@artificer-toolkit/schema/api/imports'
import {
  importStoredJobSchema,
  importStoredPreviewDescriptorSchema,
  importStoredPreviewSessionSchema,
  importStoredResultSchema,
  type ImportStoredJob
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { query } from '../_generated/server'
import { readAuthUser } from '../lib/authUserReads'
import { requireIdentity } from '../lib/identity'
import { internalMutation, mutation } from '../lib/mutations'

const MAX_BYTES = 1024 * 1024
const MAX_LIST_ROWS = 48
const JOB_EXPIRY_MS = 24 * 60 * 60 * 1000
const runJob = makeFunctionReference<'action', { jobId: string }, null>('imports/runner:run')
const cleanupJob = makeFunctionReference<'mutation', { jobId: string }, null>(
  'imports/jobCleanup:cleanup'
)

function fingerprint(ownerUserId: string, command: ImportStoredJob['command']) {
  return checksumCanonicalJson({
    operation: 'PORTABLE_IMPORT',
    ownerUserId,
    command
  })
}

export function parseImportJob(row: Doc<'importJobs'>): ImportStoredJob {
  const { _id, _creationTime, ...stored } = row
  const job = importStoredJobSchema.parse(stored)
  if (job.inputFingerprint !== fingerprint(job.ownerUserId, job.command))
    throw new Error('Stored import job is invalid.')
  return job
}

export async function requireCurrentImportOwner(ctx: QueryCtx | MutationCtx, ownerUserId: string) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', ownerUserId))
    .unique()
  if (!profile) throw new Error('Import owner account is unavailable.')
  const user = await readAuthUser(ctx, profile.authUserId)
  if (!user || (user.banned && (!user.banExpires || user.banExpires >= Date.now())))
    throw new Error('Import owner account is unavailable.')
  return profile
}

async function findJob(ctx: QueryCtx | MutationCtx, jobId: string) {
  const row = await ctx.db
    .query('importJobs')
    .withIndex('by_publicId', (q) => q.eq('id', jobId))
    .unique()
  if (!row) throw new Error('Import job not found.')
  return { row, job: parseImportJob(row) }
}

function presentSummary(job: ImportStoredJob): ImportJobSummaryDto {
  return importJobSummaryDtoSchema.parse({
    jobId: job.id,
    previewId: job.previewId,
    source: job.source,
    status: job.status,
    processedEntries: job.processedEntries,
    totalEntries: job.totalEntries,
    failureReason: job.failureReason,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  })
}

async function assembleResult(ctx: QueryCtx | MutationCtx, job: ImportStoredJob) {
  if (job.status !== 'COMPLETED') return null
  if (!job.summary) throw new Error('Completed import result is unavailable.')
  const rows = await ctx.db
    .query('importJobResults')
    .withIndex('by_jobId_sequence', (q) => q.eq('jobId', job.id))
    .take(job.totalEntries + 1)
  const storedRows = rows.map(({ _id, _creationTime, ...stored }) =>
    importStoredResultSchema.parse(stored)
  )
  if (
    storedRows.length !== job.totalEntries ||
    storedRows.some((row, index) => row.sequence !== index || row.jobId !== job.id)
  )
    throw new Error('Completed import result is unavailable.')
  const result = importResultReportDtoSchema.parse({
    source: job.source,
    items: storedRows.map((row) => importResultItemDtoSchema.parse(JSON.parse(row.resultJson))),
    summary: job.summary
  })
  if (checksumCanonicalJson(result.summary) !== checksumCanonicalJson(job.summary))
    throw new Error('Completed import result is unavailable.')
  return result
}

async function presentProgress(
  ctx: QueryCtx | MutationCtx,
  job: ImportStoredJob
): Promise<ImportJobProgressDto> {
  return importJobProgressDtoSchema.parse({
    ...presentSummary(job),
    phase: job.phase,
    result: await assembleResult(ctx, job)
  })
}

function assertCommandEntries(
  command: ImportStoredJob['command'],
  descriptor: ReturnType<typeof importStoredPreviewDescriptorSchema.parse>
) {
  const entryIds = new Set(descriptor.entries.map((entry) => entry.entryId))
  const selected = new Set<string>()
  const resolved = new Set<string>()
  const custom = new Set<string>()
  for (const entryId of command.selectedEntryIds) {
    if (selected.has(entryId) || !entryIds.has(entryId))
      throw new Error('Import selection does not match this preview.')
    selected.add(entryId)
  }
  for (const resolution of command.resolutions) {
    if (resolved.has(resolution.entryId) || !entryIds.has(resolution.entryId))
      throw new Error('Import selection does not match this preview.')
    resolved.add(resolution.entryId)
  }
  for (const choice of command.customContentChoices) {
    const key = `${choice.entryId}:${choice.subjectKind}:${choice.externalId}`
    if (custom.has(key) || !entryIds.has(choice.entryId))
      throw new Error('Import selection does not match this preview.')
    custom.add(key)
  }
}

export const begin = mutation({
  args: zodToConvexFields(beginImportJobInputSchema.shape),
  returns: zodToConvex(importJobProgressDtoSchema),
  handler: async (ctx, args): Promise<ImportJobProgressDto> => {
    const parsed = beginImportJobInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const command = beginImportJobInputSchema.parse({
      ...parsed,
      commandId: parsed.commandId.toLowerCase(),
      previewId: parsed.previewId.toLowerCase()
    })
    const existingRow = await ctx.db
      .query('importJobs')
      .withIndex('by_ownerUserId_commandId', (q) =>
        q.eq('ownerUserId', userId).eq('command.commandId', command.commandId)
      )
      .unique()
    if (existingRow) {
      const existing = parseImportJob(existingRow)
      if (existing.inputFingerprint !== fingerprint(userId, command))
        throw new Error('This command ID was already used with different input.')
      return presentProgress(ctx, existing)
    }

    const previewRow = await ctx.db
      .query('importPreviewSessions')
      .withIndex('by_publicId', (q) => q.eq('id', command.previewId))
      .unique()
    if (!previewRow) throw new Error('Import preview is unavailable.')
    const { _id, _creationTime, ...storedPreview } = previewRow
    const preview = importStoredPreviewSessionSchema.parse(storedPreview)
    const descriptor = preview.descriptor
    if (
      preview.ownerUserId !== userId ||
      preview.status !== 'READY' ||
      preview.jobId !== null ||
      preview.expiresAt <= Date.now() ||
      !descriptor
    )
      throw new Error('Import preview is unavailable.')
    assertCommandEntries(command, descriptor)

    const claims: Array<Doc<'importUploadClaims'>> = []
    for (const [index, entry] of descriptor.entries.entries()) {
      const storedEntry = preview.entries[index]
      const claim = await ctx.db
        .query('importUploadClaims')
        .withIndex('by_claimId', (q) => q.eq('claimId', entry.claimId))
        .unique()
      if (
        !storedEntry ||
        !claim ||
        claim.ownerUserId !== userId ||
        claim.status !== 'BOUND' ||
        claim.previewId !== preview.id ||
        claim.jobId ||
        claim.entryId !== entry.entryId ||
        claim.name !== storedEntry.name ||
        (descriptor.source !== 'DND_BEYOND' && (!('name' in entry) || claim.name !== entry.name)) ||
        claim.expiresAt !== preview.expiresAt ||
        !claim.storageId ||
        !claim.actualBytes
      )
        throw new Error('Import preview is unavailable.')
      claims.push(claim)
    }

    const nowMs = Date.now()
    const now = new Date(nowMs).toISOString()
    const jobId = crypto.randomUUID()
    const expiresAt = nowMs + JOB_EXPIRY_MS
    const job = importStoredJobSchema.parse({
      id: jobId,
      ownerUserId: userId,
      previewId: preview.id,
      command,
      inputFingerprint: fingerprint(userId, command),
      source: descriptor.source,
      status: 'RUNNING',
      terminalStatus: null,
      phase: 'PLANNING',
      entryIndex: 0,
      cursor: null,
      processedEntries: 0,
      totalEntries: descriptor.entries.length,
      failureReason: null,
      summary: null,
      cleanupTableIndex: 0,
      cleanupCursor: null,
      expiresAt,
      createdAt: now,
      updatedAt: now
    })

    await ctx.db.patch(previewRow._id, {
      status: 'CLAIMED',
      jobId,
      expiresAt,
      updatedAt: now
    })
    for (const claim of claims) await ctx.db.patch(claim._id, { jobId, expiresAt })
    await ctx.db.insert('importJobs', job)
    await ctx.scheduler.runAt(expiresAt, cleanupJob, { jobId })
    await ctx.scheduler.runAfter(0, runJob, { jobId })
    return presentProgress(ctx, job)
  }
})

export const progress = query({
  args: zodToConvexFields(importJobLookupSchema.shape),
  returns: zodToConvex(importJobProgressDtoSchema),
  handler: async (ctx, args): Promise<ImportJobProgressDto> => {
    const input = importJobLookupSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { job } = await findJob(ctx, input.jobId)
    if (job.ownerUserId !== userId) throw new Error('Import job not found.')
    return presentProgress(ctx, job)
  }
})

export const cancel = mutation({
  args: zodToConvexFields(importJobLookupSchema.shape),
  returns: zodToConvex(importJobProgressDtoSchema),
  handler: async (ctx, args): Promise<ImportJobProgressDto> => {
    const input = importJobLookupSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const found = await findJob(ctx, input.jobId)
    if (found.job.ownerUserId !== userId) throw new Error('Import job not found.')
    if (found.job.status !== 'RUNNING') return presentProgress(ctx, found.job)

    const now = new Date().toISOString()
    const cancelled = importStoredJobSchema.parse({
      ...found.job,
      status: 'CLEANING',
      terminalStatus: 'CANCELLED',
      phase: 'CLEANING',
      failureReason: null,
      cleanupTableIndex: 0,
      cleanupCursor: null,
      updatedAt: now
    })
    await ctx.db.patch(found.row._id, {
      status: cancelled.status,
      terminalStatus: cancelled.terminalStatus,
      phase: cancelled.phase,
      failureReason: cancelled.failureReason,
      cleanupTableIndex: cancelled.cleanupTableIndex,
      cleanupCursor: cancelled.cleanupCursor,
      updatedAt: cancelled.updatedAt
    })
    await ctx.scheduler.runAfter(0, cleanupJob, { jobId: cancelled.id })
    return presentProgress(ctx, cancelled)
  }
})

export const list = query({
  args: zodToConvexFields(importJobListInputSchema.shape),
  returns: zodToConvex(importJobListPageSchema),
  handler: async (ctx, args): Promise<ImportJobListPage> => {
    const input = importJobListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const page = await ctx.db
      .query('importJobs')
      .withIndex('by_ownerUserId_createdAt_id', (q) => q.eq('ownerUserId', userId))
      .paginate({
        ...input.paginationOpts,
        maximumRowsRead: MAX_LIST_ROWS,
        maximumBytesRead: MAX_BYTES
      })
    return importJobListPageSchema.parse({
      ...page,
      page: page.page.map((row) => presentSummary(parseImportJob(row)))
    })
  }
})

export const fail = internalMutation({
  args: {
    jobId: v.string(),
    failureReason: v.string()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const found = await findJob(ctx, args.jobId)
    if (found.job.status !== 'RUNNING') return null
    const failureReason = args.failureReason.slice(0, 500)
    await ctx.db.patch(found.row._id, {
      status: 'CLEANING',
      terminalStatus: 'FAILED',
      phase: 'CLEANING',
      failureReason,
      cleanupTableIndex: 0,
      cleanupCursor: null,
      updatedAt: new Date().toISOString()
    })
    await ctx.scheduler.runAfter(0, cleanupJob, { jobId: found.job.id })
    return null
  }
})

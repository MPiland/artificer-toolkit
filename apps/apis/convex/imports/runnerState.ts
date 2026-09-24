import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { beginImportJobInputSchema } from '@artificer-toolkit/schema/api/importJobs'
import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_ENTRY_BYTES
} from '@artificer-toolkit/schema/api/imports'
import {
  importStoredPreviewDescriptorSchema,
  importStoredPreviewSessionSchema,
  type ImportStoredJob,
  type ImportStoredPreviewDescriptor
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import type { Id } from '../_generated/dataModel'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { readCharacterRecord } from '../characters/documents'
import { readSystem } from '../content/systemDocuments'
import { parseImportJob, requireCurrentImportOwner } from './jobs'

const sourceClaimValidator = v.object({
  claimId: v.string(),
  entryId: v.string(),
  name: v.string(),
  actualBytes: v.number(),
  storageId: v.id('_storage')
})

const runnerSourceValidator = v.object({
  ownerUserId: v.string(),
  command: zodToConvex(beginImportJobInputSchema),
  descriptor: zodToConvex(importStoredPreviewDescriptorSchema),
  claims: v.array(sourceClaimValidator)
})

const runnerPreflightValidator = v.object({
  availableSystemIds: v.array(v.string()),
  activeCharacters: v.array(
    v.object({
      characterId: v.string(),
      systemId: v.string(),
      primaryRulesCatalogueId: v.union(v.string(), v.null())
    })
  )
})

export interface ImportRunnerSourceClaim {
  claimId: string
  entryId: string
  name: string
  actualBytes: number
  storageId: Id<'_storage'>
}

export interface ImportRunnerSource {
  ownerUserId: string
  command: ImportStoredJob['command']
  descriptor: ImportStoredPreviewDescriptor
  claims: ImportRunnerSourceClaim[]
}

export interface ImportRunnerPreflight {
  availableSystemIds: string[]
  activeCharacters: Array<{
    characterId: string
    systemId: string
    primaryRulesCatalogueId: string | null
  }>
}

async function requireRunningJob(ctx: QueryCtx, jobId: string) {
  const jobRow = await ctx.db
    .query('importJobs')
    .withIndex('by_publicId', (query) => query.eq('id', jobId))
    .unique()
  if (!jobRow) throw new Error('Import job is unavailable.')
  const job = parseImportJob(jobRow)
  if (job.status !== 'RUNNING' || job.expiresAt <= Date.now())
    throw new Error('Import job is unavailable.')
  await requireCurrentImportOwner(ctx, job.ownerUserId)
  return job
}

export const loadSource = internalQuery({
  args: { jobId: v.string() },
  returns: runnerSourceValidator,
  handler: async (ctx, { jobId }): Promise<ImportRunnerSource> => {
    const job = await requireRunningJob(ctx, jobId)

    const previewRow = await ctx.db
      .query('importPreviewSessions')
      .withIndex('by_publicId', (query) => query.eq('id', job.previewId))
      .unique()
    if (!previewRow) throw new Error('Import job source is unavailable.')
    const { _id, _creationTime, ...storedPreview } = previewRow
    const preview = importStoredPreviewSessionSchema.parse(storedPreview)
    const descriptor = preview.descriptor
    if (
      !descriptor ||
      preview.ownerUserId !== job.ownerUserId ||
      preview.source !== job.source ||
      descriptor.source !== job.source ||
      preview.status !== 'CLAIMED' ||
      preview.jobId !== job.id ||
      preview.expiresAt !== job.expiresAt
    )
      throw new Error('Import job source is unavailable.')

    const rows = await ctx.db
      .query('importUploadClaims')
      .withIndex('by_jobId', (query) => query.eq('jobId', job.id))
      .take(IMPORT_MAX_ENTRIES + 1)
    if (rows.length !== descriptor.entries.length)
      throw new Error('Import job source is unavailable.')
    const byClaimId = new Map(rows.map((row) => [row.claimId, row]))
    let totalBytes = 0
    const claims: ImportRunnerSourceClaim[] = []
    for (const [index, entry] of descriptor.entries.entries()) {
      const expected = preview.entries[index]
      const claim = byClaimId.get(entry.claimId)
      if (
        !expected ||
        !claim ||
        expected.claimId !== entry.claimId ||
        expected.entryId !== entry.entryId ||
        claim.ownerUserId !== job.ownerUserId ||
        claim.status !== 'BOUND' ||
        claim.previewId !== preview.id ||
        claim.jobId !== job.id ||
        claim.expiresAt !== job.expiresAt ||
        claim.entryId !== entry.entryId ||
        claim.name !== expected.name ||
        ('name' in entry && claim.name !== entry.name) ||
        !claim.storageId ||
        !claim.actualBytes ||
        !Number.isSafeInteger(claim.actualBytes) ||
        claim.actualBytes > IMPORT_MAX_ENTRY_BYTES
      )
        throw new Error('Import job source is unavailable.')
      totalBytes += claim.actualBytes
      if (totalBytes > IMPORT_MAX_BATCH_BYTES) throw new Error('Import job source is unavailable.')
      claims.push({
        claimId: claim.claimId,
        entryId: claim.entryId,
        name: claim.name,
        actualBytes: claim.actualBytes,
        storageId: claim.storageId
      })
    }
    return { ownerUserId: job.ownerUserId, command: job.command, descriptor, claims }
  }
})

export const loadPreflight = internalQuery({
  args: {
    jobId: v.string(),
    systemIds: v.array(v.string()),
    characterIds: v.array(v.string())
  },
  returns: runnerPreflightValidator,
  handler: async (ctx, args): Promise<ImportRunnerPreflight> => {
    const job = await requireRunningJob(ctx, args.jobId)
    if (
      args.systemIds.length > IMPORT_MAX_ENTRIES ||
      args.characterIds.length > IMPORT_MAX_ENTRIES ||
      args.systemIds.length > job.totalEntries ||
      args.characterIds.length > job.totalEntries ||
      new Set(args.systemIds).size !== args.systemIds.length ||
      new Set(args.characterIds).size !== args.characterIds.length
    )
      throw new Error('Import preflight request is invalid.')

    const availableSystemIds: string[] = []
    for (const systemId of args.systemIds) {
      const record = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (query) => query.eq('id', systemId))
        .unique()
      if (!record) continue
      readSystem(record)
      availableSystemIds.push(systemId)
    }

    const activeCharacters: ImportRunnerPreflight['activeCharacters'] = []
    for (const characterId of args.characterIds) {
      const active = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (query) => query.eq('id', characterId))
        .unique()
      if (!active || active.userId !== job.ownerUserId) continue
      const character = readCharacterRecord(active)
      activeCharacters.push({
        characterId,
        systemId: character.systemId,
        primaryRulesCatalogueId: active.primaryRulesCatalogueId ?? null
      })
    }

    return { availableSystemIds, activeCharacters }
  }
})

export const loadSourceRef = makeFunctionReference<'query', { jobId: string }, ImportRunnerSource>(
  'imports/runnerState:loadSource'
)

export const loadPreflightRef = makeFunctionReference<
  'query',
  { jobId: string; systemIds: string[]; characterIds: string[] },
  ImportRunnerPreflight
>('imports/runnerState:loadPreflight')

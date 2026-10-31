import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import {
  importStoredPreviewSessionSchema,
  importStoredStageSchema
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { deleteCharacterDraftPayloadByHead } from '../characters/documents'
import { deleteAuthoredVersion, deleteDraftPayloadByHead } from '../content/documents'
import { deleteSourceFacts } from '../content/sourceFacts'
import { internalMutation } from '../lib/mutations'
import { parseImportJob } from './jobs'

const PAGE_SIZE = 8
const cleanupJob = makeFunctionReference<'mutation', { jobId: string }, null>(
  'imports/jobCleanup:cleanup'
)
const cleanupPreviewRef = makeFunctionReference<
  'mutation',
  { previewId: string; expiresAt: number },
  null
>('imports/jobCleanup:cleanupPreview')

async function enqueueJob(ctx: MutationCtx, jobId: string) {
  await ctx.scheduler.runAfter(0, cleanupJob, { jobId })
}

async function continueCleanup(
  ctx: MutationCtx,
  row: Doc<'importJobs'>,
  jobId: string,
  deletedCount: number,
  nextTableIndex: number
) {
  if (deletedCount === 0)
    await ctx.db.patch(row._id, {
      cleanupTableIndex: nextTableIndex,
      cleanupCursor: null,
      updatedAt: new Date().toISOString()
    })
  await enqueueJob(ctx, jobId)
}

async function deleteReplacedPayload(
  ctx: MutationCtx,
  stageKind: Doc<'importJobStages'>['kind'],
  outputJson: string
) {
  if (stageKind !== 'CHARACTER_HEAD' && stageKind !== 'AUTHORED_HEAD') return
  const output: unknown = JSON.parse(outputJson)
  if (!output || typeof output !== 'object' || !('oldPayloadHead' in output))
    throw new Error('Import job cleanup integrity failure.')
  const oldPayload = output.oldPayloadHead
  if (oldPayload === null) return
  if (!oldPayload || typeof oldPayload !== 'object' || !('_id' in oldPayload))
    throw new Error('Import job cleanup integrity failure.')
  const id = typeof oldPayload._id === 'string' ? oldPayload._id : null
  if (!id) throw new Error('Import job cleanup integrity failure.')
  if (stageKind === 'CHARACTER_HEAD') {
    const documentId = ctx.db.normalizeId('characterDraftPayloads', id)
    const current = documentId ? await ctx.db.get(documentId) : null
    if (!current || checksumCanonicalJson(current) !== checksumCanonicalJson(oldPayload))
      throw new Error('Import job cleanup integrity failure.')
    await deleteCharacterDraftPayloadByHead(ctx, current)
    return
  }
  const documentId = ctx.db.normalizeId('authoredDraftPayloads', id)
  const current = documentId ? await ctx.db.get(documentId) : null
  if (!current || checksumCanonicalJson(current) !== checksumCanonicalJson(oldPayload))
    throw new Error('Import job cleanup integrity failure.')
  await deleteDraftPayloadByHead(ctx, current)
}

export const cleanupPreview = internalMutation({
  args: { previewId: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('importPreviewSessions')
      .withIndex('by_publicId', (q) => q.eq('id', args.previewId))
      .unique()
    if (!row) return null
    const { _id, _creationTime, ...stored } = row
    const preview = importStoredPreviewSessionSchema.parse(stored)
    if (
      preview.expiresAt !== args.expiresAt ||
      preview.expiresAt > Date.now() ||
      preview.status === 'CLAIMED'
    )
      return null

    const claims = await ctx.db
      .query('importUploadClaims')
      .withIndex('by_previewId', (q) => q.eq('previewId', preview.id))
      .take(PAGE_SIZE)
    for (const claim of claims) {
      if (
        claim.ownerUserId !== preview.ownerUserId ||
        claim.status !== 'BOUND' ||
        claim.previewId !== preview.id ||
        claim.jobId
      )
        throw new Error('Import preview cleanup integrity failure.')
      if (claim.storageId) await ctx.storage.delete(claim.storageId)
      await ctx.db.delete(claim._id)
    }
    if (claims.length === PAGE_SIZE) {
      await ctx.scheduler.runAfter(0, cleanupPreviewRef, args)
      return null
    }
    await ctx.db.delete(row._id)
    return null
  }
})

export const cleanup = internalMutation({
  args: { jobId: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const row = await ctx.db
      .query('importJobs')
      .withIndex('by_publicId', (q) => q.eq('id', jobId))
      .unique()
    if (!row) return null
    const job = parseImportJob(row)
    if (
      job.status === 'FAILED' ||
      job.status === 'CANCELLED' ||
      (job.status === 'COMPLETED' && job.cleanupTableIndex >= 3)
    )
      return null
    if (job.status === 'RUNNING') {
      if (job.expiresAt > Date.now()) return null
      await ctx.db.patch(row._id, {
        status: 'CLEANING',
        terminalStatus: 'FAILED',
        phase: 'CLEANING',
        failureReason: 'Import could not be completed.',
        cleanupTableIndex: 0,
        cleanupCursor: null,
        updatedAt: new Date().toISOString()
      })
      await enqueueJob(ctx, job.id)
      return null
    }
    if (job.cleanupTableIndex === 0) {
      const claims = await ctx.db
        .query('importUploadClaims')
        .withIndex('by_jobId', (q) => q.eq('jobId', job.id))
        .take(PAGE_SIZE)
      for (const claim of claims) {
        if (
          claim.ownerUserId !== job.ownerUserId ||
          claim.status !== 'BOUND' ||
          claim.previewId !== job.previewId ||
          claim.jobId !== job.id
        )
          throw new Error('Import job cleanup integrity failure.')
        if (claim.storageId) await ctx.storage.delete(claim.storageId)
        await ctx.db.delete(claim._id)
      }
      if (claims.length) {
        await enqueueJob(ctx, job.id)
        return null
      }
      if (job.status === 'COMPLETED') {
        const previewRow = await ctx.db
          .query('importPreviewSessions')
          .withIndex('by_publicId', (q) => q.eq('id', job.previewId))
          .unique()
        if (previewRow) {
          const { _id, _creationTime, ...stored } = previewRow
          const preview = importStoredPreviewSessionSchema.parse(stored)
          if (
            preview.ownerUserId !== job.ownerUserId ||
            preview.status !== 'CLAIMED' ||
            preview.jobId !== job.id
          )
            throw new Error('Import job cleanup integrity failure.')
          await ctx.db.delete(previewRow._id)
        }
        await ctx.db.patch(row._id, {
          cleanupTableIndex: 2,
          cleanupCursor: null,
          updatedAt: new Date().toISOString()
        })
        await enqueueJob(ctx, job.id)
        return null
      }
      await ctx.db.patch(row._id, {
        cleanupTableIndex: 1,
        cleanupCursor: null,
        updatedAt: new Date().toISOString()
      })
      await enqueueJob(ctx, job.id)
      return null
    }

    if (job.status === 'COMPLETED') {
      if (job.cleanupTableIndex !== 2) throw new Error('Completed import cleanup state is invalid.')
      const stages = await ctx.db
        .query('importJobStages')
        .withIndex('by_jobId_stageKey', (q) => q.eq('jobId', job.id))
        .take(PAGE_SIZE)
      for (const row of stages) {
        const { _id, _creationTime, ...stored } = row
        const stage = importStoredStageSchema.parse(stored)
        if (stage.jobId !== job.id || stage.status !== 'STAGED')
          throw new Error('Import job cleanup integrity failure.')
        await deleteReplacedPayload(ctx, stage.kind, stage.outputJson)
        await ctx.db.delete(row._id)
      }
      if (stages.length) await enqueueJob(ctx, job.id)
      else
        await ctx.db.patch(row._id, {
          cleanupTableIndex: 3,
          cleanupCursor: null,
          updatedAt: new Date().toISOString()
        })
      return null
    }

    if (!job.terminalStatus) throw new Error('Import cleanup is missing a terminal status.')

    if (job.cleanupTableIndex === 1) {
      const results = await ctx.db
        .query('importJobResults')
        .withIndex('by_jobId_sequence', (q) => q.eq('jobId', job.id))
        .take(PAGE_SIZE)
      for (const result of results) {
        if (result.jobId !== job.id) throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(result._id)
      }
      if (results.length) {
        await enqueueJob(ctx, job.id)
        return null
      }
      await continueCleanup(ctx, row, job.id, results.length, 2)
      return null
    }

    if (job.cleanupTableIndex === 2) {
      const refs = await ctx.db
        .query('authoredImportRefs')
        .withIndex('by_importJobId_subjectId', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const ref of refs) {
        if (ref.importJobId !== job.id || ref.userId !== job.ownerUserId)
          throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(ref._id)
      }
      await continueCleanup(ctx, row, job.id, refs.length, 3)
      return null
    }

    if (job.cleanupTableIndex === 3) {
      const slots = await ctx.db
        .query('authoredImageSlots')
        .withIndex('by_importJobId_subjectId', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const slot of slots) {
        if (slot.importJobId !== job.id) throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(slot._id)
      }
      await continueCleanup(ctx, row, job.id, slots.length, 4)
      return null
    }

    if (job.cleanupTableIndex === 4) {
      const routes = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_importJobId_subjectId', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const route of routes) {
        if (
          route.importJobId !== job.id ||
          (route.ownerUserId !== undefined && route.ownerUserId !== job.ownerUserId)
        )
          throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(route._id)
      }
      await continueCleanup(ctx, row, job.id, routes.length, 5)
      return null
    }

    if (job.cleanupTableIndex === 5) {
      const usageEntries = await ctx.db
        .query('accountUsageEntries')
        .withIndex('by_importJobId_sourceId', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const entry of usageEntries) {
        if (entry.importJobId !== job.id || entry.ownerUserId !== job.ownerUserId)
          throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(entry._id)
      }
      await continueCleanup(ctx, row, job.id, usageEntries.length, 6)
      return null
    }

    if (job.cleanupTableIndex === 6) {
      const spellClasses = await ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_importJobId_spellId_classId', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const spellClass of spellClasses) {
        if (spellClass.importJobId !== job.id)
          throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(spellClass._id)
      }
      await continueCleanup(ctx, row, job.id, spellClasses.length, 7)
      return null
    }

    if (job.cleanupTableIndex === 7) {
      const drafts = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_importJobId_subjectId', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const draft of drafts) {
        if (draft.importJobId !== job.id || draft.userId !== job.ownerUserId)
          throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(draft._id)
      }
      await continueCleanup(ctx, row, job.id, drafts.length, 8)
      return null
    }

    if (job.cleanupTableIndex === 8) {
      const payloads = await ctx.db
        .query('authoredDraftPayloads')
        .withIndex('by_importJobId_id', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const payload of payloads) {
        if (payload.importJobId !== job.id) throw new Error('Import job cleanup integrity failure.')
        await deleteDraftPayloadByHead(ctx, payload)
      }
      await continueCleanup(ctx, row, job.id, payloads.length, 9)
      return null
    }

    if (job.cleanupTableIndex === 9) {
      const roots = await ctx.db
        .query('authoredRoots')
        .withIndex('by_importJobId_id', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const root of roots) {
        if (
          root.importJobId !== job.id ||
          (root.ownerUserId !== undefined && root.ownerUserId !== job.ownerUserId)
        )
          throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(root._id)
        await deleteSourceFacts(ctx, root.id)
      }
      await continueCleanup(ctx, row, job.id, roots.length, 10)
      return null
    }

    if (job.cleanupTableIndex === 10) {
      const versions = await ctx.db
        .query('authoredVersions')
        .withIndex('by_importJobId_id', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const version of versions) {
        if (version.importJobId !== job.id) throw new Error('Import job cleanup integrity failure.')
        const document = await deleteAuthoredVersion(ctx, version)
        if (
          !document ||
          typeof document !== 'object' ||
          Array.isArray(document) ||
          document.userId !== job.ownerUserId
        )
          throw new Error('Import job cleanup integrity failure.')
      }
      await continueCleanup(ctx, row, job.id, versions.length, 11)
      return null
    }

    if (job.cleanupTableIndex === 11) {
      const payloads = await ctx.db
        .query('characterDraftPayloads')
        .withIndex('by_importJobId_id', (q) => q.eq('importJobId', job.id))
        .take(PAGE_SIZE)
      for (const payload of payloads) {
        if (payload.importJobId !== job.id) throw new Error('Import job cleanup integrity failure.')
        const draft = await ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', payload.characterId))
          .unique()
        if (draft?.payloadId === payload.id) {
          if (
            draft.characterId !== payload.characterId ||
            draft.userId !== job.ownerUserId ||
            draft.checksum !== payload.checksum
          )
            throw new Error('Import job cleanup integrity failure.')
          await ctx.db.delete(draft._id)
        }
        await deleteCharacterDraftPayloadByHead(ctx, payload)
      }
      await continueCleanup(ctx, row, job.id, payloads.length, 12)
      return null
    }

    if (job.cleanupTableIndex === 12) {
      const stages = await ctx.db
        .query('importJobStages')
        .withIndex('by_jobId_stageKey', (q) => q.eq('jobId', job.id))
        .take(PAGE_SIZE)
      for (const stage of stages) {
        if (stage.jobId !== job.id) throw new Error('Import job cleanup integrity failure.')
        await ctx.db.delete(stage._id)
      }
      await continueCleanup(ctx, row, job.id, stages.length, 13)
      return null
    }

    const previewRow = await ctx.db
      .query('importPreviewSessions')
      .withIndex('by_publicId', (q) => q.eq('id', job.previewId))
      .unique()
    if (previewRow) {
      const { _id, _creationTime, ...stored } = previewRow
      const preview = importStoredPreviewSessionSchema.parse(stored)
      if (
        preview.ownerUserId !== job.ownerUserId ||
        preview.status !== 'CLAIMED' ||
        preview.jobId !== job.id
      )
        throw new Error('Import job cleanup integrity failure.')
      await ctx.db.delete(previewRow._id)
    }
    await ctx.db.patch(row._id, {
      status: job.terminalStatus,
      phase: 'CLEANING',
      cleanupCursor: null,
      updatedAt: new Date().toISOString()
    })
    return null
  }
})

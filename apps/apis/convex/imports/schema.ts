import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  importStoredJobSchema,
  importStoredPreviewSessionSchema,
  importStoredResultSchema,
  importStoredStageSchema
} from '@artificer-toolkit/schema/projections/importJobPersistence'

export const importTables = {
  importUploadClaims: defineTable({
    claimId: v.string(),
    ownerUserId: v.string(),
    entryId: v.string(),
    name: v.string(),
    declaredBytes: v.number(),
    actualBytes: v.optional(v.number()),
    storageId: v.optional(v.id('_storage')),
    status: v.union(v.literal('PENDING'), v.literal('READY'), v.literal('BOUND')),
    previewId: v.optional(v.string()),
    jobId: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number()
  })
    .index('by_claimId', ['claimId'])
    .index('by_expiresAt', ['expiresAt'])
    .index('by_storageId', ['storageId'])
    .index('by_previewId', ['previewId'])
    .index('by_jobId', ['jobId']),
  importPreviewSessions: defineTable(zodToConvexFields(importStoredPreviewSessionSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_jobId', ['jobId']),
  importJobs: defineTable(zodToConvexFields(importStoredJobSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_previewId', ['previewId'])
    .index('by_ownerUserId_commandId', ['ownerUserId', 'command.commandId'])
    .index('by_ownerUserId_createdAt_id', ['ownerUserId', 'createdAt', 'id']),
  importJobStages: defineTable(zodToConvexFields(importStoredStageSchema.shape))
    .index('by_jobId_stageKey', ['jobId', 'stageKey'])
    .index('by_jobId_sequence', ['jobId', 'sequence'])
    .index('by_jobId_status_stageKey', ['jobId', 'status', 'stageKey']),
  importJobResults: defineTable(zodToConvexFields(importStoredResultSchema.shape)).index(
    'by_jobId_sequence',
    ['jobId', 'sequence']
  )
}

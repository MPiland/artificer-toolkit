import { z } from '../zod.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import { timestampSchema, uuidSchema } from './campaignContractSchemas.js'
import {
  IMPORT_MAX_ENTRIES,
  importBatchInputDtoSchema,
  importCommitRequestDtoSchema,
  importEntryIdDtoSchema,
  importEntryNameDtoSchema,
  importPreviewResponseDtoSchema,
  importResultReportDtoSchema,
  importSourceDtoSchema
} from './imports.js'

export const importClaimRefDtoSchema = z.strictObject({
  claimId: uuidSchema,
  entryId: importEntryIdDtoSchema,
  name: importEntryNameDtoSchema
})

export const importPreviewSessionRefDtoSchema = z.strictObject({
  previewId: uuidSchema,
  expiresAt: timestampSchema
})

const [dndBeyondImportBatchSchema, foundryImportBatchSchema, artificerImportBatchSchema] =
  importBatchInputDtoSchema._zod.def.options

function validateUniquePreviewEntryIds(
  entries: ReadonlyArray<{ entryId: string }>,
  context: z.core.$RefinementCtx
) {
  const entryIds = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (entryIds.has(entry.entryId))
      context.addIssue({
        code: 'custom',
        message: 'Duplicate import entry id "' + entry.entryId + '".',
        path: ['entries', index, 'entryId']
      })
    entryIds.add(entry.entryId)
  }
}

const importClaimEntriesSchema = z
  .array(importClaimRefDtoSchema)
  .check(z.minLength(1))
  .check(z.maxLength(IMPORT_MAX_ENTRIES))

export const importPreviewInputSchema = z.discriminatedUnion('source', [
  z
    .strictObject({
      source: dndBeyondImportBatchSchema.shape.source,
      systemId: dndBeyondImportBatchSchema.shape.systemId,
      primaryRulesCatalogueId: dndBeyondImportBatchSchema.shape.primaryRulesCatalogueId,
      entries: dndBeyondImportBatchSchema.shape.entries
    })
    .check(
      z.superRefine(({ entries }, context) => validateUniquePreviewEntryIds(entries, context))
    ),
  z
    .strictObject({
      source: foundryImportBatchSchema.shape.source,
      systemId: foundryImportBatchSchema.shape.systemId,
      primaryRulesCatalogueId: foundryImportBatchSchema.shape.primaryRulesCatalogueId,
      entries: importClaimEntriesSchema
    })
    .check(
      z.superRefine(({ entries }, context) => validateUniquePreviewEntryIds(entries, context))
    ),
  z
    .strictObject({
      source: artificerImportBatchSchema.shape.source,
      entries: importClaimEntriesSchema
    })
    .check(z.superRefine(({ entries }, context) => validateUniquePreviewEntryIds(entries, context)))
])

export const importPreviewResultSchema = z.extend(
  importPreviewResponseDtoSchema,
  importPreviewSessionRefDtoSchema.shape
)

export const beginImportJobInputSchema = z.strictObject({
  commandId: uuidSchema,
  previewId: uuidSchema,
  selectedEntryIds: importCommitRequestDtoSchema.shape.selectedEntryIds,
  resolutions: importCommitRequestDtoSchema.shape.resolutions,
  customContentChoices: importCommitRequestDtoSchema.shape.customContentChoices
})

export const importJobLookupSchema = z.strictObject({ jobId: uuidSchema })
export const importJobStatusSchema = z.enum([
  'RUNNING',
  'CLEANING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
])
export const importJobPhaseSchema = z.enum(['PLANNING', 'STAGING', 'PUBLISHING', 'CLEANING'])

const importJobSummaryFields = {
  jobId: uuidSchema,
  previewId: uuidSchema,
  source: importSourceDtoSchema,
  status: importJobStatusSchema,
  processedEntries: z.number().check(z.int()).check(z.nonnegative()),
  totalEntries: z.number().check(z.int()).check(z.nonnegative()).check(z.lte(IMPORT_MAX_ENTRIES)),
  failureReason: z.nullable(z.string().check(z.maxLength(500))),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}

export const importJobSummaryDtoSchema = z.strictObject(importJobSummaryFields)
export const importJobProgressDtoSchema = z.strictObject({
  ...importJobSummaryFields,
  phase: importJobPhaseSchema,
  result: z.nullable(importResultReportDtoSchema)
})

export const importJobListInputSchema = campaignListInputSchema
export const importJobListPageSchema = z.extend(campaignListPageSchema, {
  page: z.array(importJobSummaryDtoSchema)
})

export type ImportClaimRefDto = z.infer<typeof importClaimRefDtoSchema>
export type ImportPreviewSessionRefDto = z.infer<typeof importPreviewSessionRefDtoSchema>
export type ImportPreviewInput = z.infer<typeof importPreviewInputSchema>
export type ImportPreviewResult = z.infer<typeof importPreviewResultSchema>
export type BeginImportJobInput = z.input<typeof beginImportJobInputSchema>
export type ImportJobLookup = z.infer<typeof importJobLookupSchema>
export type ImportJobProgressDto = z.infer<typeof importJobProgressDtoSchema>
export type ImportJobSummaryDto = z.infer<typeof importJobSummaryDtoSchema>
export type ImportJobListInput = z.infer<typeof importJobListInputSchema>
export type ImportJobListPage = z.infer<typeof importJobListPageSchema>

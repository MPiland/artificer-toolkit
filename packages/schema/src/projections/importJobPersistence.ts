import { z, lazySchema } from '../zod.js'
import {
  beginImportJobInputSchema,
  importClaimRefDtoSchema,
  importJobPhaseSchema,
  importJobStatusSchema
} from '../api/importJobs.js'
import {
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_CUSTOM_CONTENT_CHOICES,
  dndBeyondImportEntryDtoSchema,
  importEntryIdDtoSchema,
  importResultReportDtoSchema,
  importSourceDtoSchema
} from '../api/imports.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'

export const IMPORT_MAX_STAGE_ROWS = IMPORT_MAX_CUSTOM_CONTENT_CHOICES + IMPORT_MAX_ENTRIES * 3
const IMPORT_STAGE_JSON_MAX_LENGTH = 240 * 1024

const importStageCountSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(IMPORT_MAX_STAGE_ROWS))
)

const importStageJsonSchema = lazySchema(() =>
  z.string().check(z.maxLength(IMPORT_STAGE_JSON_MAX_LENGTH))
)

export const importStoredStageSchema = lazySchema(() =>
  z.strictObject({
    jobId: uuidSchema,
    stageKey: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(255)),
    entryId: importEntryIdDtoSchema,
    sequence: importStageCountSchema,
    kind: z.enum(['PLAN', 'CHARACTER_HEAD', 'AUTHORED_HEAD', 'CUSTOM_AUTHORED', 'RESULT']),
    status: z.enum(['PLANNED', 'STAGED']),
    targetJson: importStageJsonSchema,
    outputJson: importStageJsonSchema,
    expectedStateJson: importStageJsonSchema,
    expectedStateChecksum: projectionChecksumSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
)

const storedPreviewClaimEntriesSchema = lazySchema(() =>
  z.array(importClaimRefDtoSchema).check(z.minLength(1)).check(z.maxLength(IMPORT_MAX_ENTRIES))
)

const storedDndBeyondPreviewEntrySchema = lazySchema(() =>
  z.strictObject({
    claimId: uuidSchema,
    ...dndBeyondImportEntryDtoSchema.shape
  })
)

function validateUniqueStoredPreviewEntries(
  entries: ReadonlyArray<{ claimId: string; entryId: string }>,
  context: z.core.$RefinementCtx
) {
  const claimIds = new Set<string>()
  const entryIds = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (claimIds.has(entry.claimId))
      context.addIssue({
        code: 'custom',
        message: `Duplicate import claim id "${entry.claimId}".`,
        path: ['entries', index, 'claimId']
      })
    if (entryIds.has(entry.entryId))
      context.addIssue({
        code: 'custom',
        message: `Duplicate import entry id "${entry.entryId}".`,
        path: ['entries', index, 'entryId']
      })
    claimIds.add(entry.claimId)
    entryIds.add(entry.entryId)
  }
}

export const importStoredPreviewDescriptorSchema = lazySchema(() =>
  z.discriminatedUnion('source', [
    z
      .strictObject({
        source: z.literal('DND_BEYOND'),
        systemId: uuidSchema,
        primaryRulesCatalogueId: uuidSchema,
        entries: z
          .array(storedDndBeyondPreviewEntrySchema)
          .check(z.minLength(1))
          .check(z.maxLength(IMPORT_MAX_ENTRIES))
      })
      .check(
        z.superRefine(({ entries }, context) =>
          validateUniqueStoredPreviewEntries(entries, context)
        )
      ),
    z
      .strictObject({
        source: z.literal('FOUNDRY_DND5E'),
        systemId: uuidSchema,
        primaryRulesCatalogueId: uuidSchema,
        entries: storedPreviewClaimEntriesSchema
      })
      .check(
        z.superRefine(({ entries }, context) =>
          validateUniqueStoredPreviewEntries(entries, context)
        )
      ),
    z
      .strictObject({
        source: z.literal('ARTIFICER_JSON'),
        entries: storedPreviewClaimEntriesSchema
      })
      .check(
        z.superRefine(({ entries }, context) =>
          validateUniqueStoredPreviewEntries(entries, context)
        )
      )
  ])
)

export const importStoredPreviewSessionSchema = lazySchema(() =>
  z
    .strictObject({
      id: uuidSchema,
      ownerUserId: uuidSchema,
      source: importSourceDtoSchema,
      entries: storedPreviewClaimEntriesSchema,
      descriptor: z.optional(importStoredPreviewDescriptorSchema),
      status: z.enum(['READY', 'CLAIMED']),
      jobId: z.nullable(uuidSchema),
      expiresAt: z.number().check(z.int()).check(z.positive()),
      createdAt: timestampSchema,
      updatedAt: timestampSchema
    })
    .check(
      z.superRefine(({ source, entries, descriptor }, context) => {
        if (!descriptor) return
        if (descriptor.source !== source)
          context.addIssue({
            code: 'custom',
            message: 'Stored preview source does not match its descriptor.',
            path: ['descriptor', 'source']
          })
        if (
          entries.length !== descriptor.entries.length ||
          descriptor.entries.some((entry, index) => {
            const stored = entries[index]
            return (
              !stored ||
              stored.claimId !== entry.claimId ||
              stored.entryId !== entry.entryId ||
              (descriptor.source !== 'DND_BEYOND' &&
                (!('name' in entry) || stored.name !== entry.name))
            )
          })
        )
          context.addIssue({
            code: 'custom',
            message: 'Stored preview entries do not match their descriptor.',
            path: ['descriptor', 'entries']
          })
      })
    )
)

export const importStoredJobSchema = lazySchema(() =>
  z
    .strictObject({
      id: uuidSchema,
      ownerUserId: uuidSchema,
      previewId: uuidSchema,
      command: beginImportJobInputSchema,
      inputFingerprint: projectionChecksumSchema,
      source: importSourceDtoSchema,
      status: importJobStatusSchema,
      terminalStatus: z.nullable(z.enum(['FAILED', 'CANCELLED'])),
      phase: importJobPhaseSchema,
      entryIndex: z.number().check(z.int()).check(z.nonnegative()),
      cursor: z.nullable(z.string()),
      processedEntries: z.number().check(z.int()).check(z.nonnegative()),
      totalEntries: z
        .number()
        .check(z.int())
        .check(z.nonnegative())
        .check(z.lte(IMPORT_MAX_ENTRIES)),
      expectedStageCount: z._default(importStageCountSchema, 0),
      stagedStageCount: z._default(importStageCountSchema, 0),
      failureReason: z.nullable(z.string().check(z.maxLength(500))),
      summary: z.nullable(importResultReportDtoSchema.shape.summary),
      cleanupTableIndex: z.number().check(z.int()).check(z.nonnegative()),
      cleanupCursor: z.nullable(z.string()),
      expiresAt: z.number().check(z.int()).check(z.positive()),
      createdAt: timestampSchema,
      updatedAt: timestampSchema
    })
    .check(
      z.superRefine(({ expectedStageCount, stagedStageCount }, context) => {
        if (stagedStageCount > expectedStageCount)
          context.addIssue({
            code: 'custom',
            message: 'Staged import stage count cannot exceed the expected stage count.',
            path: ['stagedStageCount']
          })
      })
    )
)

export const importStoredResultSchema = lazySchema(() =>
  z.strictObject({
    jobId: uuidSchema,
    entryId: importEntryIdDtoSchema,
    sequence: z.number().check(z.int()).check(z.nonnegative()).check(z.lt(IMPORT_MAX_ENTRIES)),
    resultJson: z.string()
  })
)

export type ImportStoredPreviewSession = z.infer<typeof importStoredPreviewSessionSchema>
export type ImportStoredPreviewDescriptor = z.infer<typeof importStoredPreviewDescriptorSchema>
export type ImportStoredJob = z.infer<typeof importStoredJobSchema>
export type ImportStoredResult = z.infer<typeof importStoredResultSchema>
export type ImportStoredStage = z.infer<typeof importStoredStageSchema>

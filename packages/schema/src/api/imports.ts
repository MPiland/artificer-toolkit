import { z } from 'zod'

import { unknownObjectSchema } from '../shared/facet.js'
import { authoredSubjectKindDtoSchema } from './content.js'

export const IMPORT_MAX_ENTRIES = 25
export const IMPORT_MAX_CUSTOM_CONTENT_CHOICES = 1000
export const IMPORT_MAX_ENTRY_BYTES = 10 * 1024 * 1024
export const IMPORT_MAX_BATCH_BYTES = 25 * 1024 * 1024

export const importSourceDtoSchema = z.enum(['DND_BEYOND', 'FOUNDRY_DND5E', 'ARTIFICER_JSON'])

export const importCollisionChoiceDtoSchema = z.enum(['COPY', 'UPDATE_DRAFT'])
export const importPreviewStatusDtoSchema = z.enum(['READY', 'NEEDS_REVIEW', 'UNABLE'])
export const importIssueSeverityDtoSchema = z.enum(['INFO', 'WARNING', 'ERROR'])

const importEntryIdDtoSchema = z.string().min(1).max(128)

export const dndBeyondImportEntryDtoSchema = z.strictObject({
  entryId: importEntryIdDtoSchema,
  url: z.string().trim().min(1).max(2048)
})

export const jsonImportEntryDtoSchema = z.strictObject({
  entryId: importEntryIdDtoSchema,
  name: z.string().trim().min(1).max(255),
  text: z.string()
})

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function validateEntries(
  entries: ReadonlyArray<{ entryId: string }>,
  context: z.RefinementCtx
): void {
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.entryId)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate import entry id "${entry.entryId}".`,
        path: ['entries', index, 'entryId']
      })
    }
    seen.add(entry.entryId)
  }
}

function validateJsonEntries(
  entries: ReadonlyArray<{ entryId: string; text: string }>,
  context: z.RefinementCtx
): void {
  validateEntries(entries, context)

  let totalBytes = 0
  for (const [index, entry] of entries.entries()) {
    const entryBytes = utf8Bytes(entry.text)
    totalBytes += entryBytes
    if (entryBytes > IMPORT_MAX_ENTRY_BYTES) {
      context.addIssue({
        code: 'too_big',
        maximum: IMPORT_MAX_ENTRY_BYTES,
        origin: 'string',
        message: 'Import files must be 10 MiB or smaller.',
        path: ['entries', index, 'text']
      })
    }
  }

  if (totalBytes > IMPORT_MAX_BATCH_BYTES) {
    context.addIssue({
      code: 'too_big',
      maximum: IMPORT_MAX_BATCH_BYTES,
      origin: 'array',
      message: 'The import batch must be 25 MiB or smaller.',
      path: ['entries']
    })
  }
}

export const importBatchInputDtoSchema = z.discriminatedUnion('source', [
  z
    .strictObject({
      source: z.literal('DND_BEYOND'),
      entries: z.array(dndBeyondImportEntryDtoSchema).min(1).max(IMPORT_MAX_ENTRIES)
    })
    .superRefine(({ entries }, context) => validateEntries(entries, context)),
  z
    .strictObject({
      source: z.literal('FOUNDRY_DND5E'),
      entries: z.array(jsonImportEntryDtoSchema).min(1).max(IMPORT_MAX_ENTRIES)
    })
    .superRefine(({ entries }, context) => validateJsonEntries(entries, context)),
  z
    .strictObject({
      source: z.literal('ARTIFICER_JSON'),
      entries: z.array(jsonImportEntryDtoSchema).min(1).max(IMPORT_MAX_ENTRIES)
    })
    .superRefine(({ entries }, context) => validateJsonEntries(entries, context))
])

export const importIssueDtoSchema = z.strictObject({
  severity: importIssueSeverityDtoSchema,
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.array(z.union([z.string(), z.number().int()])),
  attemptedMatch: z.string().min(1).optional(),
  correctionRequired: z.boolean()
})

export const importCollisionDtoSchema = z.strictObject({
  subjectKind: z.union([authoredSubjectKindDtoSchema, z.literal('CHARACTER')]),
  subjectId: z.string().min(1),
  label: z.string().min(1),
  hasExistingDraft: z.boolean(),
  allowedChoices: z.array(importCollisionChoiceDtoSchema).min(1),
  defaultChoice: importCollisionChoiceDtoSchema
})

export const importDestinationDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CHARACTER_BUILDER_DRAFT'), subjectId: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('AUTHORED_DRAFT'),
    subjectKind: authoredSubjectKindDtoSchema,
    subjectId: z.string().min(1)
  }),
  z.strictObject({
    kind: z.literal('ACTIVE_AUTHORED_CONTENT'),
    subjectKind: authoredSubjectKindDtoSchema,
    subjectId: z.string().min(1)
  })
])

export const importRelatedContentDtoSchema = z.strictObject({
  externalId: z.string().min(1),
  label: z.string().min(1),
  subjectKind: authoredSubjectKindDtoSchema,
  activationEligible: z.boolean(),
  destination: importDestinationDtoSchema
})

export const importExistingMatchDtoSchema = z.strictObject({
  sourceLabel: z.string().min(1),
  matchedLabel: z.string().min(1),
  subjectKind: authoredSubjectKindDtoSchema,
  count: z.number().int().positive()
})

export const importNotImportedDtoSchema = z.strictObject({
  label: z.string().min(1),
  subjectKind: authoredSubjectKindDtoSchema,
  count: z.number().int().positive()
})

export const importPreviewItemDtoSchema = z.strictObject({
  entryId: importEntryIdDtoSchema,
  name: z.string().min(1),
  status: importPreviewStatusDtoSchema,
  label: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  issues: z.array(importIssueDtoSchema),
  collision: importCollisionDtoSchema.optional(),
  destination: importDestinationDtoSchema.optional(),
  relatedContent: z.array(importRelatedContentDtoSchema).optional(),
  existingMatches: z.array(importExistingMatchDtoSchema).optional(),
  notImported: z.array(importNotImportedDtoSchema).optional()
})

export const importPreviewResponseDtoSchema = z.strictObject({
  source: importSourceDtoSchema,
  items: z.array(importPreviewItemDtoSchema),
  summary: z.strictObject({
    ready: z.number().int().nonnegative(),
    needsReview: z.number().int().nonnegative(),
    unable: z.number().int().nonnegative()
  })
})

export const importCollisionResolutionDtoSchema = z
  .strictObject({
    entryId: importEntryIdDtoSchema,
    choice: importCollisionChoiceDtoSchema.default('COPY'),
    confirmDraftReplacement: z.boolean().default(false)
  })
  .superRefine((resolution, context) => {
    if (resolution.choice === 'COPY' && resolution.confirmDraftReplacement) {
      context.addIssue({
        code: 'custom',
        message: 'Draft replacement confirmation applies only to UPDATE_DRAFT.',
        path: ['confirmDraftReplacement']
      })
    }
  })

export const importCustomContentChoiceDtoSchema = z.strictObject({
  entryId: importEntryIdDtoSchema,
  externalId: z.string().min(1),
  subjectKind: authoredSubjectKindDtoSchema,
  choice: z.enum(['ACTIVE', 'DRAFT'])
})

export const importCommitRequestDtoSchema = z
  .strictObject({
    batch: importBatchInputDtoSchema,
    selectedEntryIds: z.array(importEntryIdDtoSchema).max(IMPORT_MAX_ENTRIES),
    resolutions: z.array(importCollisionResolutionDtoSchema).max(IMPORT_MAX_ENTRIES).default([]),
    customContentChoices: z
      .array(importCustomContentChoiceDtoSchema)
      .max(IMPORT_MAX_CUSTOM_CONTENT_CHOICES)
      .default([])
  })
  .superRefine((request, context) => {
    const batchIds = new Set(request.batch.entries.map((entry) => entry.entryId))
    const selected = new Set<string>()
    const resolved = new Set<string>()
    const customContent = new Set<string>()
    for (const [index, entryId] of request.selectedEntryIds.entries()) {
      if (selected.has(entryId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate selected import entry id "${entryId}".`,
          path: ['selectedEntryIds', index]
        })
      }
      if (!batchIds.has(entryId)) {
        context.addIssue({
          code: 'custom',
          message: `Selected import entry id "${entryId}" is not in this batch.`,
          path: ['selectedEntryIds', index]
        })
      }
      selected.add(entryId)
    }

    for (const [index, resolution] of request.resolutions.entries()) {
      if (resolved.has(resolution.entryId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate collision resolution entry id "${resolution.entryId}".`,
          path: ['resolutions', index, 'entryId']
        })
      }
      if (!batchIds.has(resolution.entryId)) {
        context.addIssue({
          code: 'custom',
          message: `Collision resolution entry id "${resolution.entryId}" is not in this batch.`,
          path: ['resolutions', index, 'entryId']
        })
      }
      resolved.add(resolution.entryId)
    }
    for (const [index, choice] of request.customContentChoices.entries()) {
      const key = `${choice.entryId}:${choice.subjectKind}:${choice.externalId}`
      if (customContent.has(key)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate custom content choice "${key}".`,
          path: ['customContentChoices', index]
        })
      }
      if (!batchIds.has(choice.entryId)) {
        context.addIssue({
          code: 'custom',
          message: `Custom content choice entry id "${choice.entryId}" is not in this batch.`,
          path: ['customContentChoices', index, 'entryId']
        })
      }
      customContent.add(key)
    }
  })

export const importResultOutcomeDtoSchema = z.enum(['CREATED', 'UPDATED', 'SKIPPED', 'FAILED'])

export const importResultItemDtoSchema = z.strictObject({
  entryId: importEntryIdDtoSchema,
  name: z.string().min(1),
  outcome: importResultOutcomeDtoSchema,
  label: z.string().min(1).optional(),
  issues: z.array(importIssueDtoSchema),
  destination: importDestinationDtoSchema.optional(),
  relatedContent: z.array(importRelatedContentDtoSchema).optional(),
  publicId: z.string().min(1).optional()
})

export const importResultReportDtoSchema = z.strictObject({
  source: importSourceDtoSchema,
  items: z.array(importResultItemDtoSchema),
  summary: z.strictObject({
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative()
  })
})

export const artificerPortableReferenceDtoSchema = z.strictObject({
  kind: authoredSubjectKindDtoSchema,
  id: z.string().min(1).nullable().optional(),
  label: z.string().min(1),
  importSource: importSourceDtoSchema.nullable().optional(),
  importId: z.string().min(1).nullable().optional()
})

export const artificerPortableContentDtoSchema = z.strictObject({
  format: z.literal('artificer-content'),
  version: z.literal(1),
  item: z.strictObject({
    kind: authoredSubjectKindDtoSchema,
    data: unknownObjectSchema
  }),
  references: z.array(artificerPortableReferenceDtoSchema)
})

export const authoredContentExportRequestDtoSchema = z.strictObject({
  subjectKind: authoredSubjectKindDtoSchema,
  id: z.string().min(1),
  view: z.enum(['active', 'draft']).default('active')
})

export type ImportSourceDto = z.infer<typeof importSourceDtoSchema>
export type ImportBatchInputDto = z.infer<typeof importBatchInputDtoSchema>
export type DndBeyondImportEntryDto = z.infer<typeof dndBeyondImportEntryDtoSchema>
export type JsonImportEntryDto = z.infer<typeof jsonImportEntryDtoSchema>
export type ImportIssueDto = z.infer<typeof importIssueDtoSchema>
export type ImportCollisionChoiceDto = z.infer<typeof importCollisionChoiceDtoSchema>
export type ImportCollisionDto = z.infer<typeof importCollisionDtoSchema>
export type ImportCollisionResolutionDto = z.infer<typeof importCollisionResolutionDtoSchema>
export type ImportDestinationDto = z.infer<typeof importDestinationDtoSchema>
export type ImportRelatedContentDto = z.infer<typeof importRelatedContentDtoSchema>
export type ImportExistingMatchDto = z.infer<typeof importExistingMatchDtoSchema>
export type ImportNotImportedDto = z.infer<typeof importNotImportedDtoSchema>
export type ImportPreviewItemDto = z.infer<typeof importPreviewItemDtoSchema>
export type ImportPreviewResponseDto = z.infer<typeof importPreviewResponseDtoSchema>
export type ImportCommitRequestDto = z.infer<typeof importCommitRequestDtoSchema>
export type ImportResultItemDto = z.infer<typeof importResultItemDtoSchema>
export type ImportResultReportDto = z.infer<typeof importResultReportDtoSchema>
export type ArtificerPortableReferenceDto = z.infer<typeof artificerPortableReferenceDtoSchema>
export type ArtificerPortableContentDto = z.infer<typeof artificerPortableContentDtoSchema>
export type AuthoredContentExportRequestDto = z.infer<typeof authoredContentExportRequestDtoSchema>

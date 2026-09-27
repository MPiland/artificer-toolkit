import { z, lazySchema } from '../zod.js'

import { AUTHORED_LIMITS, unknownObjectSchema } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredSubjectKindSchema } from '../projections/identity.js'

export const IMPORT_MAX_ENTRIES = 25
export const IMPORT_MAX_CUSTOM_CONTENT_CHOICES = 1000
export const IMPORT_MAX_ENTRY_BYTES = 10 * 1024 * 1024
export const IMPORT_MAX_BATCH_BYTES = 25 * 1024 * 1024
export const IMPORT_MAX_FOUNDRY_ITEMS = AUTHORED_LIMITS.nestedCollectionItems
export const IMPORT_MAX_PORTABLE_REFERENCES = AUTHORED_LIMITS.referenceCollectionItems
export const IMPORT_MAX_PORTABLE_DEPTH = AUTHORED_LIMITS.jsonNestingDepth
export const IMPORT_MAX_PORTABLE_NODES = 10_000
export const IMPORT_MAX_BATCH_RELATIONSHIPS = IMPORT_MAX_CUSTOM_CONTENT_CHOICES

export const importSourceDtoSchema = lazySchema(() =>
  z.enum(['DND_BEYOND', 'FOUNDRY_DND5E', 'ARTIFICER_JSON'])
)

// Owner-scoped external identities survive authored replacement and draft deletion.
export const authoredStoredImportReferenceSchema = lazySchema(() =>
  z.strictObject({
    userId: postgresUuidSchema,
    importJobId: z.optional(postgresUuidSchema),
    source: importSourceDtoSchema,
    subjectKind: z.union([authoredSubjectKindSchema, z.literal('CHARACTER')]),
    externalId: z.string().check(z.minLength(1)),
    subjectId: postgresUuidSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
)

export const importCollisionChoiceDtoSchema = lazySchema(() => z.enum(['COPY', 'UPDATE_DRAFT']))
export const importPreviewStatusDtoSchema = lazySchema(() =>
  z.enum(['READY', 'NEEDS_REVIEW', 'UNABLE'])
)
export const importIssueSeverityDtoSchema = lazySchema(() => z.enum(['INFO', 'WARNING', 'ERROR']))

export const importEntryIdDtoSchema = lazySchema(() =>
  z.string().check(z.minLength(1)).check(z.maxLength(128))
)
export const importEntryNameDtoSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(255))
)

export const importUploadIntentRequestDtoSchema = lazySchema(() =>
  z.strictObject({
    entryId: importEntryIdDtoSchema,
    name: importEntryNameDtoSchema,
    declaredBytes: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(IMPORT_MAX_ENTRY_BYTES))
  })
)

export const importUploadIntentResultDtoSchema = lazySchema(() =>
  z.strictObject({
    claimId: z.string().check(z.uuid()),
    uploadUrl: z.string().check(z.url()),
    expiresAt: z.iso.datetime()
  })
)

export const importUploadCompletionRequestDtoSchema = lazySchema(() =>
  z.strictObject({
    claimId: z.string().check(z.uuid()),
    storageId: z.string().check(z.minLength(1))
  })
)

export const importUploadCompletionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    claimId: z.string().check(z.uuid()),
    status: z.enum(['READY', 'REJECTED'])
  })
)

export const dndBeyondImportEntryDtoSchema = lazySchema(() =>
  z.strictObject({
    entryId: importEntryIdDtoSchema,
    url: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(2048))
  })
)

export const jsonImportEntryDtoSchema = lazySchema(() =>
  z.strictObject({
    entryId: importEntryIdDtoSchema,
    name: importEntryNameDtoSchema,
    text: z.string()
  })
)

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function validateEntries(
  entries: ReadonlyArray<{ entryId: string }>,
  context: z.core.$RefinementCtx
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
  context: z.core.$RefinementCtx
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

export const importBatchInputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('source', [
    z
      .strictObject({
        source: z.literal('DND_BEYOND'),
        systemId: z.string().check(z.uuid()),
        primaryRulesCatalogueId: z.string().check(z.uuid()),
        entries: z
          .array(dndBeyondImportEntryDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(IMPORT_MAX_ENTRIES))
      })
      .check(z.superRefine(({ entries }, context) => validateEntries(entries, context))),
    z
      .strictObject({
        source: z.literal('FOUNDRY_DND5E'),
        systemId: z.string().check(z.uuid()),
        primaryRulesCatalogueId: z.string().check(z.uuid()),
        entries: z
          .array(jsonImportEntryDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(IMPORT_MAX_ENTRIES))
      })
      .check(z.superRefine(({ entries }, context) => validateJsonEntries(entries, context))),
    z
      .strictObject({
        source: z.literal('ARTIFICER_JSON'),
        entries: z
          .array(jsonImportEntryDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(IMPORT_MAX_ENTRIES))
      })
      .check(z.superRefine(({ entries }, context) => validateJsonEntries(entries, context)))
  ])
)

export const importIssueDtoSchema = lazySchema(() =>
  z.strictObject({
    severity: importIssueSeverityDtoSchema,
    code: z.string().check(z.minLength(1)),
    message: z.string().check(z.minLength(1)),
    path: z.array(z.union([z.string(), z.number().check(z.int())])),
    attemptedMatch: z.optional(z.string().check(z.minLength(1))),
    correctionRequired: z.boolean()
  })
)

export const importCollisionDtoSchema = lazySchema(() =>
  z.strictObject({
    subjectKind: z.union([authoredSubjectKindSchema, z.literal('CHARACTER')]),
    subjectId: z.string().check(z.minLength(1)),
    label: z.string().check(z.minLength(1)),
    hasExistingDraft: z.boolean(),
    allowedChoices: z.array(importCollisionChoiceDtoSchema).check(z.minLength(1)),
    defaultChoice: importCollisionChoiceDtoSchema
  })
)

export const importDestinationDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHARACTER_BUILDER_DRAFT'),
      subjectId: z.string().check(z.minLength(1))
    }),
    z.strictObject({
      kind: z.literal('AUTHORED_DRAFT'),
      subjectKind: authoredSubjectKindSchema,
      subjectId: z.string().check(z.minLength(1))
    }),
    z.strictObject({
      kind: z.literal('ACTIVE_AUTHORED_CONTENT'),
      subjectKind: authoredSubjectKindSchema,
      subjectId: z.string().check(z.minLength(1))
    })
  ])
)

export const importRelatedContentDtoSchema = lazySchema(() =>
  z.strictObject({
    externalId: z.string().check(z.minLength(1)),
    label: z.string().check(z.minLength(1)),
    subjectKind: authoredSubjectKindSchema,
    activationEligible: z.boolean(),
    destination: importDestinationDtoSchema
  })
)

export const importExistingMatchDtoSchema = lazySchema(() =>
  z.strictObject({
    sourceLabel: z.string().check(z.minLength(1)),
    matchedLabel: z.string().check(z.minLength(1)),
    subjectKind: authoredSubjectKindSchema,
    count: z.number().check(z.int()).check(z.positive())
  })
)

export const importNotImportedDtoSchema = lazySchema(() =>
  z.strictObject({
    label: z.string().check(z.minLength(1)),
    subjectKind: authoredSubjectKindSchema,
    count: z.number().check(z.int()).check(z.positive())
  })
)

export const importPreviewItemDtoSchema = lazySchema(() =>
  z.strictObject({
    entryId: importEntryIdDtoSchema,
    name: z.string().check(z.minLength(1)),
    status: importPreviewStatusDtoSchema,
    label: z.optional(z.string().check(z.minLength(1))),
    externalId: z.optional(z.string().check(z.minLength(1))),
    issues: z.array(importIssueDtoSchema),
    collision: z.optional(importCollisionDtoSchema),
    destination: z.optional(importDestinationDtoSchema),
    relatedContent: z.optional(z.array(importRelatedContentDtoSchema)),
    existingMatches: z.optional(z.array(importExistingMatchDtoSchema)),
    notImported: z.optional(z.array(importNotImportedDtoSchema))
  })
)

export const importPreviewResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    source: importSourceDtoSchema,
    items: z.array(importPreviewItemDtoSchema),
    summary: z.strictObject({
      ready: z.number().check(z.int()).check(z.nonnegative()),
      needsReview: z.number().check(z.int()).check(z.nonnegative()),
      unable: z.number().check(z.int()).check(z.nonnegative())
    })
  })
)

export const importCollisionResolutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      entryId: importEntryIdDtoSchema,
      choice: z._default(importCollisionChoiceDtoSchema, 'COPY'),
      confirmDraftReplacement: z._default(z.boolean(), false)
    })
    .check(
      z.superRefine((resolution, context) => {
        if (resolution.choice === 'COPY' && resolution.confirmDraftReplacement) {
          context.addIssue({
            code: 'custom',
            message: 'Draft replacement confirmation applies only to UPDATE_DRAFT.',
            path: ['confirmDraftReplacement']
          })
        }
      })
    )
)

export const importCustomContentChoiceDtoSchema = lazySchema(() =>
  z.strictObject({
    entryId: importEntryIdDtoSchema,
    externalId: z.string().check(z.minLength(1)),
    subjectKind: authoredSubjectKindSchema,
    choice: z.enum(['ACTIVE', 'DRAFT'])
  })
)

export const importCommitRequestDtoSchema = lazySchema(() =>
  z
    .strictObject({
      batch: importBatchInputDtoSchema,
      selectedEntryIds: z.array(importEntryIdDtoSchema).check(z.maxLength(IMPORT_MAX_ENTRIES)),
      resolutions: z._default(
        z.array(importCollisionResolutionDtoSchema).check(z.maxLength(IMPORT_MAX_ENTRIES)),
        []
      ),
      customContentChoices: z._default(
        z
          .array(importCustomContentChoiceDtoSchema)
          .check(z.maxLength(IMPORT_MAX_CUSTOM_CONTENT_CHOICES)),
        []
      )
    })
    .check(
      z.superRefine((request, context) => {
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
    )
)

export const importResultOutcomeDtoSchema = lazySchema(() =>
  z.enum(['CREATED', 'UPDATED', 'SKIPPED', 'FAILED'])
)

export const importResultItemDtoSchema = lazySchema(() =>
  z.strictObject({
    entryId: importEntryIdDtoSchema,
    name: z.string().check(z.minLength(1)),
    outcome: importResultOutcomeDtoSchema,
    label: z.optional(z.string().check(z.minLength(1))),
    issues: z.array(importIssueDtoSchema),
    destination: z.optional(importDestinationDtoSchema),
    relatedContent: z.optional(z.array(importRelatedContentDtoSchema)),
    publicId: z.optional(z.string().check(z.minLength(1)))
  })
)

export const importResultReportDtoSchema = lazySchema(() =>
  z.strictObject({
    source: importSourceDtoSchema,
    items: z.array(importResultItemDtoSchema),
    summary: z.strictObject({
      created: z.number().check(z.int()).check(z.nonnegative()),
      updated: z.number().check(z.int()).check(z.nonnegative()),
      skipped: z.number().check(z.int()).check(z.nonnegative()),
      failed: z.number().check(z.int()).check(z.nonnegative())
    })
  })
)

export const artificerPortableReferenceDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: authoredSubjectKindSchema,
    id: z.optional(z.nullable(z.string().check(z.minLength(1)))),
    label: z.string().check(z.minLength(1)),
    importSource: z.optional(z.nullable(importSourceDtoSchema)),
    importId: z.optional(z.nullable(z.string().check(z.minLength(1))))
  })
)

function validatePortableDataLimits(value: unknown, context: z.core.$RefinementCtx): void {
  const pending: Array<{ value: unknown; depth: number; path: Array<string | number> }> = [
    { value, depth: 0, path: [] }
  ]
  const seen = new Set<object>()
  let nodeCount = 0

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current) continue
    if (current.depth > IMPORT_MAX_PORTABLE_DEPTH) {
      context.addIssue({
        code: 'custom',
        message: `Portable content data may be nested at most ${IMPORT_MAX_PORTABLE_DEPTH} levels.`,
        path: current.path
      })
      return
    }

    nodeCount += 1
    if (nodeCount > IMPORT_MAX_PORTABLE_NODES) {
      context.addIssue({
        code: 'custom',
        message: `Portable content data may contain at most ${IMPORT_MAX_PORTABLE_NODES} nodes.`,
        path: current.path
      })
      return
    }

    if (typeof current.value !== 'object' || current.value === null) continue
    if (seen.has(current.value)) continue
    seen.add(current.value)

    if (Array.isArray(current.value)) {
      if (current.value.length > IMPORT_MAX_PORTABLE_REFERENCES) {
        context.addIssue({
          code: 'custom',
          message: `Portable content arrays may contain at most ${IMPORT_MAX_PORTABLE_REFERENCES} items.`,
          path: current.path
        })
        return
      }
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        pending.push({
          value: current.value[index],
          depth: current.depth + 1,
          path: [...current.path, index]
        })
      }
      continue
    }

    for (const [key, child] of Object.entries(current.value)) {
      pending.push({ value: child, depth: current.depth + 1, path: [...current.path, key] })
    }
  }
}

export const artificerPortableContentDtoSchema = lazySchema(() =>
  z.strictObject({
    format: z.literal('artificer-content'),
    version: z.literal(1),
    item: z.strictObject({
      kind: authoredSubjectKindSchema,
      data: unknownObjectSchema.check(z.superRefine(validatePortableDataLimits))
    }),
    references: z
      .array(artificerPortableReferenceDtoSchema)
      .check(z.maxLength(IMPORT_MAX_PORTABLE_REFERENCES))
  })
)

export const authoredContentExportRequestDtoSchema = lazySchema(() =>
  z.strictObject({
    subjectKind: authoredSubjectKindSchema,
    id: z.string().check(z.minLength(1)),
    view: z._default(z.enum(['active', 'draft']), 'active')
  })
)

export type ImportSourceDto = z.infer<typeof importSourceDtoSchema>
export type ImportUploadIntentRequestDto = z.infer<typeof importUploadIntentRequestDtoSchema>
export type ImportUploadIntentResultDto = z.infer<typeof importUploadIntentResultDtoSchema>
export type ImportUploadCompletionRequestDto = z.infer<
  typeof importUploadCompletionRequestDtoSchema
>
export type ImportUploadCompletionResultDto = z.infer<typeof importUploadCompletionResultDtoSchema>
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

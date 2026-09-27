import { z, lazySchema } from '../zod.js'
import {
  authoredSubjectKindSchema,
  jsonValueSchema,
  projectionChecksumSchema
} from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { reusableDefinitionFamilyKeyDtoSchema } from '../shared/reusableDefinitionIdentity.js'

const canonicalUuidSchema = lazySchema(() =>
  postgresUuidSchema.check(
    z.refine((value) => value === value.toLowerCase(), 'Canonical UUIDs must be lowercase.')
  )
)
const labelSchema = lazySchema(() => z.string().check(z.minLength(1)).check(z.maxLength(240)))

// Document-specific schemas and checksums are checked again inside the import mutation.
// Keeping their JSON representation here avoids a second, divergent authored schema graph.
export const sourceImportSystemDtoSchema = lazySchema(() =>
  z.strictObject({
    id: canonicalUuidSchema,
    checksum: projectionChecksumSchema,
    document: jsonValueSchema
  })
)

export const sourceImportSubjectDtoSchema = lazySchema(() =>
  z.strictObject({
    subjectKind: authoredSubjectKindSchema,
    id: canonicalUuidSchema,
    systemId: canonicalUuidSchema,
    label: labelSchema,
    checksum: projectionChecksumSchema,
    document: jsonValueSchema
  })
)

// Authored mechanics exceed Convex's 16-level document nesting limit. Metadata
// remains indexed; the validated, canonical JSON payload is losslessly encoded.
export const sourceImportStoredSubjectDtoSchema = lazySchema(() =>
  z.extend(z.omit(sourceImportSubjectDtoSchema, { document: true }), { documentJson: z.string() })
)

export const sourceImportDefinitionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: canonicalUuidSchema,
    definitionFamilyKey: reusableDefinitionFamilyKeyDtoSchema,
    label: labelSchema,
    description: z.string().check(z.maxLength(4_000)),
    checksum: projectionChecksumSchema,
    document: jsonValueSchema
  })
)

export const sourceImportCatalogueDtoSchema = lazySchema(() =>
  z.strictObject({
    id: canonicalUuidSchema,
    gameSystemId: canonicalUuidSchema,
    code: z.string().check(z.minLength(1)).check(z.maxLength(80)),
    label: labelSchema,
    description: z.string().check(z.maxLength(4_000))
  })
)

export const sourceImportContentSourceDtoSchema = lazySchema(() =>
  z.extend(sourceImportCatalogueDtoSchema, {
    kind: z.literal('PLATFORM'),
    ownerUserId: z.null()
  })
)

// Runtime provenance includes owned homebrew. Canonical imports deliberately keep
// the narrower PLATFORM-only contract above.
export const authoredContentSourceDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    sourceImportContentSourceDtoSchema,
    z.extend(sourceImportCatalogueDtoSchema, {
      id: z.pipe(
        z.uuid(),
        z.transform((value) => value.toLowerCase())
      ),
      kind: z.literal('USER'),
      ownerUserId: z.pipe(
        z.uuid(),
        z.transform((value) => value.toLowerCase())
      )
    })
  ])
)

export const sourceImportBatchResultDtoSchema = lazySchema(() =>
  z.strictObject({
    inserted: z.number().check(z.int()).check(z.nonnegative()),
    reused: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const sourceImportAuditDtoSchema = lazySchema(() =>
  z.strictObject({
    systems: z.number().check(z.int()).check(z.nonnegative()),
    subjects: z.number().check(z.int()).check(z.nonnegative()),
    definitions: z.number().check(z.int()).check(z.nonnegative()),
    manifestChecksum: projectionChecksumSchema
  })
)
export const sourceImportSeedResultDtoSchema = lazySchema(() =>
  z.extend(sourceImportAuditDtoSchema, sourceImportBatchResultDtoSchema.shape)
)

export type SourceImportSubjectDto = z.infer<typeof sourceImportSubjectDtoSchema>

export const sourceImportBootstrapInputSchema = lazySchema(() =>
  z.strictObject({
    // One platform source/catalogue pair authorizes exactly one System per import.
    systems: z.array(sourceImportSystemDtoSchema).check(z.length(1)),
    contentSource: sourceImportContentSourceDtoSchema,
    catalogue: sourceImportCatalogueDtoSchema
  })
)

export const sourceImportSubjectsInputSchema = lazySchema(() =>
  z.strictObject({
    contentSourceId: canonicalUuidSchema,
    subjects: z.array(sourceImportSubjectDtoSchema).check(z.minLength(1)).check(z.maxLength(10))
  })
)

export const sourceImportDefinitionsInputSchema = lazySchema(() =>
  z.strictObject({
    contentSourceId: canonicalUuidSchema,
    definitions: z
      .array(sourceImportDefinitionDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(10))
  })
)

export const sourceImportReadBootstrapInputSchema = lazySchema(() =>
  z.strictObject({
    systemIds: z.array(canonicalUuidSchema).check(z.minLength(1)).check(z.maxLength(4)),
    contentSourceId: canonicalUuidSchema,
    catalogueId: canonicalUuidSchema
  })
)

export const sourceImportAuditRecordDtoSchema = lazySchema(() =>
  z.strictObject({
    id: canonicalUuidSchema,
    checksum: projectionChecksumSchema
  })
)
export const sourceImportBootstrapResultDtoSchema = lazySchema(() =>
  z.strictObject({
    systems: z.array(sourceImportAuditRecordDtoSchema),
    contentSource: sourceImportContentSourceDtoSchema,
    catalogue: sourceImportCatalogueDtoSchema
  })
)
export const sourceImportAuditPageDtoSchema = lazySchema(() =>
  z.strictObject({
    page: z.array(sourceImportAuditRecordDtoSchema),
    isDone: z.boolean(),
    continueCursor: z.string()
  })
)
export type SourceImportBootstrapResultDto = z.infer<typeof sourceImportBootstrapResultDtoSchema>
export type SourceImportAuditPageDto = z.infer<typeof sourceImportAuditPageDtoSchema>
export type SourceImportDefinitionDto = z.infer<typeof sourceImportDefinitionDtoSchema>
export type SourceImportAuditDto = z.infer<typeof sourceImportAuditDtoSchema>
export type SourceImportSeedResultDto = z.infer<typeof sourceImportSeedResultDtoSchema>
export type SourceImportBootstrapInput = z.infer<typeof sourceImportBootstrapInputSchema>
export type SourceImportSubjectsInput = z.infer<typeof sourceImportSubjectsInputSchema>
export type SourceImportDefinitionsInput = z.infer<typeof sourceImportDefinitionsInputSchema>
export type SourceImportBatchResultDto = z.infer<typeof sourceImportBatchResultDtoSchema>

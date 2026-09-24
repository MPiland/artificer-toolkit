import { z } from '../zod.js'
import { IMPORT_MAX_ENTRY_BYTES } from './imports.js'
import { authoredSubjectKindSchema, projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { unknownObjectSchema } from '../shared/authoredLimits.js'

export const authoredDraftStateDtoSchema = z.enum(['DRAFT_ONLY', 'ACTIVE_WITH_DRAFT'])
export const authoredDraftSummaryDtoSchema = z.object({
  subjectKind: authoredSubjectKindSchema,
  subjectId: z.string(),
  publicId: z.string(),
  userId: z.string(),
  systemId: z.string(),
  label: z.string(),
  description: z.optional(z.nullable(z.string())),
  status: z.literal('DRAFT'),
  category: z.optional(z.string()),
  level: z.optional(z.number().check(z.int())),
  magicSchoolId: z.optional(z.nullable(z.string())),
  castingTimeUnit: z.optional(z.string()),
  castingTimeAmount: z.optional(z.number().check(z.int())),
  draftState: authoredDraftStateDtoSchema,
  baseActiveUpdatedAt: z.nullable(z.string()),
  createdAt: z.optional(z.string()),
  updatedAt: z.optional(z.string())
})
export const authoredDraftDtoSchema = z.extend(authoredDraftSummaryDtoSchema, {
  payload: unknownObjectSchema
})
export const authoredDraftSaveRequestDtoSchema = z.object({
  subjectKind: authoredSubjectKindSchema,
  subjectId: z.string(),
  systemId: z.string(),
  label: z.string(),
  payload: unknownObjectSchema
})

const uuid = z.pipe(
  postgresUuidSchema,
  z.transform((value) => value.toLowerCase())
)

export const authoredDraftLookupInputSchema = z.strictObject({
  subjectKind: authoredSubjectKindSchema,
  subjectId: uuid
})

export const authoredDraftListInputSchema = z.strictObject({
  subjectKind: authoredSubjectKindSchema,
  paginationOpts: z.strictObject({
    cursor: z.nullable(z.string()),
    numItems: z.number().check(z.int()).check(z.gte(1)).check(z.lte(48)),
    endCursor: z.optional(z.nullable(z.string())),
    id: z.optional(z.number())
  })
})

export const authoredDraftListPageSchema = z.strictObject({
  page: z.array(authoredDraftSummaryDtoSchema),
  isDone: z.boolean(),
  continueCursor: z.string(),
  splitCursor: z.optional(z.nullable(z.string())),
  pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
})

export const authoredDraftCommandInputSchema = z.strictObject(
  z.extend(authoredDraftSaveRequestDtoSchema, {
    subjectId: uuid,
    systemId: uuid
  }).shape
)

// Incomplete domain values are intentional in a working draft. Publish performs
// full domain validation and normalization; persistence encodes this object only.
const authoredStoredDraftHeadSchema = z.extend(z.omit(authoredDraftDtoSchema, { payload: true }), {
  basePublishedChecksum: z.nullable(projectionChecksumSchema),
  importJobId: z.optional(uuid)
})

export const AUTHORED_CHUNKED_PAYLOAD_MARKER = '{"encoding":"AUTHORED_CHUNKED_UTF8_V1"}'
export const AUTHORED_PAYLOAD_CHUNK_MAX_BYTES = 240 * 1024
export const AUTHORED_PAYLOAD_MAX_CHUNKS = Math.ceil(
  IMPORT_MAX_ENTRY_BYTES / AUTHORED_PAYLOAD_CHUNK_MAX_BYTES
)

export const authoredStoredDraftSchema = z.union([
  z.strictObject(z.extend(authoredStoredDraftHeadSchema, { payloadJson: z.string() }).shape),
  z.strictObject(z.extend(authoredStoredDraftHeadSchema, { payloadId: uuid }).shape)
])

const authoredStoredDraftPayloadFields = {
  id: uuid,
  subjectId: uuid,
  importJobId: z.optional(uuid),
  checksum: projectionChecksumSchema
}

export const authoredStoredDraftPayloadHeadSchema = z.strictObject({
  ...authoredStoredDraftPayloadFields,
  payloadJson: z.string(),
  systemId: z.optional(uuid),
  chunkCount: z.optional(
    z.number().check(z.int()).check(z.positive()).check(z.lte(AUTHORED_PAYLOAD_MAX_CHUNKS))
  ),
  totalByteLength: z.optional(
    z.number().check(z.int()).check(z.positive()).check(z.lte(IMPORT_MAX_ENTRY_BYTES))
  )
})

export const authoredStoredDraftPayloadSchema = z.union([
  z.strictObject({
    ...authoredStoredDraftPayloadFields,
    payloadJson: z.string()
  }),
  z.strictObject({
    ...authoredStoredDraftPayloadFields,
    payloadJson: z.literal(AUTHORED_CHUNKED_PAYLOAD_MARKER),
    systemId: uuid,
    chunkCount: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(AUTHORED_PAYLOAD_MAX_CHUNKS)),
    totalByteLength: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(IMPORT_MAX_ENTRY_BYTES))
  })
])

const authoredStoredPayloadChunkFields = {
  subjectId: uuid,
  systemId: uuid,
  chunkIndex: z.number().check(z.int()).check(z.gte(0)).check(z.lt(AUTHORED_PAYLOAD_MAX_CHUNKS))
}

export const authoredStoredDraftPayloadChunkSchema = z.strictObject({
  ...authoredStoredPayloadChunkFields,
  payloadId: uuid
})

export const authoredStoredVersionPayloadChunkSchema = z.strictObject({
  ...authoredStoredPayloadChunkFields,
  versionId: uuid
})

export type AuthoredDraftCommandInput = z.infer<typeof authoredDraftCommandInputSchema>
export type AuthoredDraftResult = z.infer<typeof authoredDraftDtoSchema>
export type AuthoredDraftListInput = z.infer<typeof authoredDraftListInputSchema>
export type AuthoredDraftListPage = z.infer<typeof authoredDraftListPageSchema>

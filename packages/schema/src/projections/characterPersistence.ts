import { z } from '../zod.js'
import type { CharacterBuilderDraftDto } from '../api/characterBuilder.js'
import { IMPORT_MAX_ENTRY_BYTES } from '../api/imports.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'

const uuid = z.pipe(
  z.uuid(),
  z.transform((value) => value.toLowerCase())
)

// Schema evaluation must load scalar persistence contracts, not the authored mechanics graph.
export const characterStoredRecordSchema = z.strictObject({
  id: uuid,
  userId: uuid,
  systemId: postgresUuidSchema,
  // Old records remain readable during cutover; new native writes do not store this field.
  primaryRulesCatalogueId: z.optional(postgresUuidSchema),
  label: z.string(),
  status: z.enum(['ACTIVE', 'DRAFT']),
  streamVersion: z.number().check(z.int()).check(z.nonnegative()),
  documentJson: z.string(),
  checksum: projectionChecksumSchema,
  portraitAssetId: z.optional(uuid),
  portraitRevision: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  sheetState: z.optional(
    z.strictObject({
      documentJson: z.string(),
      checksum: projectionChecksumSchema
    })
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
})

/** Private DO captures preserve existing pending-maintenance checksums, including row identity. */
export const characterStoredRowSchema = z.extend(characterStoredRecordSchema, {
  _id: z.string().check(z.minLength(1)),
  _creationTime: z.number().check(z.nonnegative())
})

const characterStoredDraftHeadFields = {
  id: uuid,
  characterId: uuid,
  userId: uuid,
  systemId: postgresUuidSchema,
  publicId: z.string(),
  label: z.string(),
  status: z.literal('DRAFT'),
  mode: z.enum(['create', 'edit']),
  baseActiveUpdatedAt: z.nullable(z.iso.datetime()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  checksum: projectionChecksumSchema
}

// Convex table validation needs optional fields during the inline-to-payload transition.
// Runtime readers validate exactly one representation through characterStoredDraftSchema.
export const characterStoredDraftHeadSchema = z.strictObject({
  ...characterStoredDraftHeadFields,
  payloadJson: z.optional(z.string()),
  payloadId: z.optional(uuid)
})

export const characterStoredDraftSchema = z.union([
  z.strictObject({
    ...characterStoredDraftHeadFields,
    payloadJson: z.string()
  }),
  z.strictObject({ ...characterStoredDraftHeadFields, payloadId: uuid })
]) satisfies z.ZodMiniType<Omit<CharacterBuilderDraftDto, 'payload' | 'draftState'>>

export const CHARACTER_DRAFT_PAYLOAD_CHUNK_MAX_BYTES = 240 * 1024
export const CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS = Math.ceil(
  IMPORT_MAX_ENTRY_BYTES / CHARACTER_DRAFT_PAYLOAD_CHUNK_MAX_BYTES
)

const characterStoredDraftPayloadFields = {
  id: uuid,
  characterId: uuid,
  importJobId: z.optional(uuid),
  checksum: projectionChecksumSchema,
  createdAt: z.iso.datetime()
}

// Existing one-row payloads remain readable while new writes use the chunk metadata.
export const characterStoredDraftPayloadHeadSchema = z.strictObject({
  ...characterStoredDraftPayloadFields,
  payloadJson: z.optional(z.string()),
  chunkCount: z.optional(
    z.number().check(z.int()).check(z.positive()).check(z.lte(CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS))
  ),
  totalByteLength: z.optional(
    z.number().check(z.int()).check(z.positive()).check(z.lte(IMPORT_MAX_ENTRY_BYTES))
  )
})

export const characterStoredDraftPayloadSchema = z.union([
  z.strictObject({
    ...characterStoredDraftPayloadFields,
    payloadJson: z.string()
  }),
  z.strictObject({
    ...characterStoredDraftPayloadFields,
    chunkCount: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS)),
    totalByteLength: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(IMPORT_MAX_ENTRY_BYTES))
  })
])

export const characterStoredDraftPayloadChunkSchema = z.strictObject({
  characterId: uuid,
  payloadId: uuid,
  chunkIndex: z
    .number()
    .check(z.int())
    .check(z.gte(0))
    .check(z.lt(CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS))
})

export const characterStoredCommandReceiptSchema = z.strictObject({
  id: uuid,
  characterId: uuid,
  commandId: uuid,
  actorId: uuid,
  commandFingerprint: projectionChecksumSchema,
  occurredAt: z.iso.datetime(),
  historyJson: z.string(),
  historyChecksum: projectionChecksumSchema
})

import { z, lazySchema, lazySchemaParts } from '../zod.js'
import type { CharacterBuilderDraftDto } from '../api/characterBuilder.js'
import { IMPORT_MAX_ENTRY_BYTES } from '../api/imports.js'
import { normalizedImageCropSchema } from '../api/media.js'
import { AUTHORED_LIMITS, authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { characterPlayStateSchema } from './characterPlayState.js'

const uuid = lazySchema(() =>
  z.pipe(
    z.uuid(),
    z.transform((value) => value.toLowerCase())
  )
)

// Schema evaluation must load persistence contracts, not the authored mechanics graph.
const characterHeadFields = lazySchemaParts(() => ({
  id: uuid,
  userId: uuid,
  systemId: postgresUuidSchema,
  label: z.string(),
  status: z.enum(['ACTIVE', 'DRAFT']),
  portraitAssetId: z.optional(uuid),
  portraitRevision: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  /** The portrait's own framing; the same image framed differently elsewhere is unaffected. */
  portraitCrop: z.optional(normalizedImageCropSchema),
  createdAt: z.iso.datetime()
}))

/**
 * Identity only; mutable values live in typed operational records. The structure clock lives on the
 * build record, so a Sheet command never replaces the head every Campaign read joins (ADR 0035
 * Amendment 12, RELIABILITY-21.16). Structure hashes are derived when the records are assembled, so
 * a focused write never recomputes them.
 */
export const characterStoredHeadSchema = lazySchema(() => z.strictObject(characterHeadFields()))

/** Complete private structure capture assembled at rules, export and room boundaries. */
export const characterStoredRecordSchema = lazySchema(() =>
  z.strictObject({
    ...characterHeadFields(),
    /** The structure clock, read from the build record (`characterStoredBuildStateSchema`). */
    updatedAt: z.iso.datetime(),
    /** Integrity of the complete structure assembled from the owned records. */
    checksum: projectionChecksumSchema,
    sheetStateChecksum: z.optional(projectionChecksumSchema),
    documentJson: z.string(),
    sheetState: z.optional(
      z.strictObject({
        documentJson: z.string(),
        checksum: projectionChecksumSchema
      })
    )
  })
)

/**
 * A Character's small, hot play record, one per Character (ADR 0035 Amendment 12): the play fields
 * (`characterPlayStateSchema`) as typed fields beside the Character's own version and derived
 * stats. Every play write replaces only this record, never the large Character document.
 */
export const characterStoredPlayStateSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuid,
    /** The owner, copied from the Character so party-visibility reads never load the document. */
    userId: uuid,
    /**
     * The play version: play commands check it, and a Builder commit advances it only when it changes
     * play state. A Builder commit that leaves play state alone never invalidates a Sheet command.
     */
    streamVersion: z.number().check(z.int()).check(z.nonnegative()),
    /**
     * Effective maximum hit points from the Character's own rules evaluation, before active-effect
     * hit point maximum reductions, rewritten by every Character write (`characters/characterWrites`).
     * Readers subtract the Character's active reductions (`characters/characterMaximumHitPoints`), so
     * reduction effects never rewrite the record. Rules evaluate live. Published-content changes reach
     * it on the Character's next write.
     */
    maximumHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    /**
     * The Character's evaluated typed speeds, normalized to feet, stored beside `maximumHitPoints`
     * for the movement allowances (D38, SPELLS-5.6). Active grants apply when the allowance is read.
     */
    speeds: z
      .array(
        z.strictObject({
          speedId: authoredIdentifierSchema,
          amount: z.number().check(z.nonnegative()),
          unit: z.literal('FEET')
        })
      )
      .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems)),
    state: characterPlayStateSchema,
    checksum: projectionChecksumSchema,
    /** The play clock: it advances only when the play state changes. */
    updatedAt: z.iso.datetime()
  })
)

const storedDocumentIdentity = lazySchemaParts(() => ({
  _id: z.string().check(z.minLength(1)),
  _creationTime: z.number().check(z.nonnegative())
}))

/**
 * A Character row with its play record, as private DO captures carry it and as readers join it.
 * Captures preserve existing pending-maintenance checksums, including row identity.
 */
export const characterStoredRowSchema = lazySchema(() =>
  z.extend(characterStoredRecordSchema, {
    ...storedDocumentIdentity(),
    play: z.extend(characterStoredPlayStateSchema, storedDocumentIdentity())
  })
)

/** A Character draft head; its payload lives in `characterDraftPayloads`. */
export const characterStoredDraftSchema = lazySchema(
  () =>
    z.strictObject({
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
      checksum: projectionChecksumSchema,
      /** The payload's own id, which its chunks carry. */
      payloadId: uuid,
      /**
       * The payload document's storage id, so a save replaces it in place without reading it
       * (ADR 0036 S8).
       */
      payloadDocumentId: z.string().check(z.minLength(1))
    }) satisfies z.ZodMiniType<Omit<CharacterBuilderDraftDto, 'payload' | 'draftState'>>
)

export const CHARACTER_DRAFT_PAYLOAD_CHUNK_MAX_BYTES = 240 * 1024
/**
 * A payload up to this size stays inline in its one payload document, below Convex's 1 MiB
 * document limit with room for the other fields; a larger one is chunked.
 */
export const CHARACTER_DRAFT_PAYLOAD_INLINE_MAX_BYTES = 960 * 1024
export const CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS = Math.ceil(
  IMPORT_MAX_ENTRY_BYTES / CHARACTER_DRAFT_PAYLOAD_CHUNK_MAX_BYTES
)

const characterStoredDraftPayloadFields = lazySchemaParts(() => ({
  id: uuid,
  characterId: uuid,
  importJobId: z.optional(uuid),
  checksum: projectionChecksumSchema,
  createdAt: z.iso.datetime()
}))

// The table form of `characterStoredDraftPayloadSchema`: inline JSON, or chunk metadata above
// `CHARACTER_DRAFT_PAYLOAD_INLINE_MAX_BYTES`. Readers validate exactly one of the two.
export const characterStoredDraftPayloadHeadSchema = lazySchema(() =>
  z.strictObject({
    ...characterStoredDraftPayloadFields(),
    payloadJson: z.optional(z.string()),
    chunkCount: z.optional(
      z.number().check(z.int()).check(z.positive()).check(z.lte(CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS))
    ),
    totalByteLength: z.optional(
      z.number().check(z.int()).check(z.positive()).check(z.lte(IMPORT_MAX_ENTRY_BYTES))
    )
  })
)

export const characterStoredDraftPayloadSchema = lazySchema(() =>
  z.union([
    z.strictObject({
      ...characterStoredDraftPayloadFields(),
      payloadJson: z.string()
    }),
    z.strictObject({
      ...characterStoredDraftPayloadFields(),
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
)

export const characterStoredDraftPayloadChunkSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuid,
    payloadId: uuid,
    chunkIndex: z
      .number()
      .check(z.int())
      .check(z.gte(0))
      .check(z.lt(CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS))
  })
)

export const characterStoredCommandReceiptSchema = lazySchema(() =>
  z.strictObject({
    id: uuid,
    characterId: uuid,
    commandId: uuid,
    actorId: uuid,
    commandFingerprint: projectionChecksumSchema,
    occurredAt: z.iso.datetime(),
    historyJson: z.string(),
    historyChecksum: projectionChecksumSchema
  })
)

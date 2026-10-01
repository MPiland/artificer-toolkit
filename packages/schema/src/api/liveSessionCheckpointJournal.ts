import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ROOM_INPUT_RESPONSE_DOCUMENTS } from './liveRoomInputsBatch.js'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from './liveSessionCheckpointFence.js'

const sequenceSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(Number.MAX_SAFE_INTEGER))
)

/** Lifecycle commands remain unacknowledged until their committed prefix reaches Convex. */
export const liveSessionRoomCommandDurabilitySchema = lazySchema(() =>
  z.strictObject({ checkpointBeforeAcknowledgement: z.boolean() })
)

export type LiveSessionRoomCommandDurability = z.infer<typeof liveSessionRoomCommandDurabilitySchema>

/** Only this acknowledged prefix may be retired from the room's durable command journal. */
export const liveSessionCheckpointAcknowledgementSchema = lazySchema(() =>
  z.strictObject({
    epoch: postgresUuidSchema,
    sequence: sequenceSchema,
    checksum: projectionChecksumSchema
  })
)

/** A bounded, epoch-fenced read of committed room write sets after `fromSequence`. */
export const liveSessionCheckpointJournalInputSchema = lazySchema(() =>
  z.strictObject({
    epoch: postgresUuidSchema,
    fromSequence: sequenceSchema,
    fromChecksum: projectionChecksumSchema,
    toSequence: sequenceSchema,
    maxEntries: z
      .number()
      .check(z.int())
      .check(z.gte(1))
      .check(z.lte(MAX_ROOM_INPUT_RESPONSE_DOCUMENTS)),
    maxBytes: z
      .number()
      .check(z.int())
      .check(z.gte(2))
      .check(z.lte(LIVE_SESSION_CHECKPOINT_MAX_BYTES))
  })
)

export const liveSessionCheckpointJournalEntrySchema = lazySchema(() =>
  z.strictObject({
    sequence: z.number().check(z.int()).check(z.positive()).check(z.lte(Number.MAX_SAFE_INTEGER)),
    writeSetJson: z.string(),
    writeSetChecksum: projectionChecksumSchema,
    chainChecksum: projectionChecksumSchema
  })
)

export const liveSessionCheckpointJournalResultSchema = lazySchema(() =>
  z.strictObject({
    entries: z
      .array(liveSessionCheckpointJournalEntrySchema)
      .check(z.maxLength(MAX_ROOM_INPUT_RESPONSE_DOCUMENTS)),
    toSequence: sequenceSchema,
    toChecksum: projectionChecksumSchema,
    complete: z.boolean()
  })
)

export type LiveSessionCheckpointJournalInput = z.infer<
  typeof liveSessionCheckpointJournalInputSchema
>
export type LiveSessionCheckpointAcknowledgement = z.infer<
  typeof liveSessionCheckpointAcknowledgementSchema
>
export type LiveSessionCheckpointJournalEntry = z.infer<
  typeof liveSessionCheckpointJournalEntrySchema
>
export type LiveSessionCheckpointJournalResult = z.infer<
  typeof liveSessionCheckpointJournalResultSchema
>

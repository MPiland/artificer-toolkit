import { z, lazySchema } from '../zod.js'
import { liveSessionCheckpointFenceInputSchema } from './liveSessionCheckpointFence.js'
import { liveSessionCheckpointRecordsSchema } from './liveSessionCheckpointRecords.js'
import { liveSessionAuthorityDtoSchema } from './liveSessionState.js'
import { liveSessionRoomAuthorizationRevisionsSchema } from './liveSessionRoomAuthorization.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { sceneSessionVisionCharacterRevisionsSchema } from './sceneSessionVision.js'

/**
 * Why the room sent a checkpoint (ADR 0035 Decision 9; D85 measurement). It attributes Convex I/O
 * to the trigger and is never stored: Convex ignores it beyond the room meter's accounting.
 * - `BACKLOG`: the unsaved chat entries and roll cards reached the chat push window (ADR 0035
 *   Amendment 25). The journal's size is not a trigger.
 * - `ADMISSION`: a socket authenticated or was admitted and the room saved its pending prefix.
 * - `ACTIVATION`: the bootstrap that claims or recovers an epoch.
 * - `RELOAD`: a command needed the room aggregate reloaded over a newer Convex write.
 * - `ACKNOWLEDGEMENT`: a command or actor reconcile Convex must ingest before its receipt.
 * - `PRESENTATION`: a Scene presentation change.
 * - `DRAIN`: the final checkpoint before an idle release or close.
 * - `BARRIER`: the development load proof asked the room to publish everything pending; never sent
 *   in production play.
 */
export const LIVE_SESSION_CHECKPOINT_REASONS = [
  'BACKLOG',
  'ADMISSION',
  'ACTIVATION',
  'RELOAD',
  'ACKNOWLEDGEMENT',
  'PRESENTATION',
  'DRAIN',
  'BARRIER'
] as const

export const liveSessionCheckpointReasonSchema = lazySchema(() =>
  z.enum(LIVE_SESSION_CHECKPOINT_REASONS)
)

/** Private room publication; the payload digest covers every mutable delta and packed receipt. */
export const liveSessionCheckpointInputSchema = lazySchema(() =>
  z.extend(liveSessionCheckpointFenceInputSchema, {
    records: liveSessionCheckpointRecordsSchema,
    knownAuthorization: z.nullable(liveSessionRoomAuthorizationRevisionsSchema)
  })
)

/**
 * The request the room sends: the retained checkpoint input plus the trigger of this send. The
 * reason stays out of the input because the room persists that input as its exact retry evidence.
 */
export const liveSessionCheckpointRequestSchema = lazySchema(() =>
  z.extend(liveSessionCheckpointInputSchema, {
    reason: liveSessionCheckpointReasonSchema
  })
)

const transactionCount = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(Number.MAX_SAFE_INTEGER))
)

/** One transaction reading of Convex's own `ctx.meta.getTransactionMetrics()`. */
const liveSessionCheckpointIoCountersSchema = lazySchema(() =>
  z.strictObject({
    bytesRead: transactionCount,
    bytesWritten: transactionCount,
    documentsRead: transactionCount,
    documentsWritten: transactionCount
  })
)

/**
 * The checkpoint mutation's cost by section (D85, A35-S10a). Sections partition the whole
 * transaction, so they sum to the totals: the replay fence, record deltas (reads, checksums, delta
 * application, writes and domain validation), scope checks, Character holds, Scenes, receipt
 * history, private rolls, and everything else (the staged payload read and revision adoption).
 */
export const LIVE_SESSION_CHECKPOINT_IO_SECTIONS = [
  'fence',
  'records',
  'scopes',
  'holds',
  'scenes',
  'history',
  'privateRolls',
  'remainder'
] as const

export const liveSessionCheckpointIoSchema = lazySchema(() =>
  z.extend(liveSessionCheckpointIoCountersSchema, {
    sections: z.strictObject({
      fence: liveSessionCheckpointIoCountersSchema,
      records: liveSessionCheckpointIoCountersSchema,
      scopes: liveSessionCheckpointIoCountersSchema,
      holds: liveSessionCheckpointIoCountersSchema,
      scenes: liveSessionCheckpointIoCountersSchema,
      history: liveSessionCheckpointIoCountersSchema,
      privateRolls: liveSessionCheckpointIoCountersSchema,
      remainder: liveSessionCheckpointIoCountersSchema
    })
  })
)

/**
 * The revisions the checkpoint's own writes produced, for the scopes whose revision the room held
 * before the write: the room adopts them instead of rereading its authorization. A scope whose
 * revision differed from the room's is omitted, so the room's renewal read picks up the outside change.
 */
export const liveSessionCheckpointAdoptionSchema = lazySchema(() =>
  z.strictObject({
    play: z.optional(postgresUuidSchema),
    characters: sceneSessionVisionCharacterRevisionsSchema
  })
)

export const liveSessionCheckpointResponseSchema = lazySchema(() =>
  z.strictObject({
    status: z.enum(['COMMITTED', 'REPLAYED']),
    authority: liveSessionAuthorityDtoSchema,
    adopted: liveSessionCheckpointAdoptionSchema,
    io: liveSessionCheckpointIoSchema
  })
)

export type LiveSessionCheckpointReason = z.infer<typeof liveSessionCheckpointReasonSchema>
export type LiveSessionCheckpointInput = z.infer<typeof liveSessionCheckpointInputSchema>
export type LiveSessionCheckpointRequest = z.infer<typeof liveSessionCheckpointRequestSchema>
export type LiveSessionCheckpointIo = z.infer<typeof liveSessionCheckpointIoSchema>
export type LiveSessionCheckpointIoSection = (typeof LIVE_SESSION_CHECKPOINT_IO_SECTIONS)[number]
export type LiveSessionCheckpointAdoption = z.infer<typeof liveSessionCheckpointAdoptionSchema>
export type LiveSessionCheckpointResponse = z.infer<typeof liveSessionCheckpointResponseSchema>

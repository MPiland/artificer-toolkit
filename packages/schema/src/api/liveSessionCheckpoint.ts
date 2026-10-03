import { z, lazySchema } from '../zod.js'
import { liveSessionCheckpointFenceInputSchema } from './liveSessionCheckpointFence.js'
import { liveSessionCheckpointRecordsSchema } from './liveSessionCheckpointRecords.js'
import { liveSessionAuthorityDtoSchema } from './liveSessionState.js'
import {
  liveSessionRoomAuthorizationRevisionsSchema,
  liveSessionRoomAuthorizationResponseSchema
} from './liveSessionRoomAuthorization.js'

/**
 * Why the room sent a checkpoint (ADR 0035 Decision 9; D85 measurement). It attributes Convex I/O
 * to the trigger and is never stored: Convex ignores it beyond the room meter's accounting.
 * - `DEADLINE`: the checkpoint alarm, `checkpointDeadlineMs` after the oldest unpublished command.
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
  'DEADLINE',
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
  z.extend(liveSessionCheckpointInputSchema, { reason: liveSessionCheckpointReasonSchema })
)

const transactionCount = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(Number.MAX_SAFE_INTEGER))
)

/** Convex's own `ctx.meta.getTransactionMetrics()` reading at the end of the checkpoint mutation. */
export const liveSessionCheckpointIoSchema = lazySchema(() =>
  z.strictObject({
    bytesRead: transactionCount,
    bytesWritten: transactionCount,
    documentsRead: transactionCount,
    documentsWritten: transactionCount
  })
)

export const liveSessionCheckpointResponseSchema = lazySchema(() =>
  z.strictObject({
    status: z.enum(['COMMITTED', 'REPLAYED']),
    authority: liveSessionAuthorityDtoSchema,
    authorization: liveSessionRoomAuthorizationResponseSchema,
    io: liveSessionCheckpointIoSchema
  })
)

export type LiveSessionCheckpointReason = z.infer<typeof liveSessionCheckpointReasonSchema>
export type LiveSessionCheckpointInput = z.infer<typeof liveSessionCheckpointInputSchema>
export type LiveSessionCheckpointRequest = z.infer<typeof liveSessionCheckpointRequestSchema>
export type LiveSessionCheckpointIo = z.infer<typeof liveSessionCheckpointIoSchema>
export type LiveSessionCheckpointResponse = z.infer<typeof liveSessionCheckpointResponseSchema>

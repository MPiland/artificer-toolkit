import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'

/**
 * One atomic checkpoint payload. Convex validates and applies it in one mutation under its 1 s
 * user-code limit. The room batches commands to a quarter of this, so only one large command, such
 * as a full fog layer per player, reaches it; fog rows are cheap to validate per byte.
 */
export const LIVE_SESSION_CHECKPOINT_MAX_BYTES = 1024 * 1024

/**
 * The most record changes one checkpoint carries. Validation cost grows with the change count, not
 * only the bytes, and a successful COMPLETE save already uses 0.86 to 0.98 s of user time, so a
 * longer prefix splits into several saves.
 */
export const LIVE_SESSION_CHECKPOINT_MAX_CHANGES = 1500

const sequence = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(Number.MAX_SAFE_INTEGER))
)

/** Scalar replay evidence kept on the authority head, without importing mechanics. */
export const liveSessionStoredCheckpointFenceSchema = lazySchema(() =>
  z.strictObject({
    checkpointId: postgresUuidSchema,
    fromSequence: sequence,
    fromChecksum: projectionChecksumSchema,
    sequence,
    checksum: projectionChecksumSchema,
    payloadChecksum: projectionChecksumSchema
  })
)

/** A consecutive committed prefix whose payload is validated by the checkpoint writer. */
export const liveSessionCheckpointFenceInputSchema = lazySchema(() =>
  z.extend(liveSessionStoredCheckpointFenceSchema, {
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema
  })
)

export type LiveSessionCheckpointFenceInput = z.infer<typeof liveSessionCheckpointFenceInputSchema>

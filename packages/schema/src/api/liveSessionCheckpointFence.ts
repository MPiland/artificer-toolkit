import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'

/** The existing journal page bound also bounds one atomic checkpoint payload. */
export const LIVE_SESSION_CHECKPOINT_MAX_BYTES = 4 * 1024 * 1024

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

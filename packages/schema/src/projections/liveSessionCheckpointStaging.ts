import { z, lazySchema } from '../zod.js'
import {
  liveSessionCheckpointFenceInputSchema,
  LIVE_SESSION_CHECKPOINT_MAX_BYTES
} from '../api/liveSessionCheckpointFence.js'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const LIVE_SESSION_CHECKPOINT_MAX_PARTS = Math.ceil(
  LIVE_SESSION_CHECKPOINT_MAX_BYTES / JSON_PAYLOAD_CHUNK_MAX_BYTES
)

/** Scalar-only metadata; database evaluation does not import checkpoint mechanics. */
export const liveSessionCheckpointUploadSchema = lazySchema(() =>
  z
    .extend(liveSessionCheckpointFenceInputSchema, {
      byteLength: z
        .number()
        .check(z.int())
        .check(z.gte(1))
        .check(z.lte(LIVE_SESSION_CHECKPOINT_MAX_BYTES)),
      partCount: z
        .number()
        .check(z.int())
        .check(z.gte(1))
        .check(z.lte(LIVE_SESSION_CHECKPOINT_MAX_PARTS))
    })
    .check(
      z.superRefine((upload, context) => {
        if (upload.partCount !== Math.ceil(upload.byteLength / JSON_PAYLOAD_CHUNK_MAX_BYTES))
          context.addIssue({
            code: 'custom',
            message: 'Checkpoint part count does not match its byte length.'
          })
      })
    )
)

export const liveSessionStoredCheckpointUploadSchema = lazySchema(() =>
  z.extend(liveSessionCheckpointUploadSchema, {
    expiresAt: z.number().check(z.int()).check(z.positive()).check(z.lte(Number.MAX_SAFE_INTEGER))
  })
)

export const liveSessionCheckpointUploadPartSchema = lazySchema(() =>
  z.strictObject({
    checkpointId: postgresUuidSchema,
    index: z
      .number()
      .check(z.int())
      .check(z.nonnegative())
      .check(z.lt(LIVE_SESSION_CHECKPOINT_MAX_PARTS))
  })
)

export type LiveSessionCheckpointUpload = z.infer<typeof liveSessionCheckpointUploadSchema>

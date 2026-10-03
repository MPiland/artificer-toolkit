import { z, lazySchema } from '../zod.js'
import { liveSessionCheckpointReasonSchema } from './liveSessionCheckpoint.js'
import { liveSessionCheckpointFenceInputSchema } from './liveSessionCheckpointFence.js'
import { liveSessionRoomAuthorizationRevisionsSchema } from './liveSessionRoomAuthorization.js'
import {
  liveSessionCheckpointUploadSchema,
  liveSessionCheckpointUploadPartSchema
} from '../projections/liveSessionCheckpointStaging.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'

export const liveSessionCheckpointStageInputSchema = liveSessionCheckpointUploadSchema

/** JSON transport carries canonical base64; persistence stores the decoded bounded bytes. */
export const liveSessionCheckpointPartInputSchema = lazySchema(() =>
  z.extend(liveSessionCheckpointUploadPartSchema, {
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    data: z
      .string()
      .check(z.minLength(4))
      .check(z.maxLength(4 * Math.ceil(JSON_PAYLOAD_CHUNK_MAX_BYTES / 3)))
  })
)

export const liveSessionCheckpointStageResponseSchema = lazySchema(() =>
  z.strictObject({ status: z.enum(['STAGED', 'REPLAYED']) })
)

export const liveSessionCheckpointCommitInputSchema = lazySchema(() =>
  z.extend(liveSessionCheckpointFenceInputSchema, {
    knownAuthorization: z.nullable(liveSessionRoomAuthorizationRevisionsSchema),
    reason: liveSessionCheckpointReasonSchema
  })
)

export type LiveSessionCheckpointStageInput = z.infer<typeof liveSessionCheckpointStageInputSchema>
export type LiveSessionCheckpointPartInput = z.infer<typeof liveSessionCheckpointPartInputSchema>
export type LiveSessionCheckpointCommitInput = z.infer<
  typeof liveSessionCheckpointCommitInputSchema
>
export type LiveSessionCheckpointStageResponse = z.infer<
  typeof liveSessionCheckpointStageResponseSchema
>

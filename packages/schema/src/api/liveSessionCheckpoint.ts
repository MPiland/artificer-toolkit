import { z, lazySchema } from '../zod.js'
import { liveSessionCheckpointFenceInputSchema } from './liveSessionCheckpointFence.js'
import { liveSessionCheckpointRecordsSchema } from './liveSessionCheckpointRecords.js'
import { liveSessionAuthorityDtoSchema } from './liveSessionState.js'
import {
  liveSessionRoomAuthorizationRevisionsSchema,
  liveSessionRoomAuthorizationResponseSchema
} from './liveSessionRoomAuthorization.js'

/** Private room publication; the payload digest covers every mutable delta and packed receipt. */
export const liveSessionCheckpointInputSchema = lazySchema(() =>
  z.extend(liveSessionCheckpointFenceInputSchema, {
    records: liveSessionCheckpointRecordsSchema,
    knownAuthorization: z.nullable(liveSessionRoomAuthorizationRevisionsSchema)
  })
)

export const liveSessionCheckpointResponseSchema = lazySchema(() =>
  z.strictObject({
    status: z.enum(['COMMITTED', 'REPLAYED']),
    authority: liveSessionAuthorityDtoSchema,
    authorization: liveSessionRoomAuthorizationResponseSchema
  })
)

export type LiveSessionCheckpointInput = z.infer<typeof liveSessionCheckpointInputSchema>
export type LiveSessionCheckpointResponse = z.infer<typeof liveSessionCheckpointResponseSchema>

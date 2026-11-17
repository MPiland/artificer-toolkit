import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  LIVE_SESSION_CHECKPOINT_CHAT_TABLES,
  liveSessionCheckpointRecordChangeSchema,
  liveSessionCheckpointRetainedRollSchema
} from './liveSessionCheckpointRecords.js'

/**
 * A mid-Run chat save (ADR 0035 Amendment 32): chat-class record changes and retained rolls, sent
 * beside the checkpoint fence. It never moves the authority head, so the same input may be sent
 * again after an unacknowledged commit; Convex skips a change whose next state it already holds.
 */
export const liveSessionChatCheckpointInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    changes: z.array(
      liveSessionCheckpointRecordChangeSchema.check(
        z.refine((change) =>
          (LIVE_SESSION_CHECKPOINT_CHAT_TABLES as readonly string[]).includes(change.table)
        )
      )
    ),
    retainedRolls: z.array(liveSessionCheckpointRetainedRollSchema)
  })
)

export type LiveSessionChatCheckpointInput = z.infer<typeof liveSessionChatCheckpointInputSchema>

import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  liveSessionStoredCheckpointUploadSchema,
  liveSessionCheckpointUploadPartSchema
} from '@artificer-toolkit/schema/projections/liveSessionCheckpointStaging'

export const liveSessionCheckpointTables = {
  liveSessionCheckpointUploads: defineTable(
    zodToConvexFields(liveSessionStoredCheckpointUploadSchema.shape)
  )
    .index('by_checkpointId', ['checkpointId'])
    .index('by_campaignId', ['campaignId']),
  liveSessionCheckpointUploadParts: defineTable({
    ...zodToConvexFields(liveSessionCheckpointUploadPartSchema.shape),
    bytes: v.bytes()
  }).index('by_checkpointId_index', ['checkpointId', 'index'])
}

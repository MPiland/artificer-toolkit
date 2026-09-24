import { defineTable } from 'convex/server'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignStoredVehicleCleanupSchema,
  campaignStoredVehicleCleanupTotalSchema,
  campaignStoredVehicleCleanupSegmentSchema
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'

// Spread into campaignTables; preserve every existing table/index.
export const vehicleCleanupTables = {
  campaignVehicleCleanupJobs: defineTable(
    zodToConvexFields(campaignStoredVehicleCleanupSchema.shape)
  )
    .index('by_publicId', ['id'])
    .index('by_campaignId_eventId', ['grant.campaignId', 'grant.eventId'])
    .index('by_campaignId_commandId', ['grant.campaignId', 'grant.commandId'])
    .index('by_campaignId_vehicleId_eventId', [
      'grant.campaignId',
      'grant.vehicleId',
      'grant.eventId'
    ])
    .index('by_campaignId_vehicleId', ['grant.campaignId', 'grant.vehicleId'])
    .index('by_campaignId_status_id', ['grant.campaignId', 'status', 'id']),
  campaignVehicleCleanupTotals: defineTable(
    zodToConvexFields(campaignStoredVehicleCleanupTotalSchema.shape)
  ).index('by_jobId_slot', ['jobId', 'campaignCurrencySystemId', 'denominationId']),
  campaignVehicleCleanupSegments: defineTable(
    zodToConvexFields(campaignStoredVehicleCleanupSegmentSchema.shape)
  ).index('by_jobId_sequence', ['jobId', 'sequence'])
}

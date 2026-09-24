import { campaignStoredPartyInventorySchema } from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredVehicleSchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { readVehicleCleanupLock } from './vehicleCleanupDocuments'
import type { QueryCtx } from '../_generated/server'

/** Caller supplies current Campaign authority. Missing vehicleId is existing party custody. */
export async function readCampaignInventory(ctx: QueryCtx, campaignId: string, vehicleId?: string) {
  if (vehicleId !== undefined) {
    const vehicle = await ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId).eq('id', vehicleId))
      .unique()
    if (!vehicle) throw new Error('Campaign Vehicle inventory owner is unavailable.')
    const { _id, _creationTime, ...metadata } = vehicle
    campaignStoredVehicleSchema.parse(metadata)
    await readVehicleCleanupLock(ctx, vehicle)
  }
  const stored = await ctx.db
    .query('campaignPartyInventories')
    .withIndex('by_campaignId_vehicleId', (q) =>
      q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
    )
    .unique()
  if (stored) {
    const { _id, _creationTime, ...record } = stored
    campaignStoredPartyInventorySchema.parse(record)
  } else {
    const [item, group, currency] = await Promise.all([
      ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
        )
        .first(),
      ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
        )
        .first(),
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
        )
        .first()
    ])
    if (item || group || currency)
      throw new Error('Stored Campaign inventory owner is unavailable.')
  }
  return stored
}

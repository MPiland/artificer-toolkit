import { campaignVehicleDtoSchema } from '@artificer-toolkit/schema/api/campaignVehicles'
import { campaignStoredVehicleSchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/** Current membership controls cargo visibility; source-loss readers bypass this member-facing gate. */
export async function requireCampaignVehicleCargoAccess(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  membership: Doc<'campaignMemberships'>,
  vehicleId: string
): Promise<Doc<'campaignVehicles'>> {
  const vehicle = await ctx.db
    .query('campaignVehicles')
    .withIndex('by_campaignId_id', (q) =>
      q.eq('campaignId', campaign.id).eq('id', vehicleId.toLowerCase())
    )
    .unique()
  if (!vehicle) throw new Error('Campaign Vehicle inventory owner is unavailable.')
  const { _id, _creationTime, ...stored } = vehicle
  const metadata = campaignStoredVehicleSchema.parse(stored)
  if (metadata.campaignId !== campaign.id)
    throw new Error('Stored Campaign Vehicle scope mismatch.')
  if (membership.role !== 'OWNER' && metadata.availability === 'UNAVAILABLE')
    throw new Error('Campaign Vehicle inventory owner is unavailable.')
  return vehicle
}
export function presentCampaignVehicle(campaign: Doc<'campaigns'>, row: Doc<'campaignVehicles'>) {
  const { _id, _creationTime, ...stored } = row
  const { cleanupJobId: _cleanupJobId, ...publicVehicle } =
    campaignStoredVehicleSchema.parse(stored)
  const vehicle = campaignVehicleDtoSchema.parse(publicVehicle)
  if (vehicle.campaignId !== campaign.id) throw new Error('Stored Campaign Vehicle scope mismatch.')
  return {
    ...vehicle,
    label:
      vehicle.label === null
        ? null
        : presentCampaignPlainText(vehicle.label, campaign.contentMaturity)
  }
}

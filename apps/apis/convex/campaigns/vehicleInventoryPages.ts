import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignVehicleInventoryListInputSchema,
  campaignPartyItemPageSchema,
  campaignPartyCurrencyPageSchema,
  type CampaignPartyItemPage,
  type CampaignPartyCurrencyPage
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { internalQuery } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { requireCampaignVehicleCargoAccess } from './vehicleDocuments'
import { readVehicleCleanupLock } from './vehicleCleanupDocuments'
import { readCampaignItemPage, readCampaignCurrencyPage } from './partyInventoryDocuments'

export const items = internalQuery({
  args: zodToConvexFields(campaignVehicleInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyItemPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyItemPage> => {
    const input = campaignVehicleInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const vehicle = await requireCampaignVehicleCargoAccess(
      ctx,
      campaign,
      membership,
      input.vehicleId.toLowerCase()
    )
    const pendingCleanup = await readVehicleCleanupLock(ctx, vehicle)
    return readCampaignItemPage(
      ctx,
      campaign,
      input.paginationOpts,
      input.vehicleId.toLowerCase(),
      pendingCleanup
    )
  }
})

export const currencies = internalQuery({
  args: zodToConvexFields(campaignVehicleInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyCurrencyPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyCurrencyPage> => {
    const input = campaignVehicleInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const vehicle = await requireCampaignVehicleCargoAccess(
      ctx,
      campaign,
      membership,
      input.vehicleId.toLowerCase()
    )
    const pendingCleanup = await readVehicleCleanupLock(ctx, vehicle)
    return readCampaignCurrencyPage(
      ctx,
      campaign,
      input.paginationOpts,
      input.vehicleId.toLowerCase(),
      pendingCleanup
    )
  }
})

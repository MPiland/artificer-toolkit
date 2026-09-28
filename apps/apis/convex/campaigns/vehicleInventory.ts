import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignVehicleInventoryListInputSchema,
  campaignPartyItemPageSchema,
  campaignPartyCurrencyPageSchema,
  type CampaignPartyItemPage,
  type CampaignPartyCurrencyPage
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { requireCampaignVehicleCargoAccess } from './vehicleDocuments'
import { internal } from '../_generated/api'

export const items = query({
  args: zodToConvexFields(campaignVehicleInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyItemPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyItemPage> => {
    const input = campaignVehicleInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    await requireCampaignVehicleCargoAccess(
      ctx,
      campaign,
      membership,
      input.vehicleId.toLowerCase()
    )
    return ctx.runQuery(internal.campaigns.vehicleInventoryPages.items, input)
  }
})

export const currencies = query({
  args: zodToConvexFields(campaignVehicleInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyCurrencyPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyCurrencyPage> => {
    const input = campaignVehicleInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    await requireCampaignVehicleCargoAccess(
      ctx,
      campaign,
      membership,
      input.vehicleId.toLowerCase()
    )
    return ctx.runQuery(internal.campaigns.vehicleInventoryPages.currencies, input)
  }
})

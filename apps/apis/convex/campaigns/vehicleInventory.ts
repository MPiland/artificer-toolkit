import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
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
import { readVehicleCleanupLock } from './vehicleCleanupDocuments'
import { readCampaignItemPage, readCampaignCurrencyPage } from './partyInventoryDocuments'

export const items = query({
  args: zodToConvexFields(campaignVehicleInventoryListInputSchema.shape),
  get returns(): Validator<CampaignPartyItemPage, 'required', string> {
    return zodToConvex<z.core.$ZodType<CampaignPartyItemPage>>(campaignPartyItemPageSchema)
  },
  handler: async (ctx, args): Promise<CampaignPartyItemPage> => {
    const input = campaignVehicleInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const vehicleId = input.vehicleId.toLowerCase()
    const vehicle = await requireCampaignVehicleCargoAccess(ctx, campaign, membership, vehicleId)
    const pendingCleanup = await readVehicleCleanupLock(ctx, vehicle)
    return readCampaignItemPage(ctx, campaign, input.paginationOpts, vehicleId, pendingCleanup)
  }
})

export const currencies = query({
  args: zodToConvexFields(campaignVehicleInventoryListInputSchema.shape),
  get returns(): Validator<CampaignPartyCurrencyPage, 'required', string> {
    return zodToConvex<z.core.$ZodType<CampaignPartyCurrencyPage>>(campaignPartyCurrencyPageSchema)
  },
  handler: async (ctx, args): Promise<CampaignPartyCurrencyPage> => {
    const input = campaignVehicleInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const vehicleId = input.vehicleId.toLowerCase()
    const vehicle = await requireCampaignVehicleCargoAccess(ctx, campaign, membership, vehicleId)
    const pendingCleanup = await readVehicleCleanupLock(ctx, vehicle)
    return readCampaignCurrencyPage(ctx, campaign, input.paginationOpts, vehicleId, pendingCleanup)
  }
})

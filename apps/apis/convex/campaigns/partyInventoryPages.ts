import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignPartyInventoryListInputSchema,
  campaignPartyItemPageSchema,
  campaignPartyCurrencyPageSchema,
  type CampaignPartyItemPage,
  type CampaignPartyCurrencyPage
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { internalQuery } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { readCampaignItemPage, readCampaignCurrencyPage } from './partyInventoryDocuments'

export const items = internalQuery({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyItemPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyItemPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return readCampaignItemPage(ctx, campaign, input.paginationOpts)
  }
})

export const currencies = internalQuery({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyCurrencyPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyCurrencyPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return readCampaignCurrencyPage(ctx, campaign, input.paginationOpts)
  }
})

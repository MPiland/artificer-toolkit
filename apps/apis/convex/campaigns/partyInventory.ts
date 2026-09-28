import {
  authoredCataloguePageSchema,
  type AuthoredCataloguePage
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignPartyInventoryListInputSchema,
  campaignPartyItemPageSchema,
  campaignPartyCurrencyPageSchema,
  type CampaignPartyItemPage,
  type CampaignPartyCurrencyPage
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { query } from '../lib/queries'
import { internal } from '../_generated/api'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'

export const items = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyItemPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyItemPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    await requireCampaignAuthority(ctx, input.campaignId, userId)
    return ctx.runQuery(internal.campaigns.partyInventoryPages.items, input)
  }
})

export const currencies = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(campaignPartyCurrencyPageSchema),
  handler: async (ctx, args): Promise<CampaignPartyCurrencyPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    await requireCampaignAuthority(ctx, input.campaignId, userId)
    return ctx.runQuery(internal.campaigns.partyInventoryPages.currencies, input)
  }
})

/** Complete official Equipment options under this Campaign's current catalogue binding. */
export const equipmentOptions = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(authoredCataloguePageSchema),
  handler: async (ctx, args): Promise<AuthoredCataloguePage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    return ctx.runQuery(internal.campaigns.equipmentOptions.list, input)
  }
})

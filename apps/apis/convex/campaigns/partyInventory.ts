import {
  authoredCataloguePageSchema,
  type AuthoredCataloguePage
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
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
import { readCampaignItemPage, readCampaignCurrencyPage } from './partyInventoryDocuments'

// RELIABILITY-21.T18: page reads run in this query's transaction. A `runQuery` hop evaluated a
// second module graph and re-ran validation, identity and authority on every call.
export const items = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  get returns(): Validator<CampaignPartyItemPage, 'required', string> {
    return zodToConvex<z.core.$ZodType<CampaignPartyItemPage>>(campaignPartyItemPageSchema)
  },
  handler: async (ctx, args): Promise<CampaignPartyItemPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return readCampaignItemPage(ctx, campaign, input.paginationOpts)
  }
})

export const currencies = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  get returns(): Validator<CampaignPartyCurrencyPage, 'required', string> {
    return zodToConvex<z.core.$ZodType<CampaignPartyCurrencyPage>>(campaignPartyCurrencyPageSchema)
  },
  handler: async (ctx, args): Promise<CampaignPartyCurrencyPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return readCampaignCurrencyPage(ctx, campaign, input.paginationOpts)
  }
})

/** Complete official Equipment options under this Campaign's current catalogue binding. */
export const equipmentOptions = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  get returns(): Validator<AuthoredCataloguePage, 'required', string> {
    return zodToConvex<z.core.$ZodType<AuthoredCataloguePage>>(authoredCataloguePageSchema)
  },
  handler: async (ctx, args): Promise<AuthoredCataloguePage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    return ctx.runQuery(internal.campaigns.equipmentOptions.list, input)
  }
})

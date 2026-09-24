import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  currencySystemDtoSchema,
  saveCampaignCurrencySystemInputSchema,
  deleteCampaignCurrencySystemInputSchema
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignPartyInventoryListInputSchema,
  campaignCurrencySystemPageSchema,
  type CampaignCurrencySystemPage
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { query } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'

export const list = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(campaignCurrencySystemPageSchema),
  handler: async (ctx, args): Promise<CampaignCurrencySystemPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    await requireCampaignAuthority(ctx, input.campaignId, userId)
    return ctx.runQuery(internal.campaigns.currencySystemPages.list, input)
  }
})

export const save = mutation({
  args: zodToConvexFields(saveCampaignCurrencySystemInputSchema.shape),
  returns: zodToConvex(currencySystemDtoSchema),
  handler: async (ctx, args) =>
    ctx.runMutation(
      internal.campaigns.currencySystemCommands.save,
      saveCampaignCurrencySystemInputSchema.parse(args)
    )
})

export const remove = mutation({
  args: zodToConvexFields(deleteCampaignCurrencySystemInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) =>
    ctx.runMutation(
      internal.campaigns.currencySystemCommands.remove,
      deleteCampaignCurrencySystemInputSchema.parse(args)
    )
})

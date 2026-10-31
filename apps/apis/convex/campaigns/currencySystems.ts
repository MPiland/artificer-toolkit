import { v, type Validator } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
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
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { readCurrencySystem, presentCurrencySystem } from './currencySystemDocuments'

export const list = query({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  get returns(): Validator<CampaignCurrencySystemPage, 'required', string> {
    return zodToConvex<z.core.$ZodType<CampaignCurrencySystemPage>>(
      campaignCurrencySystemPageSchema
    )
  },
  handler: async (ctx, args): Promise<CampaignCurrencySystemPage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const result = await ctx.db
      .query('campaignCurrencySystems')
      .withIndex('by_campaignId_label_id', (q) => q.eq('campaignId', campaign.id))
      .paginate({ ...input.paginationOpts, maximumRowsRead: 48, maximumBytesRead: 1024 * 1024 })
    return campaignCurrencySystemPageSchema.parse({
      ...result,
      page: await Promise.all(
        result.page.map(async (row) =>
          presentCurrencySystem((await readCurrencySystem(ctx, row)).document, campaign)
        )
      )
    })
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

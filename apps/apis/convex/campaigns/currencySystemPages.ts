import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignPartyInventoryListInputSchema,
  campaignCurrencySystemPageSchema,
  type CampaignCurrencySystemPage
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { internalQuery } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { readCurrencySystem, presentCurrencySystem } from './currencySystemDocuments'

export const list = internalQuery({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(campaignCurrencySystemPageSchema),
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

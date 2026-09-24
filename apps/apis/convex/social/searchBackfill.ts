import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialSearchBackfillInputSchema,
  socialSearchBackfillResultSchema
} from '@artificer-toolkit/schema/api/socialDiscovery'
import { socialStoredListingSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { campaignStoredRecordSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { internalMutation } from '../lib/mutations'
import { listingSearch, requireOwnedCampaign } from './listingDocuments'

export const backfill = internalMutation({
  args: zodToConvexFields(socialSearchBackfillInputSchema.shape),
  returns: zodToConvex(socialSearchBackfillResultSchema),
  handler: async (ctx, args) => {
    const input = socialSearchBackfillInputSchema.parse(args)
    const result = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId')
      .paginate({
        ...input.paginationOpts,
        maximumRowsRead: 8,
        maximumBytesRead: 1024 * 1024
      })
    for (const row of result.page) {
      const { _id, _creationTime, ...stored } = row
      const listing = socialStoredListingSchema.parse(stored)
      const campaign = await requireOwnedCampaign(ctx, listing.campaignId, listing.ownerUserId)
      const { _id: _campaignId, _creationTime: _campaignCreationTime, ...campaignStored } = campaign
      campaignStoredRecordSchema.parse(campaignStored)
      const search = listingSearch(campaign.name, listing.summary)
      if (listing.search && listing.search.text !== search.text)
        throw new Error('Social search metadata mismatch.')
      if (!listing.search) await ctx.db.patch(row._id, { search })
    }
    return {
      processed: result.page.length,
      continueCursor: result.continueCursor,
      isDone: result.isDone
    }
  }
})

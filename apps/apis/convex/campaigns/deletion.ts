import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  deleteCampaignInputSchema,
  campaignDeletionResultSchema,
  type CampaignDeletionResult
} from '@artificer-toolkit/schema/api/campaignCore'
import { internal } from '../_generated/api'
import { mutation } from '../lib/mutations'
import { query } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import {
  campaignDeletionStatusInputSchema,
  campaignDeletionStatusSchema
} from '@artificer-toolkit/schema/api/campaignDeletion'

export const status = query({
  args: zodToConvexFields(campaignDeletionStatusInputSchema.shape),
  returns: zodToConvex(campaignDeletionStatusSchema),
  handler: async (ctx, { campaignId }) => {
    const { userId } = await requireIdentity(ctx)
    const job = await ctx.db.query('campaignDeletionJobs')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)).unique()
    if (!job || job.ownerUserId !== userId) throw new Error('Campaign not found.')
    return { campaignId, expectedVersion: job.expectedVersion, status: job.status, error: job.error, updatedAt: job.updatedAt }
  }
})

export const remove = mutation({
  args: zodToConvexFields(deleteCampaignInputSchema.shape),
  returns: zodToConvex(campaignDeletionResultSchema),
  handler: (ctx, args): Promise<CampaignDeletionResult> =>
    ctx.runMutation(internal.campaigns.deletionCommands.remove, args)
})

import { ConvexError, v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  developmentCampaignRollbackInputSchema,
  type DevelopmentCampaignRollbackInput
} from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import { campaignDeletionResultSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'

const deleteReference = makeFunctionReference<
  'mutation',
  DevelopmentCampaignRollbackInput['deletion'],
  { ok: true }
>('campaigns/deletionCommands:remove')

export const forceDeletionRollback = internalMutation({
  args: zodToConvex(developmentCampaignRollbackInputSchema),
  returns: v.null(),
  handler: async (ctx, input): Promise<null> => {
    const checked = developmentCampaignRollbackInputSchema.parse(input)
    const identity = await requireIdentity(ctx)
    if (identity.userId !== checked.fixture.ownerUserId)
      throw new Error('Fixture owner does not match the caller.')
    campaignDeletionResultSchema.parse(await ctx.runMutation(deleteReference, checked.deletion))
    const job = await ctx.db
      .query('campaignDeletionJobs')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', checked.fixture.campaignId))
      .unique()
    if (job?.status !== 'DELETING')
      throw new Error('Fixture Campaign deletion fence was not persisted before rollback.')
    throw new ConvexError('Injected Campaign deletion fixture rollback')
  }
})

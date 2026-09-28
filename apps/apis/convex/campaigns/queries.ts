import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignDetailDtoSchema,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  campaignListInputSchema,
  campaignListPageSchema,
  campaignLookupInputSchema,
  type CampaignListPage
} from '@artificer-toolkit/schema/api/campaignList'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import {
  presentCampaignSummary,
  readActiveCampaignMembers,
  readCampaignAssignedCharacter,
  readCampaignDetail,
  requireCampaignAuthority
} from './documents'

export const get = query({
  args: zodToConvexFields(campaignLookupInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args): Promise<CampaignDetailDto> => {
    const { userId } = await requireIdentity(ctx)
    const { id } = campaignLookupInputSchema.parse(args)
    return readCampaignDetail(ctx, await requireCampaignAuthority(ctx, id, userId))
  }
})

export const settings = query({
  args: zodToConvexFields(campaignLookupInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args): Promise<CampaignDetailDto> => {
    const { userId } = await requireIdentity(ctx)
    const { id } = campaignLookupInputSchema.parse(args)
    return readCampaignDetail(ctx, await requireCampaignAuthority(ctx, id, userId), true)
  }
})

export const list = query({
  args: zodToConvexFields(campaignListInputSchema.shape),
  returns: zodToConvex(campaignListPageSchema),
  handler: async (ctx, args): Promise<CampaignListPage> => {
    const { userId } = await requireIdentity(ctx)
    const { paginationOpts } = campaignListInputSchema.parse(args)
    const result = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_userId_status_joinedAt', (q) => q.eq('userId', userId).eq('status', 'ACTIVE'))
      .order('desc')
      // Bound joins to assigned Character documents as well as the small membership rows.
      .paginate({ ...paginationOpts, maximumRowsRead: 8, maximumBytesRead: 1024 * 1024 })
    return campaignListPageSchema.parse({
      ...result,
      page: (await Promise.all(
        result.page.map(async (member) => {
          const [root, deletion] = await Promise.all([
            ctx.db.query('campaigns').withIndex('by_publicId', (q) => q.eq('id', member.campaignId)).unique(),
            ctx.db.query('campaignDeletionJobs').withIndex('by_campaignId', (q) => q.eq('campaignId', member.campaignId)).unique()
          ])
          if (!root || deletion) return null
          const { campaign, membership } = await requireCampaignAuthority(
            ctx,
            member.campaignId,
            userId
          )
          const [members, assignedCharacter] = await Promise.all([
            readActiveCampaignMembers(ctx, campaign),
            readCampaignAssignedCharacter(ctx, campaign, membership)
          ])
          return presentCampaignSummary(campaign, membership, members, assignedCharacter)
        })
      )).filter((campaign) => campaign !== null)
    })
  }
})

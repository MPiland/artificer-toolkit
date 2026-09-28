import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignSessionRsvpDtoSchema,
  setCampaignSessionRsvpInputSchema,
  type CampaignSessionRsvpDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import {
  campaignSessionRsvpListInputSchema,
  campaignSessionRsvpListPageSchema,
  type CampaignSessionRsvpListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { requireSession } from './sessionDocuments'

export const list = query({
  args: zodToConvexFields(campaignSessionRsvpListInputSchema.shape),
  returns: zodToConvex(campaignSessionRsvpListPageSchema),
  handler: async (ctx, args): Promise<CampaignSessionRsvpListPage> => {
    const input = campaignSessionRsvpListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    if (membership.role !== 'OWNER') return { page: [], isDone: true, continueCursor: '' }
    const result = await ctx.db
      .query('campaignSessionRsvps')
      .withIndex('by_campaignId_sessionId_updatedAt_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id)
      )
      .order('desc')
      .paginate({ ...input.paginationOpts, maximumRowsRead: 32, maximumBytesRead: 1024 * 1024 })
    return campaignSessionRsvpListPageSchema.parse({
      ...result,
      page: result.page.map((row) => ({
        campaignId: row.campaignId,
        sessionId: row.sessionId,
        userId: row.userId,
        response: row.response,
        updatedAt: row.updatedAt
      }))
    })
  }
})

export const set = mutation({
  args: zodToConvexFields(setCampaignSessionRsvpInputSchema.shape),
  returns: zodToConvex(campaignSessionRsvpDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionRsvpDto> => {
    const input = setCampaignSessionRsvpInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    if (session.status !== 'OPEN') throw new Error('Finished sessions cannot receive RSVPs.')
    const row = campaignSessionRsvpDtoSchema.parse({
      campaignId: campaign.id,
      sessionId: session.id,
      userId,
      response: input.response,
      updatedAt: new Date().toISOString()
    })
    const existing = await ctx.db
      .query('campaignSessionRsvps')
      .withIndex('by_campaignId_sessionId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id).eq('userId', userId)
      )
      .unique()
    if (existing) await ctx.db.patch(existing._id, row)
    else await ctx.db.insert('campaignSessionRsvps', row)
    return row
  }
})

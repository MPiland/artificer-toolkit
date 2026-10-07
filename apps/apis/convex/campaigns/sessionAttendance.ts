import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignSessionAttendanceDtoSchema,
  setCampaignSessionAttendanceInputSchema,
  type CampaignSessionAttendanceDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import {
  campaignSessionAttendanceListInputSchema,
  campaignSessionAttendanceListPageSchema,
  type CampaignSessionAttendanceListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { readCampaignAssignedCharacter } from './assignedCharacter'
import { requireCampaignAuthority } from './authority'
import { requireSession } from './sessionDocuments'

export const list = query({
  args: zodToConvexFields(campaignSessionAttendanceListInputSchema.shape),
  returns: zodToConvex(campaignSessionAttendanceListPageSchema),
  handler: async (ctx, args): Promise<CampaignSessionAttendanceListPage> => {
    const input = campaignSessionAttendanceListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const result = await ctx.db
      .query('campaignSessionAttendance')
      .withIndex('by_campaignId_sessionId_characterId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id)
      )
      .paginate({ ...input.paginationOpts, maximumRowsRead: 32, maximumBytesRead: 1024 * 1024 })
    return campaignSessionAttendanceListPageSchema.parse({
      ...result,
      page: result.page.map((row) => ({
        campaignId: row.campaignId,
        sessionId: row.sessionId,
        characterId: row.characterId,
        present: row.present
      }))
    })
  }
})

export const set = mutation({
  args: zodToConvexFields(setCampaignSessionAttendanceInputSchema.shape),
  returns: zodToConvex(campaignSessionAttendanceDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionAttendanceDto> => {
    const input = setCampaignSessionAttendanceInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    if (session.status !== 'OPEN') throw new Error('Finished sessions are locked.')
    if (session.version !== input.expectedVersion) throw new Error('Session version conflict.')
    const characterId = input.characterId.toLowerCase()
    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (!assignment || assignment.campaignId !== campaign.id)
      throw new Error('Character is not assigned to this Campaign.')
    const member = await requireCampaignAuthority(ctx, campaign.id, assignment.userId)
    const character = await readCampaignAssignedCharacter(ctx, campaign, member.membership)
    if (character?.id !== characterId)
      throw new Error('Character is not assigned to this Campaign.')
    const row = campaignSessionAttendanceDtoSchema.parse({
      campaignId: campaign.id,
      sessionId: session.id,
      characterId,
      present: input.present
    })
    const existing = await ctx.db
      .query('campaignSessionAttendance')
      .withIndex('by_campaignId_sessionId_characterId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id).eq('characterId', characterId)
      )
      .unique()
    if (existing) await ctx.db.patch(existing._id, row)
    else await ctx.db.insert('campaignSessionAttendance', row)
    return row
  }
})

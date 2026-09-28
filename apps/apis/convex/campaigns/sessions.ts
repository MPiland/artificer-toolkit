import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignSessionDtoSchema,
  createCampaignSessionInputSchema,
  updateCampaignSessionInputSchema,
  getCampaignSessionInputSchema,
  type CampaignSessionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { campaignIdInputSchema } from '@artificer-toolkit/schema/api/campaignCore'
import * as zMini from 'zod/mini'
import {
  campaignSessionListInputSchema,
  campaignSessionListPageSchema,
  type CampaignSessionListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { readCampaignAssignedCharacter } from './assignedCharacter'
import { requireCampaignAuthority, readActiveCampaignMembers } from './authority'
import { presentSession, requireSession } from './sessionDocuments'

export const list = query({
  args: zodToConvexFields(campaignSessionListInputSchema.shape),
  returns: zodToConvex(campaignSessionListPageSchema),
  handler: async (ctx, args): Promise<CampaignSessionListPage> => {
    const input = campaignSessionListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const result = await ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', campaign.id))
      .order('desc')
      .paginate({ ...input.paginationOpts, maximumRowsRead: 32, maximumBytesRead: 1024 * 1024 })
    return campaignSessionListPageSchema.parse({
      ...result,
      page: result.page.map((session) => presentSession(session, campaign.contentMaturity))
    })
  }
})

export const get = query({
  args: zodToConvexFields(getCampaignSessionInputSchema.shape),
  returns: zodToConvex(campaignSessionDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionDto> => {
    const input = getCampaignSessionInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_sessionNumber', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionNumber', input.sessionNumber)
      )
      .unique()
    if (!session) throw new Error('Session not found.')
    return presentSession(session, campaign.contentMaturity)
  }
})

export const latestOpen = query({
  args: zodToConvexFields(campaignIdInputSchema.shape),
  returns: zodToConvex(zMini.nullable(campaignSessionDtoSchema)),
  handler: async (ctx, args): Promise<CampaignSessionDto | null> => {
    const input = campaignIdInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_status_sessionNumber', (q) =>
        q.eq('campaignId', campaign.id).eq('status', 'OPEN')
      )
      .order('desc')
      .first()
    return session ? presentSession(session, campaign.contentMaturity) : null
  }
})

export const create = mutation({
  args: zodToConvexFields(createCampaignSessionInputSchema.shape),
  returns: zodToConvex(campaignSessionDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionDto> => {
    const input = createCampaignSessionInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const previous = await ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', campaign.id))
      .order('desc')
      .first()
    const now = new Date().toISOString()
    const session = campaignSessionDtoSchema.parse({
      ...input,
      campaignId: campaign.id,
      id: crypto.randomUUID(),
      sessionNumber: (previous?.sessionNumber ?? 0) + 1,
      title: input.title ?? null,
      status: 'OPEN',
      finishedAt: null,
      version: 0,
      createdAt: now,
      updatedAt: now
    })
    await ctx.db.insert('campaignSessions', session)
    for (const member of await readActiveCampaignMembers(ctx, campaign)) {
      const character = await readCampaignAssignedCharacter(ctx, campaign, member)
      if (character)
        await ctx.db.insert('campaignSessionAttendance', {
          campaignId: campaign.id,
          sessionId: session.id,
          characterId: character.id,
          present: true
        })
    }
    return presentSession(session, campaign.contentMaturity)
  }
})

export const update = mutation({
  args: zodToConvexFields(updateCampaignSessionInputSchema.shape),
  returns: zodToConvex(campaignSessionDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionDto> => {
    const input = updateCampaignSessionInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const existing = await requireSession(ctx, campaign.id, input.sessionId)
    if (existing.version !== input.expectedVersion) throw new Error('Session version conflict.')
    const merged = createCampaignSessionInputSchema.parse({
      campaignId: campaign.id,
      title: input.title === undefined ? existing.title : input.title,
      scheduledStartAt:
        input.scheduledStartAt === undefined ? existing.scheduledStartAt : input.scheduledStartAt,
      scheduledEndAt:
        input.scheduledEndAt === undefined ? existing.scheduledEndAt : input.scheduledEndAt,
      timeZone: input.timeZone === undefined ? existing.timeZone : input.timeZone
    })
    const patch = { ...merged, version: existing.version + 1, updatedAt: new Date().toISOString() }
    await ctx.db.patch(existing._id, patch)
    return presentSession({ ...existing, ...patch }, campaign.contentMaturity)
  }
})

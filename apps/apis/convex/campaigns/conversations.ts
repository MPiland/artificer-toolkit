import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignConversationDtoSchema,
  campaignConversationsDtoSchema,
  getCampaignConversationInputSchema,
  listCampaignConversationsInputSchema,
  markCampaignConversationReadInputSchema,
  type CampaignConversationDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { query } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { readActiveCampaignMembers, requireCampaignAuthority } from './authority'
import {
  conversationAccess,
  openConversation,
  findConversation,
  presentConversation
} from './conversationDocuments'

export const open = mutation({
  args: zodToConvexFields(getCampaignConversationInputSchema.shape),
  returns: zodToConvex(campaignConversationDtoSchema),
  handler: async (ctx, args): Promise<CampaignConversationDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = getCampaignConversationInputSchema.parse(args)
    const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const { conversation, member } = await openConversation(
      ctx,
      authority,
      input.kind,
      input.directUserId
    )
    return presentConversation(ctx, conversation, member)
  }
})

export const list = query({
  args: zodToConvexFields(listCampaignConversationsInputSchema.shape),
  returns: zodToConvex(campaignConversationsDtoSchema),
  handler: async (ctx, args): Promise<CampaignConversationDto[]> => {
    const { userId } = await requireIdentity(ctx)
    const input = listCampaignConversationsInputSchema.parse(args)
    const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const members = await readActiveCampaignMembers(ctx, authority.campaign)
    // Only active peers can contribute DIRECT rooms; old membership churn cannot grow this read.
    const rooms = await Promise.all([
      findConversation(ctx, authority.campaign.id, 'TABLE', []),
      ...(authority.membership.role === 'PLAYER'
        ? [findConversation(ctx, authority.campaign.id, 'PARTY', [])]
        : []),
      ...members
        .filter((member) => member.userId !== userId)
        .map((member) =>
          findConversation(ctx, authority.campaign.id, 'DIRECT', [userId, member.userId].sort())
        )
    ])
    const visible = await Promise.all(
      rooms.map(async (room) => {
        if (!room) return null
        const access = await conversationAccess(ctx, authority, room)
        return access ? presentConversation(ctx, room, access.member) : null
      })
    )
    return visible
      .filter((room): room is CampaignConversationDto => room !== null)
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      )
  }
})

export const markRead = mutation({
  args: zodToConvexFields(markCampaignConversationReadInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const input = markCampaignConversationReadInputSchema.parse(args)
    const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const conversation = await ctx.db
      .query('campaignConversations')
      .withIndex('by_publicId', (q) => q.eq('id', input.conversationId.toLowerCase()))
      .unique()
    if (!conversation) throw new Error('Conversation not found.')
    const access = await conversationAccess(ctx, authority, conversation)
    if (!access) throw new Error('Conversation not found.')
    const entry = await ctx.db
      .query('campaignConversationEntries')
      .withIndex('by_publicId', (q) => q.eq('id', input.entryId.toLowerCase()))
      .unique()
    if (
      !entry ||
      entry.campaignId !== authority.campaign.id ||
      entry.conversationId !== conversation.id ||
      entry.createdAt < access.member.accessStartedAt
    )
      throw new Error('Chat entry not found.')
    if (access.member.lastReadAt === null || entry.createdAt > access.member.lastReadAt)
      await ctx.db.patch(access.member._id, { lastReadAt: entry.createdAt })
    return { ok: true } as const
  }
})

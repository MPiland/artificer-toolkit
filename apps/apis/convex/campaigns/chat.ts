import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignChatUnreadCountLimit,
  campaignChatEntryDtoSchema,
  campaignChatPageDtoSchema,
  listCampaignChatEntriesInputSchema,
  sendCampaignChatEntryInputSchema,
  editCampaignChatEntryInputSchema,
  unsendCampaignChatEntryInputSchema,
  type CampaignChatEntryDto,
  type CampaignChatPageDto,
  type ListCampaignChatEntriesInput,
  type SendCampaignChatEntryInput
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { buildConversationEntry } from '@artificer-toolkit/encounter-persistence/conversationEntryRecords'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile, requireIdentity } from '../lib/identity'
import { readCampaignAssignedCharacter } from './assignedCharacter'
import { requireCampaignAuthorUsername } from './authorLabels'
import { requireCampaignAuthority } from './authority'
import {
  conversationAccess,
  countUnreadEntries,
  findConversation,
  insertConversationEntry,
  isUnreadEntry,
  openConversation,
  presentChatEntries,
  presentChatEntry,
  readConversationEntryReplay,
  readCampaignAccessTime
} from './conversationDocuments'
import { consumeUserRateLimit } from '../lib/rateLimits'
import { assertConvexOwnsCampaignChat } from '../liveSessions/authorityGuard'

export const list = query({
  args: () => zodToConvexFields(listCampaignChatEntriesInputSchema.shape),
  returns: () => zodToConvex(campaignChatPageDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatPageDto> =>
    readCampaignChatPage(ctx, (await requireIdentity(ctx)).userId, args)
})

export async function readCampaignChatPage(
  ctx: QueryCtx,
  userId: string,
  args: ListCampaignChatEntriesInput
): Promise<CampaignChatPageDto> {
  const input = listCampaignChatEntriesInputSchema.parse(args)
  const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
  const participants =
    input.room === 'DIRECT' ? [userId, input.directUserId!.toLowerCase()].sort() : []
  const room = await findConversation(ctx, authority.campaign.id, input.room, participants)
  if (!room) throw new Error('Conversation not found.')
  const access = await conversationAccess(ctx, authority, room)
  if (!access) throw new Error('Conversation not found.')
  const { member } = access
  const cursor = input.cursor
    ? await ctx.db
        .query('campaignConversationEntries')
        .withIndex('by_publicId', (q) => q.eq('id', input.cursor!.toLowerCase()))
        .unique()
    : null
  // A cursor outside this member's visible history ends the history, as an unknown one does.
  if (
    input.cursor &&
    (!cursor || cursor.conversationId !== room.id || cursor.createdAt < member.accessStartedAt)
  )
    return {
      entries: [],
      nextCursor: null,
      lastReadAt: member.lastReadAt,
      unreadCount: await countUnreadEntries(ctx, room, member)
    }
  // Newest first by (createdAt, id): entries tied with the cursor's time, then strictly older ones.
  const wanted = input.limit + 1
  const tied = cursor
    ? await ctx.db
        .query('campaignConversationEntries')
        .withIndex('by_conversationId_createdAt_id', (q) =>
          q.eq('conversationId', room.id).eq('createdAt', cursor.createdAt).lt('id', cursor.id)
        )
        .order('desc')
        .take(wanted)
    : []
  const older =
    tied.length < wanted
      ? await ctx.db
          .query('campaignConversationEntries')
          .withIndex('by_conversationId_createdAt_id', (q) => {
            const visible = q.eq('conversationId', room.id).gte('createdAt', member.accessStartedAt)
            return cursor ? visible.lt('createdAt', cursor.createdAt) : visible
          })
          .order('desc')
          .take(wanted - tied.length)
      : []
  const found = [...tied, ...older]
  if (found.some((entry) => entry.campaignId !== room.campaignId))
    throw new Error('Stored conversation history mismatch.')
  const page = found.slice(0, input.limit)
  return {
    entries: await presentChatEntries(ctx, page, room, authority.campaign.contentMaturity),
    nextCursor: found.length > input.limit ? page.at(-1)!.id : null,
    lastReadAt: member.lastReadAt,
    // Unread entries are the newest, so a newest page that already spans the count limit holds the
    // count and the whole entries need not be read a second time.
    unreadCount:
      !cursor && wanted >= campaignChatUnreadCountLimit
        ? found.filter((entry) => isUnreadEntry(member, entry)).length
        : await countUnreadEntries(ctx, room, member)
  }
}

export const send = mutation({
  args: () => zodToConvexFields(sendCampaignChatEntryInputSchema.shape),
  returns: () => zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const input = sendCampaignChatEntryInputSchema.parse(args)
    const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
    await assertConvexOwnsCampaignChat(ctx, authority.campaign.id)
    return postCampaignChatEntry(ctx, authority, actor.username, input)
  }
})

/**
 * Posts one chat entry as the authenticated member, once per client nonce. Other Campaign writes
 * that speak to the table (such as the GM sharing an enemy's health) use it too.
 */
export async function postCampaignChatEntry(
  ctx: MutationCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  username: string | null,
  input: Pick<
    SendCampaignChatEntryInput,
    'room' | 'directUserId' | 'mode' | 'body' | 'assignedCharacterId' | 'clientNonce'
  >
): Promise<CampaignChatEntryDto> {
  const userId = authority.membership.userId
  if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const access = await openConversation(ctx, authority, input.room, input.directUserId)
  const { conversation } = access
  const clientNonce = input.clientNonce.toLowerCase()
  const prior = await readConversationEntryReplay(ctx, access, userId, clientNonce, 'CHAT')
  if (prior) return presentChatEntry(ctx, prior, conversation, authority.campaign.contentMaturity)
  const now = await readCampaignAccessTime(ctx, authority.campaign)
  await consumeUserRateLimit(ctx, 'campaignConversation', userId)
  const character =
    input.mode === 'ROLEPLAY'
      ? await readCampaignAssignedCharacter(ctx, authority.campaign, authority.membership)
      : null
  if (
    input.mode === 'ROLEPLAY' &&
    (!character || character.id !== input.assignedCharacterId!.toLowerCase())
  )
    throw new Error('Assigned Character is unavailable.')
  requireCampaignAuthorUsername(username)
  const stored = await insertConversationEntry(
    ctx,
    buildConversationEntry({
      campaignId: authority.campaign.id,
      conversationId: conversation.id,
      authorUserId: userId,
      clientNonce,
      createdAt: new Date(now).toISOString(),
      username,
      content: { kind: 'CHAT', mode: input.mode, body: input.body, character }
    })
  )
  return presentChatEntry(ctx, stored, conversation, authority.campaign.contentMaturity)
}

async function mutableChatEntry(
  ctx: MutationCtx,
  campaignId: string,
  entryId: string,
  userId: string
) {
  const authority = await requireCampaignAuthority(ctx, campaignId, userId)
  if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const entry = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_publicId', (q) => q.eq('id', entryId.toLowerCase()))
    .unique()
  if (!entry || entry.campaignId !== authority.campaign.id || entry.authorUserId !== userId)
    throw new Error('Chat entry not found.')
  const conversation = await ctx.db
    .query('campaignConversations')
    .withIndex('by_publicId', (q) => q.eq('id', entry.conversationId))
    .unique()
  if (!conversation) throw new Error('Conversation not found.')
  const access = await conversationAccess(ctx, authority, conversation)
  if (!access || entry.createdAt < access.member.accessStartedAt)
    throw new Error('Chat entry not found.')
  if (entry.kind !== 'CHAT' || entry.unsentAt !== null)
    throw new Error('Chat entry cannot be changed.')
  return { authority, entry, conversation }
}

export const edit = mutation({
  args: () => zodToConvexFields(editCampaignChatEntryInputSchema.shape),
  returns: () => zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = editCampaignChatEntryInputSchema.parse(args)
    const { authority, entry, conversation } = await mutableChatEntry(
      ctx,
      input.campaignId,
      input.entryId,
      userId
    )
    if (Date.now() - Date.parse(entry.createdAt) > 15 * 60_000)
      throw new Error('Chat entries can only be edited for 15 minutes.')
    const patch = { body: input.body, editedAt: new Date().toISOString() }
    await ctx.db.patch(entry._id, patch)
    return presentChatEntry(
      ctx,
      { ...entry, ...patch },
      conversation,
      authority.campaign.contentMaturity
    )
  }
})

export const unsend = mutation({
  args: () => zodToConvexFields(unsendCampaignChatEntryInputSchema.shape),
  returns: () => zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = unsendCampaignChatEntryInputSchema.parse(args)
    const { authority, entry, conversation } = await mutableChatEntry(
      ctx,
      input.campaignId,
      input.entryId,
      userId
    )
    if (Date.now() - Date.parse(entry.createdAt) > 5 * 60_000)
      throw new Error('Chat entries can only be unsent for 5 minutes.')
    const patch = { body: null, unsentAt: new Date().toISOString() }
    await ctx.db.patch(entry._id, patch)
    return presentChatEntry(
      ctx,
      { ...entry, ...patch },
      conversation,
      authority.campaign.contentMaturity
    )
  }
})

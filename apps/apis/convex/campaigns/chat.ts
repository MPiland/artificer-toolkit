import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
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
import {
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
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
  openConversation,
  presentChatEntries,
  presentChatEntry,
  readEntryPayload,
  readCampaignAccessTime
} from './conversationDocuments'
import { consumeUserRateLimit } from '../lib/rateLimits'

export const list = query({
  args: zodToConvexFields(listCampaignChatEntriesInputSchema.shape),
  returns: zodToConvex(campaignChatPageDtoSchema),
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
  const status = {
    lastReadAt: member.lastReadAt,
    unreadCount: await countUnreadEntries(ctx, room, member)
  }
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
    return { entries: [], nextCursor: null, ...status }
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
  const headers = [...tied, ...older]
  if (headers.some((header) => header.campaignId !== room.campaignId))
    throw new Error('Stored conversation history mismatch.')
  const page = headers.slice(0, input.limit)
  return {
    entries: await presentChatEntries(
      ctx,
      await Promise.all(
        page.map(async (header) => ({ header, payload: await readEntryPayload(ctx, header.id) }))
      ),
      room,
      authority.campaign.contentMaturity
    ),
    nextCursor: headers.length > input.limit ? page.at(-1)!.id : null,
    ...status
  }
}

export const send = mutation({
  args: zodToConvexFields(sendCampaignChatEntryInputSchema.shape),
  returns: zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const input = sendCampaignChatEntryInputSchema.parse(args)
    const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
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
  const { conversation, member } = await openConversation(
    ctx,
    authority,
    input.room,
    input.directUserId
  )
  const clientNonce = input.clientNonce.toLowerCase()
  const prior = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q
        .eq('campaignId', authority.campaign.id)
        .eq('authorUserId', userId)
        .eq('clientNonce', clientNonce)
    )
    .unique()
  if (prior) {
    if (prior.conversationId !== conversation.id)
      throw new Error('Chat nonce was used in another conversation.')
    if (prior.createdAt < member.accessStartedAt) throw new Error('Chat entry not found.')
    const payload = await readEntryPayload(ctx, prior.id)
    if (payload.kind !== 'CHAT') throw new Error('Chat nonce was used for a different entry kind.')
    return presentChatEntry(ctx, prior, payload, conversation, authority.campaign.contentMaturity)
  }
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
  const header = campaignStoredEntryIdentitySchema.parse({
    id: crypto.randomUUID(),
    campaignId: authority.campaign.id,
    conversationId: conversation.id,
    authorUserId: userId,
    clientNonce,
    createdAt: new Date(now).toISOString()
  })
  const payload = campaignStoredEntryPayloadSchema.parse({
    entryId: header.id,
    kind: 'CHAT',
    mode: input.mode,
    body: input.body,
    roll: null,
    revealedByGm: false,
    authorUsername: username,
    characterId: character?.id ?? null,
    characterLabel: character?.label ?? null,
    editedAt: null,
    unsentAt: null,
    consumedAt: null
  })
  await insertConversationEntry(ctx, header, payload)
  return presentChatEntry(ctx, header, payload, conversation, authority.campaign.contentMaturity)
}

async function mutableChatEntry(
  ctx: MutationCtx,
  campaignId: string,
  entryId: string,
  userId: string
) {
  const authority = await requireCampaignAuthority(ctx, campaignId, userId)
  if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const header = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_publicId', (q) => q.eq('id', entryId.toLowerCase()))
    .unique()
  if (!header || header.campaignId !== authority.campaign.id || header.authorUserId !== userId)
    throw new Error('Chat entry not found.')
  const conversation = await ctx.db
    .query('campaignConversations')
    .withIndex('by_publicId', (q) => q.eq('id', header.conversationId))
    .unique()
  if (!conversation) throw new Error('Conversation not found.')
  const access = await conversationAccess(ctx, authority, conversation)
  if (!access || header.createdAt < access.member.accessStartedAt)
    throw new Error('Chat entry not found.')
  const payload = await readEntryPayload(ctx, header.id)
  if (payload.kind !== 'CHAT' || payload.unsentAt !== null)
    throw new Error('Chat entry cannot be changed.')
  return { authority, header, payload, conversation }
}

export const edit = mutation({
  args: zodToConvexFields(editCampaignChatEntryInputSchema.shape),
  returns: zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = editCampaignChatEntryInputSchema.parse(args)
    const { authority, header, payload, conversation } = await mutableChatEntry(
      ctx,
      input.campaignId,
      input.entryId,
      userId
    )
    if (Date.now() - Date.parse(header.createdAt) > 15 * 60_000)
      throw new Error('Chat entries can only be edited for 15 minutes.')
    const patch = { body: input.body, editedAt: new Date().toISOString() }
    await ctx.db.patch(payload._id, patch)
    return presentChatEntry(
      ctx,
      header,
      { ...payload, ...patch },
      conversation,
      authority.campaign.contentMaturity
    )
  }
})

export const unsend = mutation({
  args: zodToConvexFields(unsendCampaignChatEntryInputSchema.shape),
  returns: zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = unsendCampaignChatEntryInputSchema.parse(args)
    const { authority, header, payload, conversation } = await mutableChatEntry(
      ctx,
      input.campaignId,
      input.entryId,
      userId
    )
    if (Date.now() - Date.parse(header.createdAt) > 5 * 60_000)
      throw new Error('Chat entries can only be unsent for 5 minutes.')
    const patch = { body: null, unsentAt: new Date().toISOString() }
    await ctx.db.patch(payload._id, patch)
    return presentChatEntry(
      ctx,
      header,
      { ...payload, ...patch },
      conversation,
      authority.campaign.contentMaturity
    )
  }
})

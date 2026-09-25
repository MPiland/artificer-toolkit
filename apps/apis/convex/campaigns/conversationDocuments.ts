import {
  campaignChatEntryDtoSchema,
  deletedCampaignAuthorLabel,
  campaignConversationDtoSchema,
  type CampaignChatEntryDto,
  type CampaignConversationDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import {
  campaignStoredConversationSchema,
  campaignStoredConversationMemberSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireCampaignAuthority, readActiveCampaignMembers } from './authority'

export const conversationEntryLimit = 500

/** Messages cannot precede a current member's freshly advanced access cutoff. */
export async function readCampaignAccessTime(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>
): Promise<number> {
  const members = await readActiveCampaignMembers(ctx, campaign)
  return Math.max(Date.now(), ...members.map((member) => Date.parse(member.accessStartedAt)))
}

export async function findConversation(
  ctx: QueryCtx,
  campaignId: string,
  kind: CampaignConversationDto['kind'],
  participantUserIds: string[]
) {
  return ctx.db
    .query('campaignConversations')
    .withIndex('by_campaignId_kind_participants', (q) =>
      q.eq('campaignId', campaignId).eq('kind', kind).eq('participantUserIds', participantUserIds)
    )
    .unique()
}

export async function conversationParticipants(
  ctx: QueryCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  kind: CampaignConversationDto['kind'],
  directUserId?: string
) {
  const { campaign, membership } = authority
  if (kind === 'PARTY' && membership.role !== 'PLAYER') throw new Error('Conversation not found.')
  if (kind !== 'DIRECT') return [membership]
  const peerId = directUserId?.toLowerCase()
  if (!peerId || peerId === membership.userId) throw new Error('Conversation not found.')
  const peer = await requireCampaignAuthority(ctx, campaign.id, peerId)
  return [membership, peer.membership].sort((left, right) =>
    left.userId.localeCompare(right.userId)
  )
}

export async function conversationAccess(
  ctx: QueryCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  conversation: Doc<'campaignConversations'>
) {
  if (conversation.campaignId !== authority.campaign.id) throw new Error('Conversation not found.')
  const peerId =
    conversation.kind === 'DIRECT'
      ? conversation.participantUserIds.find((id) => id !== authority.membership.userId)
      : undefined
  if (
    conversation.kind === 'DIRECT' &&
    !conversation.participantUserIds.includes(authority.membership.userId)
  )
    throw new Error('Conversation not found.')
  const participants = await conversationParticipants(ctx, authority, conversation.kind, peerId)
  const expected = conversation.kind === 'DIRECT' ? participants.map((member) => member.userId) : []
  if (
    conversation.participantUserIds.length !== expected.length ||
    conversation.participantUserIds.some((id, index) => id !== expected[index])
  )
    throw new Error('Stored conversation participants mismatch.')
  const member = await ctx.db
    .query('campaignConversationMembers')
    .withIndex('by_conversationId_userId', (q) =>
      q.eq('conversationId', conversation.id).eq('userId', authority.membership.userId)
    )
    .unique()
  if (
    !member ||
    member.campaignId !== authority.campaign.id ||
    member.accessStartedAt !== authority.membership.accessStartedAt
  )
    return null
  return { conversation, member }
}

export async function openConversation(
  ctx: MutationCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  kind: CampaignConversationDto['kind'],
  directUserId?: string
) {
  const participants = await conversationParticipants(ctx, authority, kind, directUserId)
  const participantUserIds = kind === 'DIRECT' ? participants.map((member) => member.userId) : []
  let conversation = await findConversation(ctx, authority.campaign.id, kind, participantUserIds)
  if (!conversation) {
    const id = await ctx.db.insert(
      'campaignConversations',
      campaignStoredConversationSchema.parse({
        id: crypto.randomUUID(),
        campaignId: authority.campaign.id,
        kind,
        participantUserIds,
        createdAt: new Date().toISOString()
      })
    )
    conversation = await ctx.db.get(id)
  }
  if (!conversation) throw new Error('Conversation could not be opened.')
  const room = conversation
  for (const participant of participants) {
    const member = await ctx.db
      .query('campaignConversationMembers')
      .withIndex('by_conversationId_userId', (q) =>
        q.eq('conversationId', room.id).eq('userId', participant.userId)
      )
      .unique()
    if (member) {
      if (member.campaignId !== authority.campaign.id)
        throw new Error('Stored conversation membership mismatch.')
      if (member.accessStartedAt !== participant.accessStartedAt)
        await ctx.db.patch(member._id, { accessStartedAt: participant.accessStartedAt })
    } else {
      await ctx.db.insert(
        'campaignConversationMembers',
        campaignStoredConversationMemberSchema.parse({
          conversationId: room.id,
          campaignId: authority.campaign.id,
          userId: participant.userId,
          accessStartedAt: participant.accessStartedAt,
          lastReadAt: null
        })
      )
    }
  }
  const access = await conversationAccess(ctx, authority, room)
  if (!access) throw new Error('Conversation could not be opened.')
  return access
}

export async function visibleConversationEntries(
  ctx: QueryCtx,
  conversation: Doc<'campaignConversations'>,
  member: Doc<'campaignConversationMembers'>
) {
  const entries = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_conversationId_createdAt_id', (q) =>
      q.eq('conversationId', conversation.id).gte('createdAt', member.accessStartedAt)
    )
    .order('desc')
    .take(conversationEntryLimit + 1)
  if (
    entries.length > conversationEntryLimit ||
    entries.some((entry) => entry.campaignId !== conversation.campaignId)
  )
    throw new Error('Stored conversation history mismatch.')
  return entries
}

export async function presentConversation(
  ctx: QueryCtx,
  conversation: Doc<'campaignConversations'>,
  member: Doc<'campaignConversationMembers'>
): Promise<CampaignConversationDto> {
  const entries = await visibleConversationEntries(ctx, conversation, member)
  return campaignConversationDtoSchema.parse({
    id: conversation.id,
    campaignId: conversation.campaignId,
    kind: conversation.kind,
    participantUserIds: conversation.participantUserIds,
    createdAt: conversation.createdAt,
    lastReadAt: member.lastReadAt,
    unreadCount: entries.filter(
      (entry) => member.lastReadAt === null || entry.createdAt > member.lastReadAt
    ).length
  })
}

export async function readEntryPayload(ctx: QueryCtx, entryId: string) {
  const payload = await ctx.db
    .query('campaignConversationEntryPayloads')
    .withIndex('by_entryId', (q) => q.eq('entryId', entryId))
    .unique()
  if (!payload) throw new Error('Stored conversation payload is unavailable.')
  return payload
}

/** Text and public rolls share one atomic header/payload retention boundary. */
export async function insertConversationEntry(
  ctx: MutationCtx,
  header: Omit<Doc<'campaignConversationEntries'>, '_id' | '_creationTime'>,
  payload: Omit<Doc<'campaignConversationEntryPayloads'>, '_id' | '_creationTime'>
) {
  await ctx.db.insert('campaignConversationEntries', header)
  await ctx.db.insert('campaignConversationEntryPayloads', payload)
  const retained = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_conversationId_createdAt_id', (q) =>
      q.eq('conversationId', header.conversationId)
    )
    .order('desc')
    .take(conversationEntryLimit + 2)
  if (retained.length > conversationEntryLimit + 1)
    throw new Error('Stored conversation retention limit exceeded.')
  const expired = retained[conversationEntryLimit]
  if (expired) {
    const expiredPayload = await readEntryPayload(ctx, expired.id)
    await ctx.db.delete(expiredPayload._id)
    await ctx.db.delete(expired._id)
  }
}

export async function presentChatEntry(
  ctx: QueryCtx,
  entry:
    | Doc<'campaignConversationEntries'>
    | Omit<Doc<'campaignConversationEntries'>, '_id' | '_creationTime'>,
  payload:
    | Doc<'campaignConversationEntryPayloads'>
    | Omit<Doc<'campaignConversationEntryPayloads'>, '_id' | '_creationTime'>,
  conversation: Doc<'campaignConversations'>,
  maturity: 'STANDARD' | 'MATURE'
): Promise<CampaignChatEntryDto> {
  const author = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', entry.authorUserId))
    .unique()
  return campaignChatEntryDtoSchema.parse({
    id: entry.id,
    campaignId: entry.campaignId,
    conversationId: entry.conversationId,
    room: conversation.kind,
    kind: payload.kind,
    mode: payload.mode,
    // Masking can expand a short word; bound display text without changing stored snapshots.
    body:
      payload.body === null
        ? null
        : presentCampaignPlainText(payload.body, maturity).slice(0, 2000),
    roll:
      payload.roll === null
        ? null
        : {
            ...payload.roll,
            characterLabel: presentCampaignPlainText(payload.roll.characterLabel, maturity),
            source: {
              ...payload.roll.source,
              label: presentCampaignPlainText(payload.roll.source.label, maturity).slice(0, 80)
            }
          },
    revealedByGm: payload.revealedByGm,
    authorUserId: entry.authorUserId,
    authorUsername: author ? payload.authorUsername : deletedCampaignAuthorLabel,
    characterId: payload.characterId,
    characterLabel:
      payload.characterLabel === null
        ? null
        : presentCampaignPlainText(payload.characterLabel, maturity).slice(0, 100),
    editedAt: payload.editedAt,
    unsentAt: payload.unsentAt,
    createdAt: entry.createdAt
  })
}

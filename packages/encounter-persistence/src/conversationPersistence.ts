import type { CampaignConversationDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import {
  campaignStoredConversationSchema,
  campaignStoredConversationMemberSchema,
  createCampaignEntryHeader,
  type campaignStoredEntryIdentitySchema,
  type campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import type { CampaignAuthority } from './ports.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

type RequirePeerAuthority = (campaignId: string, userId: string) => Promise<CampaignAuthority>

export async function findConversation(
  ctx: EncounterReadContext,
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
  authority: CampaignAuthority,
  kind: CampaignConversationDto['kind'],
  requirePeerAuthority: RequirePeerAuthority,
  directUserId?: string
) {
  const { campaign, membership } = authority
  if (kind === 'PARTY' && membership.role !== 'PLAYER') throw new Error('Conversation not found.')
  if (kind !== 'DIRECT') return [membership]
  const peerId = directUserId?.toLowerCase()
  if (!peerId || peerId === membership.userId) throw new Error('Conversation not found.')
  const peer = await requirePeerAuthority(campaign.id, peerId)
  return [membership, peer.membership].sort((left, right) =>
    left.userId.localeCompare(right.userId)
  )
}

export async function conversationAccess(
  ctx: EncounterReadContext,
  authority: CampaignAuthority,
  conversation: EncounterDocument<'campaignConversations'>,
  requirePeerAuthority: RequirePeerAuthority
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
  const participants = await conversationParticipants(
    authority,
    conversation.kind,
    requirePeerAuthority,
    peerId
  )
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
  ctx: EncounterWriteContext,
  authority: CampaignAuthority,
  kind: CampaignConversationDto['kind'],
  requirePeerAuthority: RequirePeerAuthority,
  directUserId?: string
) {
  const participants = await conversationParticipants(
    authority,
    kind,
    requirePeerAuthority,
    directUserId
  )
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
  const access = await conversationAccess(ctx, authority, room, requirePeerAuthority)
  if (!access) throw new Error('Conversation could not be opened.')
  return access
}

/** Text and rolls write both halves of an entry together in the caller's transaction. */
export async function insertConversationEntry(
  ctx: EncounterWriteContext,
  identity: ReturnType<typeof campaignStoredEntryIdentitySchema.parse>,
  payload: ReturnType<typeof campaignStoredEntryPayloadSchema.parse>
) {
  await ctx.db.insert('campaignConversationEntries', createCampaignEntryHeader(identity, payload))
  await ctx.db.insert('campaignConversationEntryPayloads', payload)
}

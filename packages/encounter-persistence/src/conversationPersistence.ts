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

/**
 * The author's earlier entry for this client nonce, so a retry replays it instead of posting twice;
 * null for a new nonce. A nonce used in another conversation or for another entry kind is refused,
 * and an entry from before the member's access cutoff is not theirs to read.
 */
export async function readConversationEntryReplay(
  ctx: EncounterReadContext,
  { conversation, member }: NonNullable<Awaited<ReturnType<typeof conversationAccess>>>,
  authorUserId: string,
  clientNonce: string,
  kind: EncounterDocument<'campaignConversationEntryPayloads'>['kind']
) {
  const header = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q
        .eq('campaignId', conversation.campaignId)
        .eq('authorUserId', authorUserId)
        .eq('clientNonce', clientNonce)
    )
    .unique()
  if (!header) return null
  if (header.conversationId !== conversation.id)
    throw new Error('Chat nonce was used in another conversation.')
  if (header.createdAt < member.accessStartedAt) throw new Error('Chat entry not found.')
  const payload = await ctx.db
    .query('campaignConversationEntryPayloads')
    .withIndex('by_entryId', (q) => q.eq('entryId', header.id))
    .unique()
  if (!payload) throw new Error('Stored conversation payload is unavailable.')
  if (payload.kind !== kind) throw new Error('Chat nonce was used for a different entry kind.')
  return { header, payload }
}

/**
 * Text and rolls write both halves of an entry together in the caller's transaction. Entries read
 * back by (createdAt, id), so an entry is stamped at least 1 ms after the conversation's newest one:
 * same-millisecond writers keep insertion order instead of falling to the random id. Returns the
 * stamped identity; present that, not the proposed one.
 */
export async function insertConversationEntry(
  ctx: EncounterWriteContext,
  identity: ReturnType<typeof campaignStoredEntryIdentitySchema.parse>,
  payload: ReturnType<typeof campaignStoredEntryPayloadSchema.parse>
) {
  const newest = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_conversationId_createdAt_id', (q) =>
      q.eq('conversationId', identity.conversationId)
    )
    .order('desc')
    .first()
  const stamped = {
    ...identity,
    createdAt:
      newest && newest.createdAt >= identity.createdAt
        ? new Date(Date.parse(newest.createdAt) + 1).toISOString()
        : identity.createdAt
  }
  await ctx.db.insert('campaignConversationEntries', createCampaignEntryHeader(stamped, payload))
  await ctx.db.insert('campaignConversationEntryPayloads', payload)
  return stamped
}

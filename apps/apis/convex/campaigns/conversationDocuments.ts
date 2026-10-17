import {
  campaignChatUnreadCountLimit,
  campaignConversationDtoSchema,
  type CampaignChatEntryDto,
  type CampaignConversationDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { presentChatEntries as presentStoredChatEntries } from '@artificer-toolkit/encounter-persistence/conversationPresentation'
import type { campaignStoredEntryIdentitySchema } from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import {
  findConversation as findStoredConversation,
  conversationParticipants as readConversationParticipants,
  conversationAccess as readConversationAccess,
  openConversation as openStoredConversation,
  insertConversationEntry as insertStoredConversationEntry,
  readConversationEntryReplay as readStoredConversationEntryReplay
} from '@artificer-toolkit/encounter-persistence/conversationPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'
import { readCampaignAuthorLabels } from './authorLabels'
import { requireCampaignAuthority, readActiveCampaignMembers } from './authority'

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
  return findStoredConversation(
    { db: createConvexEncounterStoreReader(ctx) },
    campaignId,
    kind,
    participantUserIds
  )
}

export async function conversationParticipants(
  ctx: QueryCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  kind: CampaignConversationDto['kind'],
  directUserId?: string
) {
  return readConversationParticipants(
    authority,
    kind,
    (campaignId, userId) => requireCampaignAuthority(ctx, campaignId, userId),
    directUserId
  )
}

export async function conversationAccess(
  ctx: QueryCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  conversation: Doc<'campaignConversations'>
) {
  return readConversationAccess(
    { db: createConvexEncounterStoreReader(ctx) },
    authority,
    conversation,
    (campaignId, userId) => requireCampaignAuthority(ctx, campaignId, userId)
  )
}

export async function openConversation(
  ctx: MutationCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  kind: CampaignConversationDto['kind'],
  directUserId?: string
) {
  return openStoredConversation(
    { db: createConvexEncounterStore(ctx) },
    authority,
    kind,
    (campaignId, userId) => requireCampaignAuthority(ctx, campaignId, userId),
    directUserId
  )
}

/**
 * Unread entries are the member's visible entries (at or after the access cutoff) strictly after
 * the last-read timestamp, so equal-time entries share read state. The count comes from the entry
 * index and the member row alone: send, edit, unsend and mark-read keep nothing else in step. An
 * unsent entry keeps its header as a tombstone in the log, so it counts like any other entry.
 */
export async function countUnreadEntries(
  ctx: QueryCtx,
  conversation: Doc<'campaignConversations'>,
  member: Doc<'campaignConversationMembers'>
) {
  const { accessStartedAt, lastReadAt } = member
  const unread = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_conversationId_createdAt_id', (q) => {
      const room = q.eq('conversationId', conversation.id)
      return lastReadAt !== null && lastReadAt >= accessStartedAt
        ? room.gt('createdAt', lastReadAt)
        : room.gte('createdAt', accessStartedAt)
    })
    .take(campaignChatUnreadCountLimit)
  return unread.length
}

export async function presentConversation(
  ctx: QueryCtx,
  conversation: Doc<'campaignConversations'>,
  member: Doc<'campaignConversationMembers'>
): Promise<CampaignConversationDto> {
  return campaignConversationDtoSchema.parse({
    id: conversation.id,
    campaignId: conversation.campaignId,
    kind: conversation.kind,
    participantUserIds: conversation.participantUserIds,
    createdAt: conversation.createdAt,
    lastReadAt: member.lastReadAt,
    unreadCount: await countUnreadEntries(ctx, conversation, member)
  })
}

/** The member's earlier entry for this client nonce, or null; see the shared reader. */
export async function readConversationEntryReplay(
  ctx: QueryCtx,
  access: Awaited<ReturnType<typeof openConversation>>,
  authorUserId: string,
  clientNonce: string,
  kind: Doc<'campaignConversationEntryPayloads'>['kind']
) {
  return readStoredConversationEntryReplay(
    { db: createConvexEncounterStoreReader(ctx) },
    access,
    authorUserId,
    clientNonce,
    kind
  )
}

export async function readEntryPayload(ctx: QueryCtx, entryId: string) {
  const payload = await ctx.db
    .query('campaignConversationEntryPayloads')
    .withIndex('by_entryId', (q) => q.eq('entryId', entryId))
    .unique()
  if (!payload) throw new Error('Stored conversation payload is unavailable.')
  return payload
}

/** Text and rolls write both halves of an entry together; history is kept and paged, not trimmed. */
export async function insertConversationEntry(
  ctx: MutationCtx,
  identity: ReturnType<typeof campaignStoredEntryIdentitySchema.parse>,
  payload: Omit<Doc<'campaignConversationEntryPayloads'>, '_id' | '_creationTime'>
) {
  return insertStoredConversationEntry({ db: createConvexEncounterStore(ctx) }, identity, payload)
}

type StoredEntry = {
  header: Pick<
    Doc<'campaignConversationEntries'>,
    'id' | 'campaignId' | 'conversationId' | 'authorUserId' | 'createdAt'
  >
  payload:
    | Doc<'campaignConversationEntryPayloads'>
    | Omit<Doc<'campaignConversationEntryPayloads'>, '_id' | '_creationTime'>
}

export async function presentChatEntry(
  ctx: QueryCtx,
  entry: StoredEntry['header'],
  payload: StoredEntry['payload'],
  conversation: Doc<'campaignConversations'>,
  maturity: 'STANDARD' | 'MATURE'
): Promise<CampaignChatEntryDto> {
  const [presented] = await presentChatEntries(
    ctx,
    [{ header: entry, payload }],
    conversation,
    maturity
  )
  return presented!
}

/** Presents a page of entries, reading each distinct author's label once. */
export async function presentChatEntries(
  ctx: QueryCtx,
  entries: StoredEntry[],
  conversation: Doc<'campaignConversations'>,
  maturity: 'STANDARD' | 'MATURE'
): Promise<CampaignChatEntryDto[]> {
  const authorUsernames = await readCampaignAuthorLabels(
    ctx,
    entries.map(({ header, payload }) => ({
      userId: header.authorUserId,
      username: payload.authorUsername
    }))
  )
  return presentStoredChatEntries(entries, conversation, maturity, authorUsernames)
}

import type { DbTables, DBLike, Json } from '#types'
import { sql } from 'kysely'
import {
  toIsoString,
  toOptionalIsoString,
  type RuntimeTimestamp
} from './campaignCollaborationShared.js'

export type CampaignConversationKind = 'TABLE' | 'PARTY' | 'DIRECT'
export type CampaignRoom = CampaignConversationKind
export type CampaignChatMode = 'OOC' | 'ROLEPLAY'

type ConversationRow = Omit<DbTables['campaign_conversations']['Row'], 'created_at'> & {
  created_at: RuntimeTimestamp
}
type ConversationMemberRow = Omit<
  DbTables['campaign_conversation_members']['Row'],
  'access_started_at' | 'last_read_at' | 'updated_at'
> & {
  access_started_at: RuntimeTimestamp
  last_read_at: RuntimeTimestamp | null
  updated_at: RuntimeTimestamp
}
type RoomEntryRow = Omit<
  DbTables['campaign_conversation_entries']['Row'],
  'created_at' | 'edited_at' | 'unsent_at'
> & {
  created_at: RuntimeTimestamp
  edited_at: RuntimeTimestamp | null
  unsent_at: RuntimeTimestamp | null
  room: string
}

export interface CampaignRoomEntry {
  id: string
  campaignId: string
  room: CampaignRoom
  kind: 'CHAT' | 'ROLL'
  authorUserId: string
  authorCharacterId: string | null
  mode: CampaignChatMode | null
  body: string | null
  rollPayload: Json | null
  usernameSnapshot: string
  characterNameSnapshot: string | null
  clientNonce: string
  editedAt: string | null
  unsentAt: string | null
  createdAt: string
  conversationId: string
}
export interface CampaignConversation {
  id: string
  campaignId: string
  kind: CampaignConversationKind
  participantUserIds: string[]
  createdAt: string
}
interface InsertRoomEntryBase {
  campaignId: string
  conversationId: string
  room: CampaignRoom
  authorUserId: string
  authorCharacterId: string | null
  usernameSnapshot: string
  characterNameSnapshot: string | null
  clientNonce: string
}
export type InsertCampaignRoomEntryInput = InsertRoomEntryBase &
  ({ kind: 'CHAT'; mode: CampaignChatMode; body: string } | { kind: 'ROLL'; rollPayload: Json })

function toConversation(row: ConversationRow): CampaignConversation {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: row.kind as CampaignConversationKind,
    participantUserIds:
      row.kind === 'DIRECT' ? [row.direct_user_a as string, row.direct_user_b as string] : [],
    createdAt: toIsoString(row.created_at)
  }
}
function toRoomEntry(row: RoomEntryRow): CampaignRoomEntry {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    room: row.room as CampaignRoom,
    conversationId: row.conversation_id,
    kind: row.kind as CampaignRoomEntry['kind'],
    authorUserId: row.author_user_id,
    authorCharacterId: row.author_character_id,
    mode: row.mode as CampaignChatMode | null,
    body: row.body,
    rollPayload: row.roll_payload,
    usernameSnapshot: row.username_snapshot,
    characterNameSnapshot: row.character_name_snapshot,
    clientNonce: row.client_nonce,
    editedAt: toOptionalIsoString(row.edited_at),
    unsentAt: toOptionalIsoString(row.unsent_at),
    createdAt: toIsoString(row.created_at)
  }
}

export function createCampaignConversationRepository(db: DBLike) {
  const repository = {
    async findConversation(input: {
      campaignId: string
      kind: CampaignConversationKind
      participantUserIds?: readonly string[]
    }): Promise<CampaignConversation | null> {
      const participants = [...(input.participantUserIds ?? [])].sort()
      let query = db
        .selectFrom('campaign_conversations')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
        .where('kind', '=', input.kind)
      if (input.kind === 'DIRECT')
        query = query
          .where('direct_user_a', '=', participants[0] ?? '')
          .where('direct_user_b', '=', participants[1] ?? '')
      const row = (await query.executeTakeFirst()) as ConversationRow | undefined
      return row ? toConversation(row) : null
    },
    async insertConversation(input: {
      campaignId: string
      kind: CampaignConversationKind
      participantUserIds?: readonly string[]
    }): Promise<CampaignConversation> {
      const participants = [...(input.participantUserIds ?? [])].sort()
      const row = (await db
        .insertInto('campaign_conversations')
        .values({
          campaign_id: input.campaignId,
          kind: input.kind,
          direct_user_a: input.kind === 'DIRECT' ? (participants[0] ?? null) : null,
          direct_user_b: input.kind === 'DIRECT' ? (participants[1] ?? null) : null
        })
        .onConflict((conflict) => conflict.doNothing())
        .returningAll()
        .executeTakeFirst()) as ConversationRow | undefined
      if (!row) {
        const existing = await repository.findConversation(input)
        if (!existing) throw new Error('Campaign conversation could not be created.')
        return existing
      }
      return toConversation(row)
    },
    async ensureConversationMember(input: {
      conversationId: string
      campaignId: string
      userId: string
      accessStartedAt: string
    }): Promise<void> {
      await db
        .insertInto('campaign_conversation_members')
        .values({
          conversation_id: input.conversationId,
          campaign_id: input.campaignId,
          user_id: input.userId,
          access_started_at: input.accessStartedAt
        })
        .onConflict((conflict) =>
          conflict.columns(['conversation_id', 'user_id']).doUpdateSet({
            access_started_at: input.accessStartedAt,
            updated_at: new Date().toISOString()
          })
        )
        .execute()
    },
    async listConversations(campaignId: string, userId: string): Promise<CampaignConversation[]> {
      const rows = (await db
        .selectFrom('campaign_conversations as conversations')
        .innerJoin(
          'campaign_conversation_members as members',
          'members.conversation_id',
          'conversations.id'
        )
        .select([
          'conversations.id',
          'conversations.campaign_id',
          'conversations.kind',
          'conversations.direct_user_a',
          'conversations.direct_user_b',
          'conversations.created_at'
        ])
        .where('conversations.campaign_id', '=', campaignId)
        .where('members.user_id', '=', userId)
        .orderBy('conversations.created_at', 'asc')
        .execute()) as ConversationRow[]
      return rows.map(toConversation)
    },
    async listConversationMembers(
      conversationId: string
    ): Promise<Array<{ userId: string; accessStartedAt: string }>> {
      const rows = (await db
        .selectFrom('campaign_conversation_members as conversation_members')
        .innerJoin('campaign_memberships as memberships', (join) =>
          join
            .onRef('memberships.campaign_id', '=', 'conversation_members.campaign_id')
            .onRef('memberships.user_id', '=', 'conversation_members.user_id')
        )
        .select(['conversation_members.user_id', 'conversation_members.access_started_at'])
        .where('conversation_members.conversation_id', '=', conversationId)
        .where('memberships.status', '=', 'ACTIVE')
        .execute()) as Array<{ user_id: string; access_started_at: RuntimeTimestamp }>
      return rows.map((row) => ({
        userId: row.user_id,
        accessStartedAt: toIsoString(row.access_started_at)
      }))
    },
    async markConversationRead(input: {
      conversationId: string
      userId: string
      entryId: string
    }): Promise<void> {
      await sql`UPDATE public.campaign_conversation_members AS member SET last_read_at = entry.created_at, updated_at = now() FROM public.campaign_conversation_entries AS entry WHERE member.conversation_id = ${input.conversationId}::uuid AND member.user_id = ${input.userId}::uuid AND entry.id = ${input.entryId}::uuid AND entry.conversation_id = member.conversation_id AND (member.last_read_at IS NULL OR member.last_read_at < entry.created_at)`.execute(
        db
      )
    },
    async isConversationMember(input: {
      conversationId: string
      userId: string
      accessStartedAt: string
    }): Promise<boolean> {
      const row = await db
        .selectFrom('campaign_conversation_members')
        .select('user_id')
        .where('conversation_id', '=', input.conversationId)
        .where('user_id', '=', input.userId)
        .where('access_started_at', '=', input.accessStartedAt)
        .executeTakeFirst()
      return Boolean(row)
    },
    async getConversationReadState(input: {
      conversationId: string
      userId: string
      accessStartedAt: string
    }): Promise<{ lastReadAt: string | null; unreadCount: number }> {
      const member = (await db
        .selectFrom('campaign_conversation_members')
        .selectAll()
        .where('conversation_id', '=', input.conversationId)
        .where('user_id', '=', input.userId)
        .executeTakeFirst()) as ConversationMemberRow | undefined
      const unread = await sql<{
        count: string | number
      }>`SELECT count(*) AS count FROM public.campaign_conversation_entries AS entry JOIN public.campaign_conversation_members AS conversation_member ON conversation_member.conversation_id = entry.conversation_id AND conversation_member.user_id = ${input.userId}::uuid WHERE entry.conversation_id = ${input.conversationId}::uuid AND entry.created_at >= ${input.accessStartedAt}::timestamptz AND (conversation_member.last_read_at IS NULL OR entry.created_at > conversation_member.last_read_at)`.execute(
        db
      )
      return {
        lastReadAt: member?.last_read_at ? toIsoString(member.last_read_at) : null,
        unreadCount: Number(unread.rows[0]?.count ?? 0)
      }
    },
    async findIdempotentRoomEntry(input: {
      campaignId: string
      authorUserId: string
      clientNonce: string
    }): Promise<CampaignRoomEntry | null> {
      const row = (await db
        .selectFrom('campaign_conversation_entries as entries')
        .innerJoin(
          'campaign_conversations as conversations',
          'conversations.id',
          'entries.conversation_id'
        )
        .selectAll('entries')
        .select('conversations.kind as room')
        .where('entries.campaign_id', '=', input.campaignId)
        .where('entries.author_user_id', '=', input.authorUserId)
        .where('entries.client_nonce', '=', input.clientNonce)
        .executeTakeFirst()) as RoomEntryRow | undefined
      return row ? toRoomEntry(row) : null
    },
    async countAuthorEntriesSince(input: {
      campaignId: string
      authorUserId: string
      since: string
    }): Promise<number> {
      const row = await db
        .selectFrom('campaign_conversation_entries')
        .select((expressionBuilder) => expressionBuilder.fn.countAll().as('count'))
        .where('campaign_id', '=', input.campaignId)
        .where('author_user_id', '=', input.authorUserId)
        .where('created_at', '>=', input.since)
        .executeTakeFirst()
      return Number(row?.count ?? 0)
    },
    async insertRoomEntry(input: InsertCampaignRoomEntryInput): Promise<CampaignRoomEntry> {
      const row = (await db
        .insertInto('campaign_conversation_entries')
        .values({
          campaign_id: input.campaignId,
          conversation_id: input.conversationId,
          kind: input.kind,
          author_user_id: input.authorUserId,
          author_character_id: input.authorCharacterId,
          mode: input.kind === 'CHAT' ? input.mode : null,
          body: input.kind === 'CHAT' ? input.body : null,
          roll_payload: input.kind === 'ROLL' ? input.rollPayload : null,
          username_snapshot: input.usernameSnapshot,
          character_name_snapshot: input.characterNameSnapshot,
          client_nonce: input.clientNonce
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as RoomEntryRow
      return toRoomEntry({ ...row, room: input.room })
    },
    async listRoomEntries(input: {
      campaignId: string
      room: CampaignRoom
      conversationId: string
      accessStartedAt: string
      cursorId?: string
      limit: number
    }): Promise<CampaignRoomEntry[]> {
      let cursor: { created_at: string; id: string } | undefined
      if (input.cursorId) {
        cursor = await db
          .selectFrom('campaign_conversation_entries')
          .select(['created_at', 'id'])
          .where('campaign_id', '=', input.campaignId)
          .where('conversation_id', '=', input.conversationId)
          .where('id', '=', input.cursorId)
          .where('created_at', '>=', input.accessStartedAt)
          .executeTakeFirst()
        if (!cursor) return []
      }
      let query = db
        .selectFrom('campaign_conversation_entries')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
        .where('conversation_id', '=', input.conversationId)
        .where('created_at', '>=', input.accessStartedAt)
      if (cursor)
        query = query.where((expressionBuilder) =>
          expressionBuilder.or([
            expressionBuilder('created_at', '<', cursor.created_at),
            expressionBuilder.and([
              expressionBuilder('created_at', '=', cursor.created_at),
              expressionBuilder('id', '<', cursor.id)
            ])
          ])
        )
      const rows = (await query
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(input.limit + 1)
        .execute()) as RoomEntryRow[]
      return rows.map((row) => toRoomEntry({ ...row, room: input.room }))
    },
    async findRoomEntry(campaignId: string, id: string): Promise<CampaignRoomEntry | null> {
      const row = (await db
        .selectFrom('campaign_conversation_entries as entries')
        .innerJoin(
          'campaign_conversations as conversations',
          'conversations.id',
          'entries.conversation_id'
        )
        .selectAll('entries')
        .select('conversations.kind as room')
        .where('entries.campaign_id', '=', campaignId)
        .where('entries.id', '=', id)
        .executeTakeFirst()) as RoomEntryRow | undefined
      return row ? toRoomEntry(row) : null
    },
    async updateChatBody(input: {
      campaignId: string
      id: string
      authorUserId: string
      body: string
      editedAt: string
    }): Promise<CampaignRoomEntry | null> {
      const row = (await db
        .updateTable('campaign_conversation_entries')
        .set({ body: input.body, edited_at: input.editedAt })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('author_user_id', '=', input.authorUserId)
        .where('kind', '=', 'CHAT')
        .where('unsent_at', 'is', null)
        .returningAll()
        .executeTakeFirst()) as RoomEntryRow | undefined
      if (!row) return null
      const conversation = await db
        .selectFrom('campaign_conversations')
        .select('kind')
        .where('id', '=', row.conversation_id)
        .executeTakeFirst()
      return toRoomEntry({ ...row, room: conversation?.kind ?? 'TABLE' })
    },
    async tombstoneChat(input: {
      campaignId: string
      id: string
      authorUserId: string
      unsentAt: string
    }): Promise<CampaignRoomEntry | null> {
      const row = (await db
        .updateTable('campaign_conversation_entries')
        .set({ body: null, unsent_at: input.unsentAt })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('author_user_id', '=', input.authorUserId)
        .where('kind', '=', 'CHAT')
        .where('unsent_at', 'is', null)
        .returningAll()
        .executeTakeFirst()) as RoomEntryRow | undefined
      if (!row) return null
      const conversation = await db
        .selectFrom('campaign_conversations')
        .select('kind')
        .where('id', '=', row.conversation_id)
        .executeTakeFirst()
      return toRoomEntry({ ...row, room: conversation?.kind ?? 'TABLE' })
    }
  }
  return repository
}

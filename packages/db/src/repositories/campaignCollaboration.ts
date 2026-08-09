import type { DbTables, DBLike, Json } from '#types'
import { sql } from 'kysely'
import type { AuthoredSubjectKind } from '../domains/subjects/repositories/authoredContent.js'

export type CampaignConversationKind = 'TABLE' | 'PARTY' | 'DIRECT'
export type CampaignRoom = CampaignConversationKind
export type CampaignChatMode = 'OOC' | 'ROLEPLAY'
export type CampaignNoteVisibility = 'GM_PRIVATE' | 'SHARED'
export type CampaignNoteCategory = 'GENERAL' | 'PEOPLE' | 'PLACES'
export type CampaignSessionStatus = 'OPEN' | 'FINISHED'
export type CampaignSessionRsvpResponse = 'YES' | 'NO' | 'MAYBE'
export type CampaignSessionNoteVisibility = 'SHARED' | 'GM_PRIVATE'
export type CampaignSessionNoteKind =
  | 'SHARED_NOTE'
  | 'AGENDA'
  | 'SCENE'
  | 'SECRET'
  | 'REWARD'
  | 'SCRATCHPAD'
  | 'RECAP'
  | 'ENDING_STATE'
  | 'CANON'
  | 'RULING'
  | 'FOLLOW_UP'

type RuntimeTimestamp = Date | string
type GeneratedConversationRow = DbTables['campaign_conversations']['Row']
type GeneratedConversationMemberRow = DbTables['campaign_conversation_members']['Row']
type GeneratedRoomEntryRow = DbTables['campaign_conversation_entries']['Row']
type GeneratedNoteSectionRow = DbTables['campaign_note_sections']['Row']
type GeneratedSessionRow = DbTables['campaign_sessions']['Row']
type GeneratedSessionNoteSectionRow = DbTables['campaign_session_note_sections']['Row']
type GeneratedSessionAttendanceRow = DbTables['campaign_session_attendance']['Row']
type GeneratedSessionRsvpRow = DbTables['campaign_session_rsvps']['Row']

type RoomEntryRow = Omit<GeneratedRoomEntryRow, 'created_at' | 'edited_at' | 'unsent_at'> & {
  created_at: RuntimeTimestamp
  edited_at: RuntimeTimestamp | null
  unsent_at: RuntimeTimestamp | null
  room: string
}

type ConversationRow = Omit<GeneratedConversationRow, 'created_at'> & {
  created_at: RuntimeTimestamp
}
type ConversationMemberRow = Omit<
  GeneratedConversationMemberRow,
  'access_started_at' | 'last_read_at' | 'updated_at'
> & {
  access_started_at: RuntimeTimestamp
  last_read_at: RuntimeTimestamp | null
  updated_at: RuntimeTimestamp
}

type NoteSectionRow = Omit<GeneratedNoteSectionRow, 'created_at' | 'updated_at'> & {
  created_at: RuntimeTimestamp
  updated_at: RuntimeTimestamp
}

type SessionRow = Omit<
  GeneratedSessionRow,
  'created_at' | 'scheduled_start_at' | 'scheduled_end_at' | 'updated_at'
> & {
  created_at: RuntimeTimestamp
  scheduled_start_at: RuntimeTimestamp | null
  scheduled_end_at: RuntimeTimestamp | null
  updated_at: RuntimeTimestamp
  status: CampaignSessionStatus
  finished_at: RuntimeTimestamp | null
}

type SessionAttendanceRow = GeneratedSessionAttendanceRow
type SessionRsvpRow = Omit<GeneratedSessionRsvpRow, 'updated_at'> & { updated_at: RuntimeTimestamp }

type SessionNoteSectionRow = Omit<GeneratedSessionNoteSectionRow, 'created_at' | 'updated_at'> & {
  created_at: RuntimeTimestamp
  updated_at: RuntimeTimestamp
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

export interface CampaignNoteSection {
  id: string
  campaignId: string
  title: string
  content: string
  visibility: CampaignNoteVisibility
  category: CampaignNoteCategory
  sortOrder: number
  version: number
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface InsertCampaignNoteSectionInput {
  campaignId: string
  title: string
  content: string
  visibility: CampaignNoteVisibility
  category: CampaignNoteCategory
  sortOrder: number
  createdBy: string
}

export interface UpdateCampaignNoteSectionInput {
  campaignId: string
  id: string
  expectedVersion: number
  title: string
  content: string
  visibility: CampaignNoteVisibility
  category: CampaignNoteCategory
  sortOrder: number
  updatedBy: string
  updatedAt: string
}

export interface CampaignSession {
  id: string
  campaignId: string
  sessionNumber: number
  title: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  timeZone: string | null
  status: CampaignSessionStatus
  finishedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface InsertCampaignSessionInput {
  campaignId: string
  title: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  timeZone: string | null
}

export interface UpdateCampaignSessionInput {
  campaignId: string
  id: string
  expectedVersion: number
  title: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  timeZone: string | null
  updatedAt: string
}

export interface CampaignSessionAttendance {
  campaignId: string
  sessionId: string
  characterId: string
  present: boolean
}

export interface CampaignSessionRsvp {
  campaignId: string
  sessionId: string
  userId: string
  response: CampaignSessionRsvpResponse
  updatedAt: string
}

export type CampaignSessionReferencePinTarget =
  | { kind: 'CAMPAIGN_NOTE'; noteSectionId: string }
  | { kind: 'AUTHORED_ROUTE'; routeSubjectKind: AuthoredSubjectKind; publicId: string }

export interface CampaignSessionReferencePin {
  id: string
  campaignId: string
  sessionId: string
  target: CampaignSessionReferencePinTarget
  createdAt: string
}

export interface CampaignSessionNoteSection {
  id: string
  sessionId: string
  title: string
  content: string
  visibility: CampaignSessionNoteVisibility
  kind: CampaignSessionNoteKind
  sortOrder: number
  version: number
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface InsertCampaignSessionNoteSectionInput {
  sessionId: string
  title: string
  content: string
  visibility: CampaignSessionNoteVisibility
  kind: CampaignSessionNoteKind
  sortOrder: number
  createdBy: string
}

export interface UpdateCampaignSessionNoteSectionInput {
  sessionId: string
  id: string
  expectedVersion: number
  title: string
  content: string
  visibility: CampaignSessionNoteVisibility
  kind: CampaignSessionNoteKind
  sortOrder: number
  updatedBy: string
  updatedAt: string
}

function toIsoString(value: RuntimeTimestamp): string {
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return parsed.toISOString()
}

function toOptionalIsoString(value: RuntimeTimestamp | null): string | null {
  return value === null ? null : toIsoString(value)
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

function toNoteSection(row: NoteSectionRow): CampaignNoteSection {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    content: row.content,
    visibility: row.visibility as CampaignNoteVisibility,
    category: row.category as CampaignNoteCategory,
    sortOrder: row.sort_order,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function toSession(row: SessionRow): CampaignSession {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    sessionNumber: row.session_number,
    title: row.title,
    scheduledStartAt: toOptionalIsoString(row.scheduled_start_at),
    scheduledEndAt: toOptionalIsoString(row.scheduled_end_at),
    timeZone: row.time_zone,
    status: row.status,
    finishedAt: toOptionalIsoString(row.finished_at),
    version: row.version,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function toSessionAttendance(row: SessionAttendanceRow): CampaignSessionAttendance {
  return {
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    characterId: row.character_id,
    present: row.present
  }
}

function toSessionRsvp(row: SessionRsvpRow): CampaignSessionRsvp {
  return {
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    userId: row.user_id,
    response: row.response as CampaignSessionRsvpResponse,
    updatedAt: toIsoString(row.updated_at)
  }
}

function toSessionReferencePin(row: {
  id: string
  campaign_id: string
  session_id: string
  target_kind: 'CAMPAIGN_NOTE' | 'AUTHORED_ROUTE'
  note_section_id: string | null
  route_subject_kind: string | null
  route_public_id: string | null
  created_at: RuntimeTimestamp
}): CampaignSessionReferencePin {
  let target: CampaignSessionReferencePinTarget
  if (row.target_kind === 'CAMPAIGN_NOTE') {
    if (!row.note_section_id) throw new Error('Campaign note reference pin is missing its note.')
    target = { kind: 'CAMPAIGN_NOTE', noteSectionId: row.note_section_id }
  } else {
    if (!row.route_public_id) throw new Error('Authored reference pin is missing its public ID.')
    target = {
      kind: 'AUTHORED_ROUTE',
      routeSubjectKind: requireAuthoredSubjectKind(row.route_subject_kind),
      publicId: row.route_public_id
    }
  }
  return {
    id: row.id,
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    target,
    createdAt: toIsoString(row.created_at)
  }
}

function requireAuthoredSubjectKind(value: string | null): AuthoredSubjectKind {
  if (
    value === 'BACKGROUND' ||
    value === 'CLASS' ||
    value === 'CREATURE' ||
    value === 'EQUIPMENT' ||
    value === 'FEAT' ||
    value === 'RACE' ||
    value === 'SPELL' ||
    value === 'VEHICLE'
  ) {
    return value
  }
  throw new Error('Authored reference pin has an invalid subject kind.')
}

function toSessionNoteSection(row: SessionNoteSectionRow): CampaignSessionNoteSection {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    content: row.content,
    visibility: row.visibility as CampaignSessionNoteVisibility,
    kind: row.kind as CampaignSessionNoteKind,
    sortOrder: row.sort_order,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

export function createCampaignCollaborationRepository(db: DBLike) {
  return {
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
      if (input.kind === 'DIRECT') {
        query = query
          .where('direct_user_a', '=', participants[0] ?? '')
          .where('direct_user_b', '=', participants[1] ?? '')
      }
      const row = (await query.executeTakeFirst()) as ConversationRow | undefined
      return row
        ? {
            id: row.id,
            campaignId: row.campaign_id,
            kind: row.kind as CampaignConversationKind,
            participantUserIds:
              row.kind === 'DIRECT'
                ? [row.direct_user_a as string, row.direct_user_b as string]
                : [],
            createdAt: toIsoString(row.created_at)
          }
        : null
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
        const existing = await this.findConversation(input)
        if (!existing) throw new Error('Campaign conversation could not be created.')
        return existing
      }
      return {
        id: row.id,
        campaignId: row.campaign_id,
        kind: row.kind as CampaignConversationKind,
        participantUserIds:
          row.kind === 'DIRECT' ? [row.direct_user_a as string, row.direct_user_b as string] : [],
        createdAt: toIsoString(row.created_at)
      }
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
      return rows.map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        kind: row.kind as CampaignConversationKind,
        participantUserIds:
          row.kind === 'DIRECT' ? [row.direct_user_a as string, row.direct_user_b as string] : [],
        createdAt: toIsoString(row.created_at)
      }))
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
      await sql`
        UPDATE public.campaign_conversation_members AS member
        SET last_read_at = entry.created_at, updated_at = now()
        FROM public.campaign_conversation_entries AS entry
        WHERE member.conversation_id = ${input.conversationId}::uuid
          AND member.user_id = ${input.userId}::uuid
          AND entry.id = ${input.entryId}::uuid
          AND entry.conversation_id = member.conversation_id
          AND (member.last_read_at IS NULL OR member.last_read_at < entry.created_at)
      `.execute(db)
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
      const lastReadAt = member?.last_read_at ? toIsoString(member.last_read_at) : null
      const unread = await sql<{ count: string | number }>`
        SELECT count(*) AS count
        FROM public.campaign_conversation_entries AS entry
        JOIN public.campaign_conversation_members AS conversation_member
          ON conversation_member.conversation_id = entry.conversation_id
         AND conversation_member.user_id = ${input.userId}::uuid
        WHERE entry.conversation_id = ${input.conversationId}::uuid
          AND entry.created_at >= ${input.accessStartedAt}::timestamptz
          AND (
            conversation_member.last_read_at IS NULL
            OR entry.created_at > conversation_member.last_read_at
          )
      `.execute(db)
      return { lastReadAt, unreadCount: Number(unread.rows[0]?.count ?? 0) }
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
      if (!row) return null
      const conversation = await db
        .selectFrom('campaign_conversations')
        .select('kind')
        .where('id', '=', row.conversation_id)
        .executeTakeFirst()
      return toRoomEntry({ ...row, room: conversation?.kind ?? 'TABLE' } as RoomEntryRow)
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
      return toRoomEntry({ ...row, room: input.room } as RoomEntryRow)
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

      if (cursor) {
        query = query.where((expressionBuilder) =>
          expressionBuilder.or([
            expressionBuilder('created_at', '<', cursor.created_at),
            expressionBuilder.and([
              expressionBuilder('created_at', '=', cursor.created_at),
              expressionBuilder('id', '<', cursor.id)
            ])
          ])
        )
      }

      const rows = (await query
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(input.limit + 1)
        .execute()) as RoomEntryRow[]
      return rows.map((row) => toRoomEntry({ ...row, room: input.room } as RoomEntryRow))
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
      if (!row) return null
      const conversation = await db
        .selectFrom('campaign_conversations')
        .select('kind')
        .where('id', '=', row.conversation_id)
        .executeTakeFirst()
      return toRoomEntry({ ...row, room: conversation?.kind ?? 'TABLE' } as RoomEntryRow)
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
      return toRoomEntry({ ...row, room: conversation?.kind ?? 'TABLE' } as RoomEntryRow)
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
      return toRoomEntry({ ...row, room: conversation?.kind ?? 'TABLE' } as RoomEntryRow)
    },

    async listCampaignNoteSections(
      campaignId: string,
      visibility: 'ALL' | 'SHARED'
    ): Promise<CampaignNoteSection[]> {
      let query = db
        .selectFrom('campaign_note_sections')
        .selectAll()
        .where('campaign_id', '=', campaignId)
      if (visibility === 'SHARED') query = query.where('visibility', '=', 'SHARED')
      const rows = (await query
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
        .execute()) as NoteSectionRow[]
      return rows.map(toNoteSection)
    },

    async insertCampaignNoteSection(
      input: InsertCampaignNoteSectionInput
    ): Promise<CampaignNoteSection> {
      const row = (await db
        .insertInto('campaign_note_sections')
        .values({
          campaign_id: input.campaignId,
          title: input.title,
          content: input.content,
          visibility: input.visibility,
          category: input.category,
          sort_order: input.sortOrder,
          created_by: input.createdBy,
          updated_by: input.createdBy
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as NoteSectionRow
      return toNoteSection(row)
    },

    async updateCampaignNoteSection(
      input: UpdateCampaignNoteSectionInput
    ): Promise<CampaignNoteSection | null> {
      const row = (await db
        .updateTable('campaign_note_sections')
        .set({
          title: input.title,
          content: input.content,
          visibility: input.visibility,
          category: input.category,
          sort_order: input.sortOrder,
          updated_by: input.updatedBy,
          updated_at: input.updatedAt,
          version: input.expectedVersion + 1
        })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()) as NoteSectionRow | undefined
      return row ? toNoteSection(row) : null
    },

    async deleteCampaignNoteSection(campaignId: string, id: string): Promise<boolean> {
      const row = await db
        .deleteFrom('campaign_note_sections')
        .where('campaign_id', '=', campaignId)
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    async listCampaignSessions(campaignId: string): Promise<CampaignSession[]> {
      const rows = (await db
        .selectFrom('campaign_sessions')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .orderBy('session_number', 'desc')
        .execute()) as SessionRow[]
      return rows.map(toSession)
    },

    async insertCampaignSession(input: InsertCampaignSessionInput): Promise<CampaignSession> {
      const maxSession = await db
        .selectFrom('campaign_sessions')
        .select(({ fn }) => fn.max('session_number').as('maxSessionNumber'))
        .where('campaign_id', '=', input.campaignId)
        .executeTakeFirst()
      const sessionNumber = Number(maxSession?.maxSessionNumber ?? 0) + 1
      const row = (await db
        .insertInto('campaign_sessions')
        .values({
          campaign_id: input.campaignId,
          session_number: sessionNumber,
          title: input.title,
          scheduled_start_at: input.scheduledStartAt,
          scheduled_end_at: input.scheduledEndAt,
          time_zone: input.timeZone
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as SessionRow
      return toSession(row)
    },

    async updateCampaignSession(
      input: UpdateCampaignSessionInput
    ): Promise<CampaignSession | null> {
      const row = (await db
        .updateTable('campaign_sessions')
        .set({
          title: input.title,
          scheduled_start_at: input.scheduledStartAt,
          scheduled_end_at: input.scheduledEndAt,
          time_zone: input.timeZone,
          updated_at: input.updatedAt,
          version: input.expectedVersion + 1
        })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()) as SessionRow | undefined
      return row ? toSession(row) : null
    },

    async findCampaignSession(
      campaignId: string,
      sessionNumber: number
    ): Promise<CampaignSession | null> {
      const row = (await db
        .selectFrom('campaign_sessions')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('session_number', '=', sessionNumber)
        .executeTakeFirst()) as SessionRow | undefined
      return row ? toSession(row) : null
    },

    async updateCampaignSessionLifecycle(input: {
      campaignId: string
      id: string
      expectedVersion: number
      status: CampaignSessionStatus
      finishedAt: string | null
    }): Promise<CampaignSession | null> {
      const row = (await db
        .updateTable('campaign_sessions')
        .set({
          status: input.status,
          finished_at: input.finishedAt,
          updated_at: input.finishedAt ?? new Date().toISOString(),
          version: input.expectedVersion + 1
        })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()) as SessionRow | undefined
      return row ? toSession(row) : null
    },

    async seedSessionAttendance(
      campaignId: string,
      sessionId: string,
      characterIds: readonly string[]
    ): Promise<void> {
      if (characterIds.length === 0) return
      await db
        .insertInto('campaign_session_attendance')
        .values(
          characterIds.map((characterId) => ({
            campaign_id: campaignId,
            session_id: sessionId,
            character_id: characterId,
            present: true
          }))
        )
        .onConflict((oc) => oc.columns(['session_id', 'character_id']).doNothing())
        .execute()
    },

    async listSessionAttendance(sessionId: string): Promise<CampaignSessionAttendance[]> {
      const rows = (await db
        .selectFrom('campaign_session_attendance')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('character_id', 'asc')
        .execute()) as SessionAttendanceRow[]
      return rows.map(toSessionAttendance)
    },

    async upsertSessionAttendance(input: {
      campaignId: string
      sessionId: string
      characterId: string
      present: boolean
    }): Promise<CampaignSessionAttendance> {
      const row = (await db
        .insertInto('campaign_session_attendance')
        .values({
          campaign_id: input.campaignId,
          session_id: input.sessionId,
          character_id: input.characterId,
          present: input.present
        })
        .onConflict((oc) =>
          oc.columns(['session_id', 'character_id']).doUpdateSet({
            present: input.present,
            updated_at: new Date().toISOString()
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow()) as SessionAttendanceRow
      return toSessionAttendance(row)
    },

    async listSessionRsvps(sessionId: string): Promise<CampaignSessionRsvp[]> {
      const rows = (await db
        .selectFrom('campaign_session_rsvps')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('updated_at', 'desc')
        .execute()) as SessionRsvpRow[]
      return rows.map(toSessionRsvp)
    },

    async upsertSessionRsvp(input: {
      campaignId: string
      sessionId: string
      userId: string
      response: CampaignSessionRsvpResponse
    }): Promise<CampaignSessionRsvp> {
      const row = (await db
        .insertInto('campaign_session_rsvps')
        .values({
          campaign_id: input.campaignId,
          session_id: input.sessionId,
          user_id: input.userId,
          response: input.response
        })
        .onConflict((oc) =>
          oc.columns(['session_id', 'user_id']).doUpdateSet({
            response: input.response,
            updated_at: new Date().toISOString()
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow()) as SessionRsvpRow
      return toSessionRsvp(row)
    },

    async listSessionReferencePins(sessionId: string): Promise<CampaignSessionReferencePin[]> {
      const result = await sql<{
        id: string
        campaign_id: string
        session_id: string
        target_kind: 'CAMPAIGN_NOTE' | 'AUTHORED_ROUTE'
        note_section_id: string | null
        route_subject_kind: string | null
        route_public_id: string | null
        created_at: RuntimeTimestamp
      }>`
        select id, campaign_id, session_id, target_kind, note_section_id, route_subject_kind, route_public_id, created_at
        from campaign_session_reference_pins
        where session_id = ${sessionId}::uuid
        order by created_at asc, id asc
      `.execute(db)
      return result.rows.map(toSessionReferencePin)
    },

    async insertSessionReferencePin(input: {
      campaignId: string
      sessionId: string
      target: CampaignSessionReferencePinTarget
    }): Promise<CampaignSessionReferencePin> {
      const target = input.target
      const result = await sql<{
        id: string
        campaign_id: string
        session_id: string
        target_kind: 'CAMPAIGN_NOTE' | 'AUTHORED_ROUTE'
        note_section_id: string | null
        route_subject_kind: string | null
        route_public_id: string | null
        created_at: RuntimeTimestamp
      }>`
        insert into campaign_session_reference_pins (
          campaign_id, session_id, target_kind, note_section_id, route_subject_kind, route_public_id
        ) values (
          ${input.campaignId}::uuid,
          ${input.sessionId}::uuid,
          ${target.kind},
          ${target.kind === 'CAMPAIGN_NOTE' ? target.noteSectionId : null}::uuid,
          ${target.kind === 'AUTHORED_ROUTE' ? target.routeSubjectKind : null},
          ${target.kind === 'AUTHORED_ROUTE' ? target.publicId : null}
        ) returning id, campaign_id, session_id, target_kind, note_section_id, route_subject_kind, route_public_id, created_at
      `.execute(db)
      return toSessionReferencePin(result.rows[0] as Parameters<typeof toSessionReferencePin>[0])
    },

    async deleteSessionReferencePin(sessionId: string, id: string): Promise<boolean> {
      const result = await sql<{ id: string }>`
        delete from campaign_session_reference_pins
        where session_id = ${sessionId}::uuid and id = ${id}::uuid
        returning id
      `.execute(db)
      return result.rows.length > 0
    },

    async deleteCampaignSession(campaignId: string, id: string): Promise<boolean> {
      const row = await db
        .deleteFrom('campaign_sessions')
        .where('campaign_id', '=', campaignId)
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    async listSessionNoteSections(sessionId: string): Promise<CampaignSessionNoteSection[]> {
      const rows = (await db
        .selectFrom('campaign_session_note_sections')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
        .execute()) as SessionNoteSectionRow[]
      return rows.map(toSessionNoteSection)
    },

    async insertSessionNoteSection(
      input: InsertCampaignSessionNoteSectionInput
    ): Promise<CampaignSessionNoteSection> {
      const row = (await db
        .insertInto('campaign_session_note_sections')
        .values({
          session_id: input.sessionId,
          title: input.title,
          content: input.content,
          visibility: input.visibility,
          kind: input.kind,
          sort_order: input.sortOrder,
          created_by: input.createdBy,
          updated_by: input.createdBy
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as SessionNoteSectionRow
      return toSessionNoteSection(row)
    },

    async updateSessionNoteSection(
      input: UpdateCampaignSessionNoteSectionInput
    ): Promise<CampaignSessionNoteSection | null> {
      const row = (await db
        .updateTable('campaign_session_note_sections')
        .set({
          title: input.title,
          content: input.content,
          visibility: input.visibility,
          kind: input.kind,
          sort_order: input.sortOrder,
          updated_by: input.updatedBy,
          updated_at: input.updatedAt,
          version: input.expectedVersion + 1
        })
        .where('session_id', '=', input.sessionId)
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()) as SessionNoteSectionRow | undefined
      return row ? toSessionNoteSection(row) : null
    },

    async deleteSessionNoteSection(sessionId: string, id: string): Promise<boolean> {
      const row = await db
        .deleteFrom('campaign_session_note_sections')
        .where('session_id', '=', sessionId)
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    async deleteSessionNoteSectionByAuthor(
      sessionId: string,
      id: string,
      authorUserId: string
    ): Promise<boolean> {
      const row = await db
        .deleteFrom('campaign_session_note_sections')
        .where('session_id', '=', sessionId)
        .where('id', '=', id)
        .where('created_by', '=', authorUserId)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    }
  }
}

import type { DbTables, DBLike } from '#types'
import { sql } from 'kysely'
import type { AuthoredSubjectKind } from '../domains/subjects/repositories/authoredContent.js'
import {
  toIsoString,
  toOptionalIsoString,
  type RuntimeTimestamp
} from './campaignCollaborationShared.js'

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
type GeneratedSessionRow = DbTables['campaign_sessions']['Row']
type GeneratedSessionNoteSectionRow = DbTables['campaign_session_note_sections']['Row']
type GeneratedSessionAttendanceRow = DbTables['campaign_session_attendance']['Row']
type GeneratedSessionRsvpRow = DbTables['campaign_session_rsvps']['Row']
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

export function createCampaignSessionRepository(db: DBLike) {
  return {
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

import { sql } from 'kysely'
import type { DBLike, Json } from '#types'

export type AuthoredSubjectDraftKind =
  | 'BACKGROUND'
  | 'CLASS'
  | 'CREATURE'
  | 'EQUIPMENT'
  | 'FEAT'
  | 'RACE'
  | 'SPELL'
  | 'VEHICLE'

export type AuthoredSubjectDraftState = 'DRAFT_ONLY' | 'ACTIVE_WITH_DRAFT'

export interface AuthoredSubjectDraft {
  id: string
  subjectKind: AuthoredSubjectDraftKind
  subjectId: string
  userId: string
  systemId: string
  label: string
  status: 'DRAFT'
  payload: Json
  draftState: AuthoredSubjectDraftState
  baseActiveUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveAuthoredSubjectDraftInput {
  subjectKind: AuthoredSubjectDraftKind
  subjectId: string
  userId: string
  systemId: string
  label: string
  payload: Json
  baseActiveUpdatedAt?: string | null
}

interface AuthoredSubjectDraftRow {
  id: string
  subject_kind: AuthoredSubjectDraftKind
  subject_id: string
  user_id: string
  system_id: string
  label: string
  status: 'DRAFT'
  payload: Json
  base_active_updated_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
  active_exists?: boolean | null
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function toNullableIsoString(value: Date | string | null): string | null {
  return value == null ? null : toIsoString(value)
}

function mapDraft(
  row: AuthoredSubjectDraftRow,
  activeExists = row.active_exists ?? false
): AuthoredSubjectDraft {
  return {
    id: row.id,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    userId: row.user_id,
    systemId: row.system_id,
    label: row.label,
    status: row.status,
    payload: row.payload,
    draftState: activeExists ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
    baseActiveUpdatedAt: toNullableIsoString(row.base_active_updated_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function activeExistsProjection() {
  return sql<boolean>`
    case authored_subject_drafts.subject_kind
      when 'BACKGROUND' then exists(
        select 1 from backgrounds where backgrounds.id = authored_subject_drafts.subject_id
      )
      when 'CLASS' then exists(
        select 1 from classes where classes.id = authored_subject_drafts.subject_id
      )
      when 'CREATURE' then exists(
        select 1 from creatures where creatures.id = authored_subject_drafts.subject_id
      )
      when 'EQUIPMENT' then exists(
        select 1 from equipment where equipment.id = authored_subject_drafts.subject_id
      )
      when 'FEAT' then exists(
        select 1 from feats where feats.id = authored_subject_drafts.subject_id
      )
      when 'RACE' then exists(
        select 1 from races where races.id = authored_subject_drafts.subject_id
      )
      when 'SPELL' then exists(
        select 1 from spells where spells.id = authored_subject_drafts.subject_id
      )
      when 'VEHICLE' then exists(
        select 1 from vehicles where vehicles.id = authored_subject_drafts.subject_id
      )
      else false
    end
  `
}

async function activeSubjectExists(
  db: DBLike,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string
): Promise<boolean> {
  const table = getSubjectTableName(subjectKind)
  const result = await sql<{ exists: boolean }>`
    select exists(
      select 1
      from ${sql.table(table)}
      where id = ${subjectId}
    ) as exists
  `.execute(db)

  return result.rows[0]?.exists ?? false
}

function getSubjectTableName(subjectKind: AuthoredSubjectDraftKind): string {
  switch (subjectKind) {
    case 'BACKGROUND':
      return 'backgrounds'
    case 'CLASS':
      return 'classes'
    case 'CREATURE':
      return 'creatures'
    case 'EQUIPMENT':
      return 'equipment'
    case 'FEAT':
      return 'feats'
    case 'RACE':
      return 'races'
    case 'SPELL':
      return 'spells'
    case 'VEHICLE':
      return 'vehicles'
  }
}

export function createAuthoredSubjectDraftRepository(db: DBLike) {
  return {
    async findBySubject(params: {
      subjectKind: AuthoredSubjectDraftKind
      subjectId: string
      userId: string
    }): Promise<AuthoredSubjectDraft | null> {
      const result = await sql<AuthoredSubjectDraftRow>`
        select
          id,
          subject_kind,
          subject_id,
          user_id,
          system_id,
          label,
          status,
          payload,
          base_active_updated_at,
          created_at,
          updated_at,
          ${activeExistsProjection()} as active_exists
        from authored_subject_drafts
        where subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
          and user_id = ${params.userId}
        limit 1
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null

      return mapDraft(row)
    },

    async listByUser(params: {
      userId: string
      subjectKind?: AuthoredSubjectDraftKind
    }): Promise<AuthoredSubjectDraft[]> {
      const result = params.subjectKind == null
        ? await sql<AuthoredSubjectDraftRow>`
          select
            id,
            subject_kind,
            subject_id,
            user_id,
            system_id,
            label,
            status,
            payload,
            base_active_updated_at,
            created_at,
            updated_at,
            ${activeExistsProjection()} as active_exists
          from authored_subject_drafts
          where user_id = ${params.userId}
          order by updated_at desc
        `.execute(db)
        : await sql<AuthoredSubjectDraftRow>`
          select
            id,
            subject_kind,
            subject_id,
            user_id,
            system_id,
            label,
            status,
            payload,
            base_active_updated_at,
            created_at,
            updated_at,
            ${activeExistsProjection()} as active_exists
          from authored_subject_drafts
          where user_id = ${params.userId}
            and subject_kind = ${params.subjectKind}
          order by updated_at desc
        `.execute(db)

      return result.rows.map((row) => mapDraft(row))
    },

    async save(input: SaveAuthoredSubjectDraftInput): Promise<AuthoredSubjectDraft> {
      const payloadJson = JSON.stringify(input.payload)
      const result = await sql<AuthoredSubjectDraftRow>`
        insert into authored_subject_drafts (
          subject_kind,
          subject_id,
          user_id,
          system_id,
          label,
          payload,
          base_active_updated_at
        )
        values (
          ${input.subjectKind},
          ${input.subjectId},
          ${input.userId},
          ${input.systemId},
          ${input.label},
          ${payloadJson}::jsonb,
          ${input.baseActiveUpdatedAt ?? null}
        )
        on conflict (subject_kind, subject_id, user_id)
        do update set
          system_id = excluded.system_id,
          label = excluded.label,
          payload = excluded.payload,
          base_active_updated_at = excluded.base_active_updated_at,
          updated_at = now()
        returning
          id,
          subject_kind,
          subject_id,
          user_id,
          system_id,
          label,
          status,
          payload,
          base_active_updated_at,
          created_at,
          updated_at
      `.execute(db)
      const row = result.rows[0]
      if (!row) {
        throw new Error(`Failed to save ${input.subjectKind} draft "${input.subjectId}".`)
      }

      return mapDraft(
        row,
        await activeSubjectExists(db, input.subjectKind, input.subjectId)
      )
    },

    async delete(params: {
      subjectKind: AuthoredSubjectDraftKind
      subjectId: string
      userId: string
    }): Promise<void> {
      await sql`
        delete from authored_subject_drafts
        where subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
          and user_id = ${params.userId}
      `.execute(db)
    }
  }
}

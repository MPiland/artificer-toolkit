import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { AuthoredSubjectKind } from './authoredContent.js'

export type AuthoredImportSource = 'DND_BEYOND' | 'FOUNDRY_DND5E' | 'ARTIFICER_JSON'
export type AuthoredImportSubjectKind = AuthoredSubjectKind | 'CHARACTER'

export interface AuthoredImportRef {
  userId: string
  source: AuthoredImportSource
  subjectKind: AuthoredImportSubjectKind
  externalId: string
  subjectId: string
  createdAt: string
  updatedAt: string
}

export type UpsertAuthoredImportRefInput = Omit<AuthoredImportRef, 'createdAt' | 'updatedAt'>

interface AuthoredImportRefRow {
  user_id: string
  source: AuthoredImportSource
  subject_kind: AuthoredImportSubjectKind
  external_id: string
  subject_id: string
  created_at: Date | string
  updated_at: Date | string
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function mapImportRef(row: AuthoredImportRefRow): AuthoredImportRef {
  return {
    userId: row.user_id,
    source: row.source,
    subjectKind: row.subject_kind,
    externalId: row.external_id,
    subjectId: row.subject_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

export function createAuthoredImportRefRepository(db: DBLike) {
  return {
    async findByExternalId(params: {
      userId: string
      source: AuthoredImportSource
      subjectKind: AuthoredImportSubjectKind
      externalId: string
    }): Promise<AuthoredImportRef | null> {
      const result = await sql<AuthoredImportRefRow>`
        select
          user_id,
          source,
          subject_kind,
          external_id,
          subject_id,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_import_refs
        where user_id = ${params.userId}
          and source = ${params.source}
          and subject_kind = ${params.subjectKind}
          and external_id = ${params.externalId}
        limit 1
      `.execute(db)
      return result.rows[0] ? mapImportRef(result.rows[0]) : null
    },

    async findByExternalIds(params: {
      userId: string
      source: AuthoredImportSource
      subjectKind: AuthoredImportSubjectKind
      externalIds: readonly string[]
    }): Promise<AuthoredImportRef[]> {
      if (params.externalIds.length === 0) return []
      const result = await sql<AuthoredImportRefRow>`
        select
          user_id,
          source,
          subject_kind,
          external_id,
          subject_id,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_import_refs
        where user_id = ${params.userId}
          and source = ${params.source}
          and subject_kind = ${params.subjectKind}
          and external_id in (${sql.join(params.externalIds)})
      `.execute(db)
      return result.rows.map(mapImportRef)
    },

    async findBySubject(params: {
      userId: string
      subjectKind: AuthoredImportSubjectKind
      subjectId: string
    }): Promise<AuthoredImportRef[]> {
      const result = await sql<AuthoredImportRefRow>`
        select
          user_id,
          source,
          subject_kind,
          external_id,
          subject_id,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_import_refs
        where user_id = ${params.userId}
          and subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
        order by created_at
      `.execute(db)
      return result.rows.map(mapImportRef)
    },

    async upsert(input: UpsertAuthoredImportRefInput): Promise<AuthoredImportRef> {
      const result = await sql<AuthoredImportRefRow>`
        insert into authored_import_refs (
          user_id,
          source,
          subject_kind,
          external_id,
          subject_id
        ) values (
          ${input.userId},
          ${input.source},
          ${input.subjectKind},
          ${input.externalId},
          ${input.subjectId}
        )
        on conflict (user_id, source, subject_kind, external_id) do update
        set subject_id = excluded.subject_id, updated_at = now()
        returning
          user_id,
          source,
          subject_kind,
          external_id,
          subject_id,
          created_at::text as created_at,
          updated_at::text as updated_at
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error(`Failed to save import reference "${input.externalId}".`)
      return mapImportRef(row)
    },

    async delete(params: {
      userId: string
      source: AuthoredImportSource
      subjectKind: AuthoredImportSubjectKind
      externalId: string
    }): Promise<void> {
      await sql`
        delete from authored_import_refs
        where user_id = ${params.userId}
          and source = ${params.source}
          and subject_kind = ${params.subjectKind}
          and external_id = ${params.externalId}
      `.execute(db)
    }
  }
}

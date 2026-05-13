import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { AuthoredSubjectDraftKind } from './authoredSubjectDraft.js'

export type AuthoredRouteSubjectKind = AuthoredSubjectDraftKind | 'CHARACTER'

export interface AuthoredRouteIdentity {
  subjectKind: AuthoredRouteSubjectKind
  subjectId: string
  routeNumber: string
  publicId: string
  createdAt: string
  updatedAt: string
}

interface AuthoredRouteIdentityRow {
  subject_kind: AuthoredRouteSubjectKind
  subject_id: string
  route_number: string | number | bigint
  public_id: string
  created_at: Date | string
  updated_at: Date | string
}

const srdSubjectIdPattern = /^00000000-0000-0000-([0-9a-f]{4})-([0-9a-f]{4})00000000$/i
const srdRouteDomainMultiplier = 100000

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function mapRouteIdentity(row: AuthoredRouteIdentityRow): AuthoredRouteIdentity {
  return {
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    routeNumber: row.route_number.toString(),
    publicId: row.public_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

export function getSrdAuthoredRouteNumber(subjectId: string): number | null {
  const match = srdSubjectIdPattern.exec(subjectId)
  if (!match) return null

  const domainCode = Number.parseInt(match[1] ?? '', 16)
  const subjectIndex = Number.parseInt(match[2] ?? '', 16)
  if (!Number.isSafeInteger(domainCode) || !Number.isSafeInteger(subjectIndex) || domainCode <= 0 || subjectIndex <= 0) {
    return null
  }

  return domainCode * srdRouteDomainMultiplier + subjectIndex
}

function distinctSubjectIds(subjectIds: readonly string[]): string[] {
  return [...new Set(subjectIds.filter(Boolean))]
}

function subjectIdList(subjectIds: readonly string[]) {
  return sql.join(subjectIds.map((subjectId) => sql`${subjectId}::uuid`))
}

async function syncRouteNumberSequence(db: DBLike): Promise<void> {
  await sql`
    do $$
    declare
      max_route_number bigint;
    begin
      select max(route_number) into max_route_number
      from authored_route_ids;

      if max_route_number is null then
        perform setval('public.authored_route_ids_route_number_seq'::regclass, 1, false);
      else
        perform setval('public.authored_route_ids_route_number_seq'::regclass, max_route_number, true);
      end if;
    end;
    $$;
  `.execute(db)
}

export function createAuthoredRouteIdRepository(db: DBLike) {
  return {
    async ensure(params: {
      subjectKind: AuthoredRouteSubjectKind
      subjectId: string
      routeNumber?: number | null
    }): Promise<AuthoredRouteIdentity> {
      const result = params.routeNumber == null
        ? await sql<AuthoredRouteIdentityRow>`
          insert into authored_route_ids (
            subject_kind,
            subject_id
          )
          values (
            ${params.subjectKind},
            ${params.subjectId}
          )
          on conflict (subject_kind, subject_id)
          do update set subject_kind = excluded.subject_kind
          returning
            subject_kind,
            subject_id,
            route_number,
            public_id,
            created_at::text as created_at,
            updated_at::text as updated_at
        `.execute(db)
        : await sql<AuthoredRouteIdentityRow>`
          insert into authored_route_ids (
            subject_kind,
            subject_id,
            route_number
          )
          values (
            ${params.subjectKind},
            ${params.subjectId},
            ${params.routeNumber}
          )
          on conflict (subject_kind, subject_id)
          do update set subject_kind = excluded.subject_kind
          returning
            subject_kind,
            subject_id,
            route_number,
            public_id,
            created_at::text as created_at,
            updated_at::text as updated_at
        `.execute(db)

      const row = result.rows[0]
      if (!row) {
        throw new Error(`Failed to ensure route identity for ${params.subjectKind} "${params.subjectId}".`)
      }

      return mapRouteIdentity(row)
    },

    async ensureMany(
      subjectKind: AuthoredRouteSubjectKind,
      subjectIds: readonly string[]
    ): Promise<Map<string, AuthoredRouteIdentity>> {
      const ids = distinctSubjectIds(subjectIds)
      const identities = await this.findBySubjects(subjectKind, ids)
      const identityBySubjectId = new Map(identities.map((identity) => [identity.subjectId, identity]))

      for (const subjectId of ids) {
        if (identityBySubjectId.has(subjectId)) continue
        const identity = await this.ensure({ subjectKind, subjectId })
        identityBySubjectId.set(subjectId, identity)
      }

      return identityBySubjectId
    },

    async findBySubject(params: {
      subjectKind: AuthoredRouteSubjectKind
      subjectId: string
    }): Promise<AuthoredRouteIdentity | null> {
      const result = await sql<AuthoredRouteIdentityRow>`
        select
          subject_kind,
          subject_id,
          route_number,
          public_id,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_route_ids
        where subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
        limit 1
      `.execute(db)

      return result.rows[0] ? mapRouteIdentity(result.rows[0]) : null
    },

    async findBySubjects(
      subjectKind: AuthoredRouteSubjectKind,
      subjectIds: readonly string[]
    ): Promise<AuthoredRouteIdentity[]> {
      const ids = distinctSubjectIds(subjectIds)
      if (ids.length === 0) return []

      const result = await sql<AuthoredRouteIdentityRow>`
        select
          subject_kind,
          subject_id,
          route_number,
          public_id,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_route_ids
        where subject_kind = ${subjectKind}
          and subject_id in (${subjectIdList(ids)})
      `.execute(db)

      return result.rows.map((row) => mapRouteIdentity(row))
    },

    async resolveByPublicIdForUser(params: {
      subjectKind: AuthoredRouteSubjectKind
      publicId: string
    }): Promise<AuthoredRouteIdentity | null> {
      const result = await sql<AuthoredRouteIdentityRow>`
        select
          subject_kind,
          subject_id,
          route_number,
          public_id,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_route_ids
        where subject_kind = ${params.subjectKind}
          and public_id = ${params.publicId.toLowerCase()}
          and public.can_access_authored_route_id(subject_kind, subject_id)
        limit 1
      `.execute(db)

      return result.rows[0] ? mapRouteIdentity(result.rows[0]) : null
    },

    async resolveBySubjectForUser(params: {
      subjectKind: AuthoredRouteSubjectKind
      subjectId: string
    }): Promise<AuthoredRouteIdentity | null> {
      const result = await sql<AuthoredRouteIdentityRow>`
        select
          subject_kind,
          subject_id,
          route_number,
          public_id,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_route_ids
        where subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
          and public.can_access_authored_route_id(subject_kind, subject_id)
        limit 1
      `.execute(db)

      return result.rows[0] ? mapRouteIdentity(result.rows[0]) : null
    },

    async canAccessSubjectForUser(params: {
      subjectKind: AuthoredRouteSubjectKind
      subjectId: string
    }): Promise<boolean> {
      const result = await sql<{ can_access: boolean }>`
        select public.can_access_authored_route_id(
          ${params.subjectKind},
          ${params.subjectId}::uuid
        ) as can_access
      `.execute(db)

      return result.rows[0]?.can_access ?? false
    },

    async seedSrdSubjects(
      subjects: readonly {
        subjectKind: Exclude<AuthoredRouteSubjectKind, 'CHARACTER'>
        subjectId: string
      }[]
    ): Promise<void> {
      for (const subject of subjects) {
        await this.ensure({
          subjectKind: subject.subjectKind,
          subjectId: subject.subjectId,
          routeNumber: getSrdAuthoredRouteNumber(subject.subjectId)
        })
      }

      await syncRouteNumberSequence(db)
    }
  }
}

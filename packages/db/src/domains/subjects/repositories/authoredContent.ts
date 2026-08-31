import { sql } from 'kysely'
import type { DBLike, Json } from '#types'
import { withTransaction } from '../../../utils/index.js'
import { requireDefaultUserContentSource } from '../../../repositories/contentSources.js'
import {
  createAccountEntitlementsRepository,
  EntitlementLimitError
} from '../../../repositories/accountEntitlements.js'

export type AuthoredSubjectKind =
  | 'BACKGROUND'
  | 'CLASS'
  | 'CREATURE'
  | 'EQUIPMENT'
  | 'FEAT'
  | 'RACE'
  | 'SPELL'
  | 'VEHICLE'

export type AuthoredDraftState = 'DRAFT_ONLY' | 'ACTIVE_WITH_DRAFT'

export interface AuthoredActiveMetadata {
  subjectId: string
  subjectKind: AuthoredSubjectKind
  ownerUserId: string | null
  systemId: string
  contentSourceId: string
  label: string
  isMaster: boolean
  hasDraft: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthoredDraft {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  userId: string
  systemId: string
  contentSourceId: string
  label: string
  status: 'DRAFT'
  payload: Json
  draftState: AuthoredDraftState
  baseActiveUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveAuthoredDraftInput {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  userId: string
  systemId: string
  label: string
  payload: Json
  rootLimit?: number | null
}

interface AuthoredActiveRow {
  subject_id: string
  subject_kind: AuthoredSubjectKind
  owner_user_id: string | null
  system_id: string
  content_source_id: string
  label: string
  is_master: boolean
  has_draft: boolean
  created_at: Date | string
  updated_at: Date | string
}

interface AuthoredActiveRouteRow extends AuthoredActiveRow {
  public_id: string
}

interface AuthoredDraftRow {
  subject_kind: AuthoredSubjectKind
  subject_id: string
  user_id: string
  system_id: string
  content_source_id: string
  label: string
  payload: Json
  base_active_updated_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
  active_updated_at: Date | string | null
}

interface AuthoredDraftRouteRow extends AuthoredDraftRow {
  public_id: string
}

export class AuthoredContentConflictError extends Error {
  constructor(subjectId: string) {
    super(`Authored content "${subjectId}" changed after its draft was created.`)
    this.name = 'AuthoredContentConflictError'
  }
}

export class AuthoredContentCreationRateLimitError extends Error {
  constructor(window: 'minute' | 'hour') {
    super(
      window === 'minute'
        ? 'You can create at most 25 authored records per minute. Try again when the minute resets.'
        : 'You can create at most 100 authored records per hour. Try again when the hour resets.'
    )
    this.name = 'AuthoredContentCreationRateLimitError'
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const tableBySubjectKind = {
  BACKGROUND: 'backgrounds',
  CLASS: 'classes',
  CREATURE: 'creatures',
  EQUIPMENT: 'equipment',
  FEAT: 'feats',
  RACE: 'races',
  SPELL: 'spells',
  VEHICLE: 'vehicles'
} as const satisfies Record<AuthoredSubjectKind, string>

const activeRoots = sql`
  select 'BACKGROUND'::text as subject_kind, id as subject_id, user_id as owner_user_id,
    system_id, content_source_id, label, coalesce(is_master, false) as is_master, created_at, updated_at
  from backgrounds where status = 'ACTIVE'
  union all
  select 'CLASS', id, user_id, system_id, content_source_id, label, coalesce(is_master, false), created_at, updated_at
  from classes where status = 'ACTIVE'
  union all
  select 'CREATURE', id, user_id, system_id, content_source_id, label, coalesce(is_master, false), created_at, updated_at
  from creatures where status = 'ACTIVE'
  union all
  select 'EQUIPMENT', id, user_id, system_id, content_source_id, label, coalesce(is_master, false), created_at, updated_at
  from equipment where status = 'ACTIVE'
  union all
  select 'FEAT', id, user_id, system_id, content_source_id, label, coalesce(is_master, false), created_at, updated_at
  from feats where status = 'ACTIVE'
  union all
  select 'RACE', id, user_id, system_id, content_source_id, label, coalesce(is_master, false), created_at, updated_at
  from races where status = 'ACTIVE'
  union all
  select 'SPELL', id, user_id, system_id, content_source_id, label, coalesce(is_master, false), created_at, updated_at
  from spells where status = 'ACTIVE'
  union all
  select 'VEHICLE', id, user_id, system_id, content_source_id, label, coalesce(is_master, false), created_at, updated_at
  from vehicles where status = 'ACTIVE'
`

function toIsoString(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Invalid authored content timestamp "${String(value)}".`)
  }
  return parsed.toISOString()
}

function toOptionalIsoString(value: Date | string | null): string | null {
  if (value === null) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function mapActive(row: AuthoredActiveRow): AuthoredActiveMetadata {
  return {
    subjectId: row.subject_id,
    subjectKind: row.subject_kind,
    ownerUserId: row.owner_user_id,
    systemId: row.system_id,
    contentSourceId: row.content_source_id,
    label: row.label,
    isMaster: row.is_master,
    hasDraft: row.has_draft,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function mapDraft(row: AuthoredDraftRow): AuthoredDraft {
  return {
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    userId: row.user_id,
    systemId: row.system_id,
    contentSourceId: row.content_source_id,
    label: row.label,
    status: 'DRAFT',
    payload: row.payload,
    draftState: row.active_updated_at ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
    baseActiveUpdatedAt: toOptionalIsoString(row.base_active_updated_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function activeRowForUpdate(db: DBLike, subjectKind: AuthoredSubjectKind, subjectId: string) {
  const table = tableBySubjectKind[subjectKind]
  return sql<AuthoredActiveRow>`
    select
      ${subjectKind}::text as subject_kind,
      root.id as subject_id,
      root.user_id as owner_user_id,
      root.system_id,
      root.content_source_id,
      root.label,
      coalesce(root.is_master, false) as is_master,
      exists (
        select 1 from authored_drafts draft
        where draft.subject_kind = ${subjectKind}
          and draft.subject_id = root.id
      ) as has_draft,
      root.created_at,
      root.updated_at
    from ${sql.table(table)} root
    where root.id = ${subjectId}
      and root.status = 'ACTIVE'
    for update
  `.execute(db)
}

async function consumeCreationAllowance(
  db: DBLike,
  userId: string,
  rootLimit: number | null
): Promise<void> {
  const currentMinute = sql`date_trunc('minute', now() at time zone 'UTC') at time zone 'UTC'`
  const currentHour = sql`date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC'`

  await sql`
    insert into authored_creation_rate_limits (
      user_id,
      minute_window_start,
      minute_count,
      hour_window_start,
      hour_count
    ) values (
      ${userId},
      ${currentMinute},
      0,
      ${currentHour},
      0
    )
    on conflict (user_id) do nothing
  `.execute(db)

  const result = await sql<{ hour_count: number; minute_count: number }>`
    select
      case when minute_window_start = ${currentMinute} then minute_count else 0 end as minute_count,
      case when hour_window_start = ${currentHour} then hour_count else 0 end as hour_count
    from authored_creation_rate_limits
    where user_id = ${userId}
    for update
  `.execute(db)
  const counter = result.rows[0]
  if (!counter) {
    throw new Error(`Failed to lock the authored creation rate limit for user "${userId}".`)
  }
  if (counter.minute_count >= 25) throw new AuthoredContentCreationRateLimitError('minute')
  if (counter.hour_count >= 100) throw new AuthoredContentCreationRateLimitError('hour')
  if (
    rootLimit !== null &&
    (await createAccountEntitlementsRepository(db).countHomebrewRoots(userId)) >= rootLimit
  ) {
    throw new EntitlementLimitError('homebrewRoots')
  }

  await sql`
    update authored_creation_rate_limits
    set
      minute_window_start = ${currentMinute},
      minute_count = ${counter.minute_count + 1},
      hour_window_start = ${currentHour},
      hour_count = ${counter.hour_count + 1}
    where user_id = ${userId}
  `.execute(db)
}

async function findDraftBySubject(
  db: DBLike,
  params: { subjectKind: AuthoredSubjectKind; subjectId: string; userId: string }
): Promise<AuthoredDraft | null> {
  const result = await sql<AuthoredDraftRow>`
    with active as (${activeRoots})
    select
      draft.subject_kind,
      draft.subject_id,
      draft.user_id,
      draft.system_id,
      draft.content_source_id,
      draft.label,
      draft.payload,
      draft.base_active_updated_at::text,
      draft.created_at,
      draft.updated_at,
      active.updated_at as active_updated_at
    from authored_drafts draft
    left join active
      on active.subject_kind = draft.subject_kind
      and active.subject_id = draft.subject_id
    where draft.subject_kind = ${params.subjectKind}
      and draft.subject_id = ${params.subjectId}
      and draft.user_id = ${params.userId}
    limit 1
  `.execute(db)

  return result.rows[0] ? mapDraft(result.rows[0]) : null
}

async function saveDraft(db: DBLike, input: SaveAuthoredDraftInput): Promise<AuthoredDraft> {
  return withTransaction(db, async (trx) => {
    await sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`${input.subjectKind}:${input.subjectId}`}, 0)
      )
    `.execute(trx)

    const existingDraftResult = await sql<AuthoredDraftRow>`
      select
        subject_kind,
        subject_id,
        user_id,
        system_id,
        content_source_id,
        label,
        payload,
        base_active_updated_at::text,
        created_at,
        updated_at,
        null::timestamptz as active_updated_at
      from authored_drafts
      where subject_kind = ${input.subjectKind}
        and subject_id = ${input.subjectId}
      for update
    `.execute(trx)

    const existingDraft = existingDraftResult.rows[0]
    const activeResult = await activeRowForUpdate(trx, input.subjectKind, input.subjectId)
    const active = activeResult.rows[0]
    const contentSourceId = await requireDefaultUserContentSource(trx, input.systemId, input.userId)

    if (existingDraft && existingDraft.user_id !== input.userId) {
      throw new Error(`Authored draft "${input.subjectId}" is not writable by this owner.`)
    }
    if (existingDraft && existingDraft.system_id !== input.systemId) {
      throw new Error(`Authored draft "${input.subjectId}" cannot change rules system.`)
    }
    if (active && (active.is_master || active.owner_user_id !== input.userId)) {
      throw new Error(`Active authored content "${input.subjectId}" is not writable by this owner.`)
    }
    if (active && active.system_id !== input.systemId) {
      throw new Error(`Active authored content "${input.subjectId}" cannot change rules system.`)
    }
    if (existingDraft && existingDraft.content_source_id !== contentSourceId) {
      throw new Error(`Authored draft "${input.subjectId}" cannot change Content Source.`)
    }
    if (active && active.content_source_id !== contentSourceId) {
      throw new Error(`Active authored content "${input.subjectId}" cannot change Content Source.`)
    }

    if (!existingDraft && !active) {
      await consumeCreationAllowance(trx, input.userId, input.rootLimit ?? null)
    }

    const baseActiveUpdatedAt = active
      ? sql`(
          select root.updated_at
          from ${sql.table(tableBySubjectKind[input.subjectKind])} root
          where root.id = ${input.subjectId}
            and root.status = 'ACTIVE'
        )`
      : sql`null::timestamptz`

    await sql`
      insert into authored_drafts (
        subject_kind,
        subject_id,
        user_id,
        system_id,
        content_source_id,
        label,
        payload,
        base_active_updated_at
      ) values (
        ${input.subjectKind},
        ${input.subjectId},
        ${input.userId},
        ${input.systemId},
        ${contentSourceId},
        ${input.label},
        ${JSON.stringify(input.payload)}::jsonb,
        ${baseActiveUpdatedAt}
      )
      on conflict (subject_kind, subject_id) do update
      set
        label = excluded.label,
        payload = excluded.payload,
        updated_at = now()
      where authored_drafts.user_id = excluded.user_id
        and authored_drafts.system_id = excluded.system_id
        and authored_drafts.content_source_id = excluded.content_source_id
    `.execute(trx)

    const saved = await findDraftBySubject(trx, {
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      userId: input.userId
    })
    if (!saved) throw new Error(`Failed to load authored draft "${input.subjectId}" after saving.`)
    return saved
  })
}

export function createAuthoredContentRepository(db: DBLike) {
  return {
    async lockActiveBySubject(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<AuthoredActiveMetadata | null> {
      const result = await activeRowForUpdate(db, params.subjectKind, params.subjectId)
      const row = result.rows[0]
      return row ? mapActive(row) : null
    },

    async findActiveBySubject(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<AuthoredActiveMetadata | null> {
      const result = await sql<AuthoredActiveRow>`
        with active as (${activeRoots})
        select
          active.*,
          exists (
            select 1 from authored_drafts draft
            where draft.subject_kind = active.subject_kind
              and draft.subject_id = active.subject_id
          ) as has_draft
        from active
        where active.subject_kind = ${params.subjectKind}
          and active.subject_id = ${params.subjectId}
        limit 1
      `.execute(db)
      return result.rows[0] ? mapActive(result.rows[0]) : null
    },

    async findActiveBySubjects(params: {
      subjectKind: AuthoredSubjectKind
      subjectIds: readonly string[]
    }): Promise<AuthoredActiveMetadata[]> {
      if (params.subjectIds.length === 0) return []
      const result = await sql<AuthoredActiveRow>`
        with active as (${activeRoots})
        select
          active.*,
          exists (
            select 1 from authored_drafts draft
            where draft.subject_kind = active.subject_kind
              and draft.subject_id = active.subject_id
          ) as has_draft
        from active
        where active.subject_kind = ${params.subjectKind}
          and active.subject_id in (${sql.join(params.subjectIds.map((id) => sql`${id}::uuid`))})
      `.execute(db)
      return result.rows.map(mapActive)
    },

    async findActiveMastersBySubjectKind(params: {
      subjectKind: AuthoredSubjectKind
    }): Promise<AuthoredActiveMetadata[]> {
      const result = await sql<AuthoredActiveRow>`
        with active as (${activeRoots})
        select
          active.*,
          false as has_draft
        from active
        where active.subject_kind = ${params.subjectKind}
          and active.is_master = true
      `.execute(db)
      return result.rows.map(mapActive)
    },

    async findActiveByRoute(params: {
      subjectKind: AuthoredSubjectKind
      routeId: string
      userId: string
    }): Promise<(AuthoredActiveMetadata & { publicId: string }) | null> {
      const routePredicate = uuidPattern.test(params.routeId)
        ? sql`route.subject_id = ${params.routeId.toLowerCase()}::uuid`
        : sql`route.public_id = ${params.routeId.toLowerCase()}`
      const result = await sql<AuthoredActiveRouteRow>`
        with active as (${activeRoots})
        select
          active.*,
          route.public_id,
          exists (
            select 1 from authored_drafts draft
            where draft.subject_kind = active.subject_kind
              and draft.subject_id = active.subject_id
          ) as has_draft
        from authored_route_ids route
        join active
          on active.subject_kind = route.subject_kind
          and active.subject_id = route.subject_id
        where route.subject_kind = ${params.subjectKind}
          and ${routePredicate}
          and public.can_access_authored_route_id(route.subject_kind, route.subject_id)
        limit 1
      `.execute(db)
      const row = result.rows[0]
      return row ? { ...mapActive(row), publicId: row.public_id } : null
    },

    findDraftBySubject(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
    }): Promise<AuthoredDraft | null> {
      return findDraftBySubject(db, params)
    },

    async findDraftByRoute(params: {
      subjectKind: AuthoredSubjectKind
      routeId: string
      userId: string
    }): Promise<(AuthoredDraft & { publicId: string }) | null> {
      const routePredicate = uuidPattern.test(params.routeId)
        ? sql`route.subject_id = ${params.routeId.toLowerCase()}::uuid`
        : sql`route.public_id = ${params.routeId.toLowerCase()}`
      const result = await sql<AuthoredDraftRouteRow>`
        with active as (${activeRoots})
        select
          draft.subject_kind,
          draft.subject_id,
          draft.user_id,
          draft.system_id,
          draft.content_source_id,
          draft.label,
          draft.payload,
          draft.base_active_updated_at::text,
          draft.created_at,
          draft.updated_at,
          active.updated_at as active_updated_at,
          route.public_id
        from authored_route_ids route
        join authored_drafts draft
          on draft.subject_kind = route.subject_kind
          and draft.subject_id = route.subject_id
        left join active
          on active.subject_kind = draft.subject_kind
          and active.subject_id = draft.subject_id
        where route.subject_kind = ${params.subjectKind}
          and ${routePredicate}
          and draft.user_id = ${params.userId}
          and public.can_access_authored_route_id(route.subject_kind, route.subject_id)
        limit 1
      `.execute(db)
      const row = result.rows[0]
      return row ? { ...mapDraft(row), publicId: row.public_id } : null
    },

    async listDraftsByUser(params: {
      userId: string
      subjectKind?: AuthoredSubjectKind
    }): Promise<AuthoredDraft[]> {
      const kindPredicate = params.subjectKind
        ? sql`and draft.subject_kind = ${params.subjectKind}`
        : sql``
      const result = await sql<AuthoredDraftRow>`
        with active as (${activeRoots})
        select
          draft.subject_kind,
          draft.subject_id,
          draft.user_id,
          draft.system_id,
          draft.content_source_id,
          draft.label,
          draft.payload,
          draft.base_active_updated_at::text,
          draft.created_at,
          draft.updated_at,
          active.updated_at as active_updated_at
        from authored_drafts draft
        left join active
          on active.subject_kind = draft.subject_kind
          and active.subject_id = draft.subject_id
        where draft.user_id = ${params.userId}
          ${kindPredicate}
        order by draft.updated_at desc
      `.execute(db)
      return result.rows.map(mapDraft)
    },

    saveDraft(input: SaveAuthoredDraftInput): Promise<AuthoredDraft> {
      return saveDraft(db, input)
    },

    async lockDraftForActivation(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
    }): Promise<AuthoredDraft> {
      const draftResult = await sql<AuthoredDraftRow>`
        select
          subject_kind,
          subject_id,
          user_id,
          system_id,
          content_source_id,
          label,
          payload,
          base_active_updated_at::text,
          created_at,
          updated_at,
          null::timestamptz as active_updated_at
        from authored_drafts
        where subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
          and user_id = ${params.userId}
        for update
      `.execute(db)
      const row = draftResult.rows[0]
      if (!row) throw new AuthoredContentConflictError(params.subjectId)

      const activeResult = await activeRowForUpdate(db, params.subjectKind, params.subjectId)
      const active = activeResult.rows[0]
      const freshnessResult = await sql<{ is_current: boolean }>`
        select draft.base_active_updated_at is not distinct from (
          select root.updated_at
          from ${sql.table(tableBySubjectKind[params.subjectKind])} root
          where root.id = draft.subject_id
            and root.status = 'ACTIVE'
        ) as is_current
        from authored_drafts draft
        where draft.subject_kind = ${params.subjectKind}
          and draft.subject_id = ${params.subjectId}
          and draft.user_id = ${params.userId}
      `.execute(db)
      if (!freshnessResult.rows[0]?.is_current) {
        throw new AuthoredContentConflictError(params.subjectId)
      }

      return mapDraft({ ...row, active_updated_at: active?.updated_at ?? null })
    },

    async deleteDraft(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
    }): Promise<void> {
      await sql`
        delete from authored_drafts
        where subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
          and user_id = ${params.userId}
      `.execute(db)
    },

    async clearDraftBaseAfterActiveDelete(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
    }): Promise<void> {
      await sql`
        update authored_drafts
        set base_active_updated_at = null, updated_at = now()
        where subject_kind = ${params.subjectKind}
          and subject_id = ${params.subjectId}
          and user_id = ${params.userId}
      `.execute(db)
    }
  }
}

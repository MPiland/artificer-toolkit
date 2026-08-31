import { sql, type RawBuilder } from 'kysely'

import type { DBLike } from '#types'
import type { AuthoredSubjectKind } from './authoredContent.js'

export type AuthoredCatalogCursorValue = number | string

export interface AuthoredCatalogCursor {
  id: string
  values: AuthoredCatalogCursorValue[]
}

export interface AuthoredCatalogPageInput {
  category?: string
  classId?: string
  cursor?: AuthoredCatalogCursor
  direction: 'BACKWARD' | 'FORWARD'
  level?: number
  limit: number
  magicSchoolId?: string
  query?: string
  sort: 'category' | 'level' | 'name' | 'school'
  source?: 'MASTER' | 'OWNED'
}

export interface AuthoredCatalogEnvelope {
  activeUpdatedAt: string
  castingTimeAmount?: number
  castingTimeUnit?: string
  category?: string
  classIds?: string[]
  classLabels?: string[]
  description: string | null
  id: string
  isMaster: boolean
  label: string
  level?: number
  magicSchoolId?: string | null
  magicSchoolLabel?: string | null
  ownerUserId: string | null
  parentClassId?: string | null
  parentClassLabel?: string | null
  parentRaceId?: string | null
  parentRaceLabel?: string | null
  publicId: string
  selectionMode?: string | null
  status: 'ACTIVE'
  systemId: string
  userId: string
}

export interface AuthoredCatalogPage {
  items: AuthoredCatalogEnvelope[]
  meta: Record<string, unknown>
  page: {
    nextCursor: AuthoredCatalogCursor | null
    previousCursor: AuthoredCatalogCursor | null
    totalCount: number
  }
  summary: {
    activeCount: number
    masterCount: number
    ownedCount: number
  }
}

export class AuthoredCatalogProjectionUnavailableError extends Error {
  constructor(spellId: string) {
    super(`Spell catalogue index is unavailable or stale for ${spellId}.`)
    this.name = 'AuthoredCatalogProjectionUnavailableError'
  }
}

export async function syncSpellCatalogClassIndex(
  db: DBLike,
  input: { authoredVersionId: string; classIds: readonly string[]; spellId: string }
): Promise<void> {
  await sql`
    delete from public.spell_catalog_classes
    where spell_id = ${input.spellId}::uuid
  `.execute(db)
  if (input.classIds.length > 0) {
    await sql`
      insert into public.spell_catalog_classes (spell_id, authored_version_id, class_id)
      select
        ${input.spellId}::uuid,
        ${input.authoredVersionId}::uuid,
        class_id::uuid
      from jsonb_array_elements_text(${JSON.stringify([...new Set(input.classIds)])}::jsonb) as class_values(class_id)
    `.execute(db)
  }
  await sql`
    insert into public.spell_catalog_index_versions (spell_id, authored_version_id)
    values (${input.spellId}::uuid, ${input.authoredVersionId}::uuid)
    on conflict (spell_id) do update
      set authored_version_id = excluded.authored_version_id
  `.execute(db)
}

interface AuthoredCatalogRow {
  active_updated_at: string
  casting_time_amount: number | null
  casting_time_unit: string | null
  category: string | null
  class_ids: unknown
  class_labels: unknown
  cursor_values: unknown
  description: string | null
  id: string
  is_master: boolean
  label: string
  level: number | null
  magic_school_id: string | null
  magic_school_label: string | null
  owner_user_id: string | null
  parent_class_id: string | null
  parent_class_label: string | null
  parent_race_id: string | null
  parent_race_label: string | null
  public_id: string
  selection_mode: string | null
  system_id: string
}

interface AuthoredCatalogCountRow {
  active_count: number | string
  master_count: number | string
}

interface CatalogDomainConfig {
  fields: RawBuilder<unknown>
  joins: RawBuilder<unknown>
  rootTable:
    | 'backgrounds'
    | 'classes'
    | 'creatures'
    | 'equipment'
    | 'feats'
    | 'races'
    | 'spells'
    | 'vehicles'
  supportedSorts: readonly AuthoredCatalogPageInput['sort'][]
}

function catalogDomainConfig(subjectKind: AuthoredSubjectKind): CatalogDomainConfig {
  switch (subjectKind) {
    case 'BACKGROUND':
      return {
        fields: sql`
          null::text as category,
          null::text as parent_class_id,
          null::text as parent_class_label,
          null::text as parent_race_id,
          null::text as parent_race_label,
          null::text as selection_mode,
          null::integer as level,
          null::text as magic_school_id,
          null::text as magic_school_label,
          null::text as casting_time_unit,
          null::integer as casting_time_amount,
          '[]'::jsonb as class_ids,
          '[]'::jsonb as class_labels
        `,
        joins: sql``,
        rootTable: 'backgrounds',
        supportedSorts: ['name']
      }
    case 'CLASS':
      return {
        fields: sql`
          root.category::text as category,
          root.parent_class_id::text as parent_class_id,
          parent.label as parent_class_label,
          null::text as parent_race_id,
          null::text as parent_race_label,
          null::text as selection_mode,
          null::integer as level,
          null::text as magic_school_id,
          null::text as magic_school_label,
          null::text as casting_time_unit,
          null::integer as casting_time_amount,
          '[]'::jsonb as class_ids,
          '[]'::jsonb as class_labels
        `,
        joins: sql`left join public.classes parent on parent.id = root.parent_class_id`,
        rootTable: 'classes',
        supportedSorts: ['name', 'category']
      }
    case 'CREATURE':
      return {
        fields: sql`
          root.category::text as category,
          null::text as parent_class_id,
          null::text as parent_class_label,
          null::text as parent_race_id,
          null::text as parent_race_label,
          null::text as selection_mode,
          null::integer as level,
          null::text as magic_school_id,
          null::text as magic_school_label,
          null::text as casting_time_unit,
          null::integer as casting_time_amount,
          '[]'::jsonb as class_ids,
          '[]'::jsonb as class_labels
        `,
        joins: sql``,
        rootTable: 'creatures',
        supportedSorts: ['name', 'category']
      }
    case 'EQUIPMENT':
      return {
        fields: sql`
          root.category::text as category,
          null::text as parent_class_id,
          null::text as parent_class_label,
          null::text as parent_race_id,
          null::text as parent_race_label,
          null::text as selection_mode,
          null::integer as level,
          null::text as magic_school_id,
          null::text as magic_school_label,
          null::text as casting_time_unit,
          null::integer as casting_time_amount,
          '[]'::jsonb as class_ids,
          '[]'::jsonb as class_labels
        `,
        joins: sql``,
        rootTable: 'equipment',
        supportedSorts: ['name', 'category']
      }
    case 'FEAT':
      return {
        fields: sql`
          null::text as category,
          null::text as parent_class_id,
          null::text as parent_class_label,
          null::text as parent_race_id,
          null::text as parent_race_label,
          null::text as selection_mode,
          null::integer as level,
          null::text as magic_school_id,
          null::text as magic_school_label,
          null::text as casting_time_unit,
          null::integer as casting_time_amount,
          '[]'::jsonb as class_ids,
          '[]'::jsonb as class_labels
        `,
        joins: sql``,
        rootTable: 'feats',
        supportedSorts: ['name']
      }
    case 'RACE':
      return {
        fields: sql`
          root.category::text as category,
          null::text as parent_class_id,
          null::text as parent_class_label,
          root.parent_race_id::text as parent_race_id,
          parent.label as parent_race_label,
          root.selection_mode::text as selection_mode,
          null::integer as level,
          null::text as magic_school_id,
          null::text as magic_school_label,
          null::text as casting_time_unit,
          null::integer as casting_time_amount,
          '[]'::jsonb as class_ids,
          '[]'::jsonb as class_labels
        `,
        joins: sql`left join public.races parent on parent.id = root.parent_race_id`,
        rootTable: 'races',
        supportedSorts: ['name', 'category']
      }
    case 'SPELL':
      return {
        fields: sql`
          null::text as category,
          null::text as parent_class_id,
          null::text as parent_class_label,
          null::text as parent_race_id,
          null::text as parent_race_label,
          null::text as selection_mode,
          root.level as level,
          root.magic_school_id::text as magic_school_id,
          school.label as magic_school_label,
          root.casting_time_unit::text as casting_time_unit,
          root.casting_time_amount as casting_time_amount,
          coalesce((
            select jsonb_agg(spell_class.class_id::text order by class_reference.label, spell_class.class_id)
            from public.spell_catalog_classes spell_class
            inner join public.classes class_reference on class_reference.id = spell_class.class_id
            where spell_class.spell_id = root.id
              and spell_class.authored_version_id = root.active_version_id
          ), '[]'::jsonb) as class_ids,
          coalesce((
            select jsonb_agg(class_reference.label order by class_reference.label, spell_class.class_id)
            from public.spell_catalog_classes spell_class
            inner join public.classes class_reference on class_reference.id = spell_class.class_id
            where spell_class.spell_id = root.id
              and spell_class.authored_version_id = root.active_version_id
          ), '[]'::jsonb) as class_labels
        `,
        joins: sql`left join public.magic_schools school on school.id = root.magic_school_id`,
        rootTable: 'spells',
        supportedSorts: ['name', 'level', 'school']
      }
    case 'VEHICLE':
      return {
        fields: sql`
          root.category::text as category,
          null::text as parent_class_id,
          null::text as parent_class_label,
          null::text as parent_race_id,
          null::text as parent_race_label,
          null::text as selection_mode,
          null::integer as level,
          null::text as magic_school_id,
          null::text as magic_school_label,
          null::text as casting_time_unit,
          null::integer as casting_time_amount,
          '[]'::jsonb as class_ids,
          '[]'::jsonb as class_labels
        `,
        joins: sql``,
        rootTable: 'vehicles',
        supportedSorts: ['name', 'category']
      }
  }
}

function asCount(value: number | string) {
  const count = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid authored catalog count "${String(value)}".`)
  }
  return count
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`Authored catalog ${field} must be a string array.`)
  }
  return value
}

function asCursorValues(value: unknown): AuthoredCatalogCursorValue[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 4 ||
    !value.every(
      (entry) =>
        typeof entry === 'string' || (typeof entry === 'number' && Number.isSafeInteger(entry))
    )
  ) {
    throw new Error('Authored catalog cursor values are invalid.')
  }
  return value
}

function mapRow(row: AuthoredCatalogRow): AuthoredCatalogEnvelope {
  const userId = row.is_master ? 'master' : row.owner_user_id
  if (!userId) {
    throw new Error(`Owned authored catalogue entry ${row.id} has no owner.`)
  }

  return {
    activeUpdatedAt: row.active_updated_at,
    ...(row.casting_time_amount === null ? {} : { castingTimeAmount: row.casting_time_amount }),
    ...(row.casting_time_unit === null ? {} : { castingTimeUnit: row.casting_time_unit }),
    ...(row.category === null ? {} : { category: row.category }),
    ...(row.class_ids === undefined ? {} : { classIds: asStringArray(row.class_ids, 'class ids') }),
    ...(row.class_labels === undefined
      ? {}
      : { classLabels: asStringArray(row.class_labels, 'class labels') }),
    description: row.description,
    id: row.id,
    isMaster: row.is_master,
    label: row.label,
    ...(row.level === null ? {} : { level: row.level }),
    magicSchoolId: row.magic_school_id,
    magicSchoolLabel: row.magic_school_label,
    ownerUserId: row.owner_user_id,
    parentClassId: row.parent_class_id,
    parentClassLabel: row.parent_class_label,
    parentRaceId: row.parent_race_id,
    parentRaceLabel: row.parent_race_label,
    publicId: row.public_id,
    selectionMode: row.selection_mode,
    status: 'ACTIVE',
    systemId: row.system_id,
    userId
  }
}

function cursorForRow(row: AuthoredCatalogRow): AuthoredCatalogCursor {
  return { id: row.id, values: asCursorValues(row.cursor_values) }
}

function baseWhere(userId: string): RawBuilder<unknown>[] {
  return [
    sql`root.status = 'ACTIVE'`,
    sql`root.active_version_id is not null`,
    sql`(coalesce(root.is_master, false) = true or root.user_id = ${userId}::uuid)`
  ]
}

async function assertSpellCatalogProjectionCurrent(
  db: DBLike,
  input: Pick<AuthoredCatalogPageInput, 'source'> & { userId: string }
): Promise<void> {
  const conditions = baseWhere(input.userId)
  if (input.source === 'MASTER') {
    conditions.push(sql`coalesce(root.is_master, false) = true`)
  }
  if (input.source === 'OWNED') {
    conditions.push(sql`coalesce(root.is_master, false) = false`)
  }
  const result = await sql<{ id: string }>`
    select root.id::text as id
    from public.spells root
    where ${sql.join(conditions, sql` and `)}
      and not exists (
        select 1
        from public.spell_catalog_index_versions catalog_index
        where catalog_index.spell_id = root.id
          and catalog_index.authored_version_id = root.active_version_id
      )
    limit 1
  `.execute(db)
  const stale = result.rows[0]
  if (stale) throw new AuthoredCatalogProjectionUnavailableError(stale.id)
}

function filteredWhere(input: {
  request: AuthoredCatalogPageInput
  subjectKind: AuthoredSubjectKind
  userId: string
}): RawBuilder<unknown>[] {
  const conditions = baseWhere(input.userId)
  if (input.request.source === 'MASTER') {
    conditions.push(sql`coalesce(root.is_master, false) = true`)
  }
  if (input.request.source === 'OWNED') {
    conditions.push(sql`coalesce(root.is_master, false) = false`)
  }
  if (input.request.category) {
    if (!['CLASS', 'CREATURE', 'EQUIPMENT', 'RACE', 'VEHICLE'].includes(input.subjectKind)) {
      throw new Error(`${input.subjectKind} does not support category catalog filtering.`)
    }
    conditions.push(sql`root.category = ${input.request.category}`)
  }
  if (input.request.level !== undefined) {
    if (input.subjectKind !== 'SPELL') {
      throw new Error(`${input.subjectKind} does not support level catalog filtering.`)
    }
    conditions.push(sql`root.level = ${input.request.level}`)
  }
  if (input.request.magicSchoolId) {
    if (input.subjectKind !== 'SPELL') {
      throw new Error(`${input.subjectKind} does not support school catalog filtering.`)
    }
    conditions.push(sql`root.magic_school_id = ${input.request.magicSchoolId}::uuid`)
  }
  if (input.request.classId) {
    if (input.subjectKind !== 'SPELL') {
      throw new Error(`${input.subjectKind} does not support class catalog filtering.`)
    }
    conditions.push(sql`
      exists (
            select 1
            from public.spell_catalog_classes spell_class
            where spell_class.spell_id = root.id
              and spell_class.authored_version_id = root.active_version_id
              and spell_class.class_id = ${input.request.classId}::uuid
      )
    `)
  }
  if (input.request.query) {
    const pattern = `%${input.request.query}%`
    const searchFields = [
      sql`root.label ilike ${pattern}`,
      sql`coalesce(root.description, '') ilike ${pattern}`
    ]
    if (['CLASS', 'CREATURE', 'EQUIPMENT', 'RACE', 'VEHICLE'].includes(input.subjectKind)) {
      searchFields.push(sql`coalesce(root.category, '') ilike ${pattern}`)
    }
    if (input.subjectKind === 'SPELL') {
      searchFields.push(
        sql`coalesce(school.label, '') ilike ${pattern}`,
        sql`
          exists (
            select 1
            from public.spell_catalog_classes spell_class
            inner join public.classes class_reference on class_reference.id = spell_class.class_id
            where spell_class.spell_id = root.id
              and spell_class.authored_version_id = root.active_version_id
              and class_reference.label ilike ${pattern}
          )
        `
      )
    }
    conditions.push(sql`(${sql.join(searchFields, sql` or `)})`)
  }
  return conditions
}

function sortExpressions(
  subjectKind: AuthoredSubjectKind,
  sort: AuthoredCatalogPageInput['sort']
): RawBuilder<unknown>[] {
  switch (sort) {
    case 'name':
      if (subjectKind === 'CLASS') {
        return [
          sql`lower(coalesce(parent.label, root.label))`,
          sql`case when root.parent_class_id is null then 0 else 1 end`,
          sql`lower(root.label)`
        ]
      }
      if (subjectKind === 'RACE') {
        return [
          sql`lower(coalesce(parent.label, root.label))`,
          sql`case when root.parent_race_id is null then 0 else 1 end`,
          sql`lower(root.label)`
        ]
      }
      return [sql`lower(root.label)`]
    case 'category':
      return [sql`coalesce(root.category, '')`, sql`lower(root.label)`]
    case 'level':
      return [sql`root.level`, sql`lower(root.label)`]
    case 'school':
      return [sql`lower(coalesce(school.label, ''))`, sql`lower(root.label)`]
  }
}

function keysetCondition(
  expressions: readonly RawBuilder<unknown>[],
  cursor: AuthoredCatalogCursor,
  direction: AuthoredCatalogPageInput['direction']
): RawBuilder<unknown> {
  if (cursor.values.length !== expressions.length) {
    throw new Error('Authored catalog cursor does not match the requested sort.')
  }
  const operator = direction === 'FORWARD' ? '>' : '<'
  const branches = expressions.map((expression, index) => {
    const prefix = expressions
      .slice(0, index)
      .map((previous, previousIndex) => sql`${previous} = ${cursor.values[previousIndex]}`)
    const comparison =
      operator === '>'
        ? sql`${expression} > ${cursor.values[index]}`
        : sql`${expression} < ${cursor.values[index]}`
    return sql`(${sql.join([...prefix, comparison], sql` and `)})`
  })
  const equals = expressions.map(
    (expression, index) => sql`${expression} = ${cursor.values[index]}`
  )
  const idComparison =
    operator === '>' ? sql`root.id > ${cursor.id}::uuid` : sql`root.id < ${cursor.id}::uuid`
  branches.push(sql`(${sql.join([...equals, idComparison], sql` and `)})`)
  return sql`(${sql.join(branches, sql` or `)})`
}

function orderBy(expressions: readonly RawBuilder<unknown>[], direction: 'asc' | 'desc') {
  return sql.join(
    [...expressions, sql`root.id`].map((expression) =>
      direction === 'asc' ? sql`${expression} asc` : sql`${expression} desc`
    ),
    sql`, `
  )
}

async function loadMeta(
  db: DBLike,
  config: CatalogDomainConfig,
  subjectKind: AuthoredSubjectKind,
  userId: string
) {
  const conditions = baseWhere(userId)
  if (subjectKind === 'SPELL') {
    const [classes, levels, schools] = await Promise.all([
      sql<{ id: string; label: string }>`
        select distinct class_reference.id::text as id, class_reference.label
        from public.spells root
        inner join public.spell_catalog_classes spell_class on spell_class.spell_id = root.id
          and spell_class.authored_version_id = root.active_version_id
        inner join public.classes class_reference on class_reference.id = spell_class.class_id
        where ${sql.join(
          conditions.map((condition) => sql`${condition}`),
          sql` and `
        )}
        order by class_reference.label, class_reference.id
      `.execute(db),
      sql<{ id: number }>`
        select distinct root.level as id
        from public.spells root
        left join public.magic_schools school on school.id = root.magic_school_id
        where ${sql.join(conditions, sql` and `)}
        order by root.level
      `.execute(db),
      sql<{ id: string; label: string }>`
        select distinct school.id::text as id, school.label
        from public.spells root
        inner join public.magic_schools school on school.id = root.magic_school_id
        where ${sql.join(conditions, sql` and `)}
        order by school.label, school.id
      `.execute(db)
    ])
    return {
      classes: classes.rows.map((row) => ({ id: row.id, label: row.label })),
      levels: levels.rows.map((row) => ({ id: row.id })),
      schools: schools.rows.map((row) => ({ id: row.id, label: row.label }))
    }
  }
  if (!['CLASS', 'CREATURE', 'EQUIPMENT', 'RACE', 'VEHICLE'].includes(subjectKind)) {
    return {}
  }
  const categories = await sql<{ id: string }>`
    select distinct root.category as id
    from ${sql.table(config.rootTable)} root
    where ${sql.join(conditions, sql` and `)}
      and root.category is not null
    order by root.category
  `.execute(db)
  return { categories: categories.rows.map((row) => ({ id: row.id })) }
}

export async function getAuthoredCatalogPage(
  db: DBLike,
  input: {
    request: AuthoredCatalogPageInput
    subjectKind: AuthoredSubjectKind
    userId: string
  }
): Promise<AuthoredCatalogPage> {
  const config = catalogDomainConfig(input.subjectKind)
  if (!config.supportedSorts.includes(input.request.sort)) {
    throw new Error(`${input.subjectKind} does not support ${input.request.sort} catalog sorting.`)
  }
  if (input.subjectKind === 'SPELL') {
    await assertSpellCatalogProjectionCurrent(db, {
      source: input.request.source,
      userId: input.userId
    })
  }
  const expressions = sortExpressions(input.subjectKind, input.request.sort)
  const conditions = filteredWhere(input)
  if (input.request.cursor) {
    conditions.push(keysetCondition(expressions, input.request.cursor, input.request.direction))
  }
  const requestedDirection = input.request.direction === 'FORWARD' ? 'asc' : 'desc'
  const rows = await sql<AuthoredCatalogRow>`
    select
      root.id::text as id,
      route.public_id,
      root.label,
      root.description,
      root.system_id::text,
      coalesce(root.is_master, false) as is_master,
      root.user_id::text as owner_user_id,
      root.updated_at::text as active_updated_at,
      ${config.fields},
      jsonb_build_array(${sql.join(expressions, sql`, `)}) as cursor_values
    from ${sql.table(config.rootTable)} root
    ${config.joins}
    inner join public.authored_route_ids route
      on route.subject_kind = ${input.subjectKind}
      and route.subject_id = root.id
    where ${sql.join(conditions, sql` and `)}
    order by ${orderBy(expressions, requestedDirection)}
    limit ${input.request.limit + 1}
  `.execute(db)
  const hasExtra = rows.rows.length > input.request.limit
  const pageRows =
    input.request.direction === 'FORWARD'
      ? rows.rows.slice(0, input.request.limit)
      : rows.rows.slice(0, input.request.limit).reverse()
  const [summaryResult, totalResult, meta] = await Promise.all([
    sql<AuthoredCatalogCountRow>`
      select
        count(*)::integer as active_count,
        count(*) filter (where coalesce(root.is_master, false))::integer as master_count
      from ${sql.table(config.rootTable)} root
      where ${sql.join(baseWhere(input.userId), sql` and `)}
    `.execute(db),
    sql<{ total_count: number | string }>`
      select count(*)::integer as total_count
      from ${sql.table(config.rootTable)} root
      ${config.joins}
      where ${sql.join(filteredWhere(input), sql` and `)}
    `.execute(db),
    loadMeta(db, config, input.subjectKind, input.userId)
  ])
  const summaryRow = summaryResult.rows[0]
  const totalRow = totalResult.rows[0]
  if (!summaryRow || !totalRow) {
    throw new Error(`Unable to count ${input.subjectKind} catalog roots.`)
  }
  const activeCount = asCount(summaryRow.active_count)
  const masterCount = asCount(summaryRow.master_count)
  const firstRow = pageRows[0]
  const lastRow = pageRows.at(-1)

  return {
    items: pageRows.map(mapRow),
    meta,
    page: {
      nextCursor:
        input.request.direction === 'FORWARD'
          ? hasExtra && lastRow
            ? cursorForRow(lastRow)
            : null
          : input.request.cursor && lastRow
            ? cursorForRow(lastRow)
            : null,
      previousCursor:
        input.request.direction === 'FORWARD'
          ? input.request.cursor && firstRow
            ? cursorForRow(firstRow)
            : null
          : hasExtra && firstRow
            ? cursorForRow(firstRow)
            : null,
      totalCount: asCount(totalRow.total_count)
    },
    summary: {
      activeCount,
      masterCount,
      ownedCount: activeCount - masterCount
    }
  }
}

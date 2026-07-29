import { sql, type RawBuilder } from 'kysely'
import type { DBLike, DbTables, TableName } from '#types'

export type NodeRuntimeQueryRow = Record<string, unknown>

export type NodeRuntimeQueryWhere =
  | { kind: 'PREDICATE'; column: string; op: '=' | '!='; value: unknown }
  | { kind: 'PREDICATE'; column: string; op: 'IN'; values: readonly unknown[] }
  | { kind: 'AND'; expressions: readonly NodeRuntimeQueryWhere[] }
  | { kind: 'OR'; expressions: readonly NodeRuntimeQueryWhere[] }
  | { kind: 'NOT'; expression: NodeRuntimeQueryWhere }
  | { kind: 'CONSTANT'; value: boolean }

type SystemScopedTableName = {
  [K in TableName]: 'system_id' extends keyof DbTables[K]['Row'] ? K : never
}[TableName]

const systemScopedTableNames = [
  'alignments',
  'backgrounds',
  'challenge_ratings',
  'classes',
  'condition_types',
  'creature_types',
  'creatures',
  'currencies',
  'damage_types',
  'equipment',
  'feats',
  'heritages',
  'languages',
  'magic_schools',
  'races',
  'rarities',
  'senses',
  'skills',
  'speeds',
  'spells'
] as const satisfies readonly SystemScopedTableName[]

const systemScopedTables: ReadonlySet<string> = new Set(systemScopedTableNames)

export async function selectNodeRuntimeRows(
  db: DBLike,
  tableName: string,
  columns: readonly string[],
  where?: NodeRuntimeQueryWhere,
  systemId?: string
): Promise<NodeRuntimeQueryRow[]> {
  if (columns.length === 0) {
    throw new Error('Node runtime queries must select explicit columns.')
  }

  const predicates: RawBuilder<unknown>[] = []
  if (where) predicates.push(compileWhere(where))
  if (systemId) {
    const systemPredicate = getSystemPredicate(tableName, systemId)
    if (systemPredicate) predicates.push(systemPredicate)
  }

  const whereClause =
    predicates.length === 0 ? sql`` : sql` where ${sql.join(predicates, sql` and `)}`

  const result = await sql<NodeRuntimeQueryRow>`
    select ${sql.join(columns.map((column) => sql.ref(column)))}
    from ${sql.table(tableName)}
    ${whereClause}
  `.execute(db)

  return result.rows
}

function getSystemPredicate(tableName: string, systemId: string): RawBuilder<unknown> | undefined {
  if (systemScopedTables.has(tableName)) {
    return sql`${sql.ref('system_id')} = ${systemId}`
  }

  if (tableName === 'class_resources') {
    return sql`exists (
      select 1
      from classes parent_class
      where parent_class.id = class_resources.class_id
        and parent_class.system_id = ${systemId}
    )`
  }

  if (tableName === 'race_ancestries') {
    return sql`exists (
      select 1
      from races parent_race
      where parent_race.id = race_ancestries.race_id
        and parent_race.system_id = ${systemId}
    )`
  }

  if (tableName === 'race_ancestry_options') {
    return sql`exists (
      select 1
      from race_ancestries ancestry
      join races parent_race on parent_race.id = ancestry.race_id
      where ancestry.id = race_ancestry_options.ancestry_id
        and parent_race.system_id = ${systemId}
    )`
  }

  return undefined
}

function compileWhere(where: NodeRuntimeQueryWhere): RawBuilder<unknown> {
  switch (where.kind) {
    case 'CONSTANT':
      return sql`${where.value}`
    case 'AND':
      if (where.expressions.length === 0) return sql`true`
      return sql`(${sql.join(where.expressions.map(compileWhere), sql` and `)})`
    case 'OR':
      if (where.expressions.length === 0) return sql`false`
      return sql`(${sql.join(where.expressions.map(compileWhere), sql` or `)})`
    case 'NOT':
      return sql`not (${compileWhere(where.expression)})`
    case 'PREDICATE': {
      const column = sql.ref(where.column)
      if (where.op === 'IN') {
        const values = where.values.filter((value) => value !== null && value !== undefined)
        const includesNull = where.values.includes(null)
        const valuePredicate =
          values.length === 0 ? undefined : sql`${column} in (${sql.join(values)})`

        if (valuePredicate && includesNull) return sql`(${valuePredicate} or ${column} is null)`
        if (valuePredicate) return valuePredicate
        if (includesNull) return sql`${column} is null`
        return sql`false`
      }

      if (where.op === '=') {
        return where.value === null ? sql`${column} is null` : sql`${column} = ${where.value}`
      }

      if (where.op === '!=') {
        return where.value === null ? sql`${column} is not null` : sql`${column} <> ${where.value}`
      }

      throw new Error(`Unknown node runtime predicate: ${JSON.stringify(where)}`)
    }
    default: {
      const impossibleWhere: never = where
      throw new Error(`Unknown node runtime where kind: ${JSON.stringify(impossibleWhere)}`)
    }
  }
}

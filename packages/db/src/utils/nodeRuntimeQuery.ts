import { sql } from 'kysely'
import type { DBLike } from '#types'

export type NodeRuntimeQueryRow = Record<string, unknown>

export async function selectNodeRuntimeRows(
  db: DBLike,
  tableName: string,
  columns: readonly string[]
): Promise<NodeRuntimeQueryRow[]> {
  const selectColumns = columns.length > 0
    ? sql.join(columns.map((column) => sql.ref(column)))
    : sql`*`

  const result = await sql<NodeRuntimeQueryRow>`
    select ${selectColumns}
    from ${sql.table(tableName)}
  `.execute(db)

  return result.rows
}

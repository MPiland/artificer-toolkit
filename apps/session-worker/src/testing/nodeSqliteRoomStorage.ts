import { DatabaseSync } from 'node:sqlite'
import type { RoomSqlValue, RoomStorage } from '../roomEncounterStore.js'

/**
 * A `RoomStorage` over Node's SQLite for unit tests. It reports a statement's changed rows as
 * `rowsWritten` and returned rows as `rowsRead`, an approximation of Durable Object billing; the
 * workerd tests measure the real cursors.
 */
export function createNodeSqliteRoomStorage(database = new DatabaseSync(':memory:')) {
  const storage: RoomStorage = {
    sql: {
      exec(query, ...bindings) {
        const statement = database.prepare(query)
        if (statement.columns().length === 0) {
          const { changes } = statement.run(...bindings)
          return { toArray: () => [], rowsRead: 0, rowsWritten: Number(changes) }
        }
        const rows = statement.all(...bindings).map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([column, value]): [string, RoomSqlValue] => {
              if (typeof value === 'bigint') return [column, Number(value)]
              if (value instanceof Uint8Array) throw new Error('Blob columns are unsupported.')
              return [column, value]
            })
          )
        )
        return { toArray: () => rows, rowsRead: rows.length, rowsWritten: 0 }
      }
    },
    transactionSync(closure) {
      database.exec('BEGIN')
      try {
        const result = closure()
        database.exec('COMMIT')
        return result
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    }
  }
  return { database, storage }
}

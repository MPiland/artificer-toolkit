import type { Transaction } from 'kysely'
import type { Database, DBLike } from '#types'

function isTransaction(db: DBLike): db is Transaction<Database> {
  return db.isTransaction
}

export function withTransaction<T>(
  db: DBLike,
  fn: (trx: Transaction<Database>) => Promise<T>
): Promise<T> {
  if (isTransaction(db)) {
    return fn(db)
  }

  return db.transaction().execute(fn)
}

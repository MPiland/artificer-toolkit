import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import type { Database } from '#types'

export function createDb() {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL!
      })
    })
  })
}

/** Impersonates a Supabase user for RLS */
export async function withUserContext<T>(
  db: Kysely<Database>,
  userId: string,
  fn: (ctx: Kysely<Database>) => Promise<T>
) {
  try {
    return db.transaction().execute(async (trx) => {
    // ✅ Works and is type-safe
      await sql`SET request.jwt.claim.sub = ${userId}`.execute(trx)
      return fn(trx)
    })
  } catch (err) {
    console.error(err)
    throw new Error('Failed to load data', { cause: err })
  }
}

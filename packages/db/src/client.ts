import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import type { Database } from '#types'

interface CreateDbOptions {
  connectionString?: string
}

function resolveConnectionString(options: CreateDbOptions): string {
  const connectionString = options.connectionString
    ?? process.env.DATABASE_URL
    ?? process.env.DATABASE_CONNECTION_STRING

  if (!connectionString) {
    throw new Error('DATABASE_URL or DATABASE_CONNECTION_STRING is required.')
  }

  return connectionString
}

export function createDb(options: CreateDbOptions = {}) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: resolveConnectionString(options)
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
      await sql`select set_config('request.jwt.claim.sub', ${userId}, true)`.execute(trx)
      return fn(trx)
    })
  } catch (err) {
    console.error(err)
    throw new Error('Failed to load data', { cause: err })
  }
}

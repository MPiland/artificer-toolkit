import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import type { Database } from '#types'

interface CreateDbOptions {
  connectionString?: string
}

const DB_QUERY_TRACE_ENV = 'ARTIFICER_DB_QUERY_TRACE'

function readPoolMax(): number {
  const value = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10)
  return Number.isFinite(value) && value > 0 ? value : 5
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

function shouldTraceDbQueries(): boolean {
  return process.env[DB_QUERY_TRACE_ENV] === '1'
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof (value as { then?: unknown }).then === 'function'
}

function readQueryOperation(args: readonly unknown[]): string {
  const first = args[0]
  const text = typeof first === 'string'
    ? first
    : typeof first === 'object' && first !== null && 'text' in first && typeof (first as { text?: unknown }).text === 'string'
      ? (first as { text: string }).text
      : ''
  const match = text.trimStart().match(/^[a-z]+/i)

  return match?.[0]?.toUpperCase() ?? 'QUERY'
}

function installQueryTrace(pool: Pool): Pool {
  if (!shouldTraceDbQueries()) {
    return pool
  }

  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown
  let queryCount = 0

  pool.query = ((...args: unknown[]) => {
    const operation = readQueryOperation(args)
    const startedAt = Date.now()
    const sequence = ++queryCount
    const result = originalQuery(...args)
    const logQuery = (ok: boolean) => {
      console.info('[artificer-db-query]', JSON.stringify({
        durationMs: Date.now() - startedAt,
        ok,
        operation,
        sequence
      }))
    }

    if (isPromiseLike(result)) {
      return result.then(
        (value) => {
          logQuery(true)
          return value
        },
        (error: unknown) => {
          logQuery(false)
          throw error
        }
      )
    }

    logQuery(true)
    return result
  }) as Pool['query']

  return pool
}

export function createDb(options: CreateDbOptions = {}) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: installQueryTrace(new Pool({
        connectionString: resolveConnectionString(options),
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        max: readPoolMax()
      }))
    })
  })
}

/** Impersonates a Supabase user for RLS */
export async function withUserContext<T>(
  db: Kysely<Database>,
  userId: string,
  fn: (ctx: Kysely<Database>) => Promise<T>
) {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('request.jwt.claim.sub', ${userId}, true)`.execute(trx)
    return fn(trx)
  })
}

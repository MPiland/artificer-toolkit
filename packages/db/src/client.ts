import { AsyncLocalStorage } from 'node:async_hooks'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool, type PoolClient } from 'pg'
import type { Database } from '#types'

interface CreateDbOptions {
  connectionTimeoutMillis?: number
  connectionString?: string
}

const DB_QUERY_TRACE_ENV = 'ARTIFICER_DB_QUERY_TRACE'

export interface DbTraceMetadata {
  operation?: string
  runtimeCold?: boolean
  traceId?: string
}

interface DbTraceContext extends DbTraceMetadata {
  poolAcquireDurationMs: number
  queryCount: number
  queryDurationMs: number
  startedAt: number
  transactionId: number
}

const dbTraceContext = new AsyncLocalStorage<DbTraceContext>()
let transactionCount = 0

function readPoolMax(): number {
  const value = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10)
  return Number.isFinite(value) && value > 0 ? value : 5
}

function resolveConnectionString(options: CreateDbOptions): string {
  const connectionString = options.connectionString ?? process.env.DATABASE_CONNECTION_STRING

  if (!connectionString) {
    throw new Error('DATABASE_CONNECTION_STRING is required.')
  }

  return connectionString
}

function shouldTraceDbQueries(): boolean {
  return process.env[DB_QUERY_TRACE_ENV] === '1'
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function readQueryText(args: readonly unknown[]): string {
  const first = args[0]
  return typeof first === 'string'
    ? first
    : typeof first === 'object' &&
        first !== null &&
        'text' in first &&
        typeof (first as { text?: unknown }).text === 'string'
      ? (first as { text: string }).text
      : ''
}

function readQueryOperation(args: readonly unknown[]): string {
  const text = readQueryText(args)
  const match = text.trimStart().match(/^[a-z]+/i)

  return match?.[0]?.toUpperCase() ?? 'QUERY'
}

function readQueryRelation(args: readonly unknown[]): string | undefined {
  const match = readQueryText(args).match(
    /\b(?:from|into|update|join)\s+"?([a-z_][a-z0-9_]*)"?(?:\s*\.\s*"?([a-z_][a-z0-9_]*)"?)?/i
  )
  return match?.[2] ?? match?.[1]
}

function resultMetrics(value: unknown): { resultBytes?: number; rowCount?: number } {
  if (typeof value !== 'object' || value === null || !('rows' in value)) return {}
  const rows = (value as { rows?: unknown }).rows
  if (!Array.isArray(rows)) return {}
  try {
    return {
      resultBytes: Buffer.byteLength(JSON.stringify(rows), 'utf8'),
      rowCount: rows.length
    }
  } catch {
    return { rowCount: rows.length }
  }
}

function installPoolTrace(pool: Pool): Pool {
  const originalConnect = pool.connect.bind(pool) as () => Promise<PoolClient>

  pool.connect = (() => {
    const startedAt = performance.now()
    return originalConnect().then((client) => {
      const durationMs = performance.now() - startedAt
      const context = dbTraceContext.getStore()
      if (context) context.poolAcquireDurationMs += durationMs
      console.info(
        '[artificer-db-pool]',
        JSON.stringify({
          durationMs,
          idleCount: pool.idleCount,
          operation: context?.operation,
          runtimeCold: context?.runtimeCold,
          totalCount: pool.totalCount,
          traceId: context?.traceId,
          transactionId: context?.transactionId,
          waitingCount: pool.waitingCount
        })
      )
      return client
    })
  }) as Pool['connect']

  return pool
}

function installQueryTrace(pool: Pool): Pool {
  if (!shouldTraceDbQueries()) {
    return pool
  }

  let queryCount = 0
  installPoolTrace(pool)
  pool.on('connect', (client) => {
    const originalQuery = client.query.bind(client) as (...args: unknown[]) => unknown

    client.query = ((...args: unknown[]) => {
      const operation = readQueryOperation(args)
      const relation = readQueryRelation(args)
      const startedAt = performance.now()
      const sequence = ++queryCount
      const result = originalQuery(...args)
      const logQuery = (ok: boolean, value?: unknown) => {
        const completedAt = performance.now()
        const durationMs = completedAt - startedAt
        const context = dbTraceContext.getStore()
        if (context) {
          context.queryCount += 1
          context.queryDurationMs += durationMs
        }
        console.info(
          '[artificer-db-query]',
          JSON.stringify({
            durationMs,
            ok,
            operation,
            requestOperation: context?.operation,
            relation,
            runtimeCold: context?.runtimeCold,
            sequence,
            startedOffsetMs: context ? startedAt - context.startedAt : undefined,
            completedOffsetMs: context ? completedAt - context.startedAt : undefined,
            traceId: context?.traceId,
            transactionId: context?.transactionId,
            ...resultMetrics(value)
          })
        )
      }

      if (isPromiseLike(result)) {
        return result.then(
          (value) => {
            logQuery(true, value)
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
    }) as typeof client.query
  })

  return pool
}

export function createDb(options: CreateDbOptions = {}) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: installQueryTrace(
        new Pool({
          connectionString: resolveConnectionString(options),
          connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10_000,
          idleTimeoutMillis: 30_000,
          max: readPoolMax()
        })
      )
    })
  })
}

/** Impersonates a Supabase user for RLS */
export async function withUserContext<T>(
  db: Kysely<Database>,
  userId: string,
  fn: (ctx: Kysely<Database>) => Promise<T>,
  trace: DbTraceMetadata = {}
) {
  if (!shouldTraceDbQueries()) {
    return db.transaction().execute(async (trx) => {
      await sql`select set_config('request.jwt.claim.sub', ${userId}, true)`.execute(trx)
      return fn(trx)
    })
  }

  const context: DbTraceContext = {
    ...trace,
    poolAcquireDurationMs: 0,
    queryCount: 0,
    queryDurationMs: 0,
    startedAt: performance.now(),
    transactionId: ++transactionCount
  }

  return dbTraceContext.run(context, async () => {
    let ok = false
    try {
      const result = await db.transaction().execute(async (trx) => {
        await sql`select set_config('request.jwt.claim.sub', ${userId}, true)`.execute(trx)
        return fn(trx)
      })
      ok = true
      return result
    } finally {
      const durationMs = performance.now() - context.startedAt
      console.info(
        '[artificer-db-transaction]',
        JSON.stringify({
          applicationDurationMs: Math.max(
            0,
            durationMs - context.poolAcquireDurationMs - context.queryDurationMs
          ),
          durationMs,
          ok,
          operation: context.operation,
          poolAcquireDurationMs: context.poolAcquireDurationMs,
          queryCount: context.queryCount,
          queryDurationMs: context.queryDurationMs,
          runtimeCold: context.runtimeCold,
          traceId: context.traceId,
          transactionId: context.transactionId
        })
      )
    }
  })
}

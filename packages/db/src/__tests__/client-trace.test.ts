import { sql } from 'kysely'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('pg', () => {
  class Pool {
    readonly idleCount = 0
    readonly totalCount = 1
    readonly waitingCount = 0
    private readonly listeners: Array<(client: FakeClient) => void> = []

    on(event: string, listener: (client: FakeClient) => void) {
      if (event === 'connect') this.listeners.push(listener)
      return this
    }

    async connect() {
      const client = new FakeClient()
      for (const listener of this.listeners) listener(client)
      return client
    }

    async end() {}
  }

  class FakeClient {
    async query(text: string) {
      return {
        command: text.trimStart().split(/\s/, 1)[0]?.toUpperCase() ?? 'QUERY',
        fields: [],
        oid: 0,
        rowCount: 1,
        rows: [{ privateValue: 'never-log-row-values' }]
      }
    }

    release() {}
  }

  return { Pool }
})

const originalTraceSetting = process.env.ARTIFICER_DB_QUERY_TRACE

afterEach(() => {
  if (originalTraceSetting === undefined) delete process.env.ARTIFICER_DB_QUERY_TRACE
  else process.env.ARTIFICER_DB_QUERY_TRACE = originalTraceSetting
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('database tracing', () => {
  it('correlates pool, query, and transaction timings without logging sensitive values', async () => {
    process.env.ARTIFICER_DB_QUERY_TRACE = '1'
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { createDb, withUserContext } = await import('../client.js')
    const db = createDb({ connectionString: 'postgres://unused' })

    await withUserContext(
      db,
      '6d66346c-9a56-4a74-af2e-e8ed23df8c06',
      async (trx) => {
        await sql`select ${'private-parameter'}`.execute(trx)
      },
      {
        operation: 'LIVE_SCENE',
        runtimeCold: true,
        traceId: '2c856e10-20fa-42fb-a34b-f3c9beeb090e'
      }
    )
    await db.destroy()

    const output = info.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('[artificer-db-pool]')
    expect(output).toContain('[artificer-db-query]')
    expect(output).toContain('[artificer-db-transaction]')
    expect(output).toContain('2c856e10-20fa-42fb-a34b-f3c9beeb090e')
    expect(output).toContain('"operation":"LIVE_SCENE"')
    expect(output).toContain('"runtimeCold":true')
    expect(output).toContain('"rowCount":1')
    expect(output).toContain('"startedOffsetMs":')
    expect(output).not.toContain('private-parameter')
    expect(output).not.toContain('never-log-row-values')
    expect(output).not.toContain('6d66346c-9a56-4a74-af2e-e8ed23df8c06')
  })
})

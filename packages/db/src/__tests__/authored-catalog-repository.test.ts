import { describe, expect, it } from 'vitest'
import {
  Kysely,
  PostgresDialect,
  type PostgresPool,
  type PostgresPoolClient,
  type PostgresQueryResult
} from 'kysely'

import type { Database, DBLike } from '#types'
import {
  AuthoredCatalogProjectionUnavailableError,
  getAuthoredCatalogPage,
  syncSpellCatalogClassIndex
} from '../domains/subjects/repositories/authoredCatalog.js'

interface CapturedQuery {
  parameters: readonly unknown[]
  sql: string
}

function createTestDatabase(responses: Array<readonly Record<string, unknown>[]>) {
  const queries: CapturedQuery[] = []
  const client = {
    async query<Row>(statement: string, parameters: readonly unknown[]) {
      queries.push({ sql: statement, parameters })
      const rows = responses.shift() ?? []
      return {
        command: statement.trimStart().split(/\s/, 1)[0]?.toUpperCase() ?? 'SELECT',
        rowCount: rows.length,
        rows: rows as Row[]
      } as PostgresQueryResult<Row>
    },
    release() {}
  } as unknown as PostgresPoolClient
  const pool: PostgresPool = {
    async connect() {
      return client
    },
    async end() {}
  }
  return {
    db: new Kysely<Database>({ dialect: new PostgresDialect({ pool }) }),
    queries
  }
}

const spellId = '00000000-0000-0000-0000-000000000001'
const spellVersionId = '00000000-0000-0000-0000-000000000002'
const classId = '00000000-0000-0000-0000-000000000003'
const userId = '00000000-0000-0000-0000-000000000004'

describe('authored catalogue Spell index', () => {
  it('fails closed before listing when a visible Spell has no exact index marker', async () => {
    const { db, queries } = createTestDatabase([[{ id: spellId }]])

    await expect(
      getAuthoredCatalogPage(db as unknown as DBLike, {
        request: { direction: 'FORWARD', limit: 48, sort: 'name' },
        subjectKind: 'SPELL',
        userId
      })
    ).rejects.toBeInstanceOf(AuthoredCatalogProjectionUnavailableError)

    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toContain('spell_catalog_index_versions')
    expect(queries[0]?.parameters).toContain(userId)
  })

  it('publishes class membership and its exact-version marker together', async () => {
    const { db, queries } = createTestDatabase([[], [], []])

    await syncSpellCatalogClassIndex(db as unknown as DBLike, {
      authoredVersionId: spellVersionId,
      classIds: [classId],
      spellId
    })

    expect(queries).toHaveLength(3)
    expect(queries[1]?.sql).toContain('as class_values(class_id)')
    expect(queries[2]?.sql).toContain('spell_catalog_index_versions')
    expect(queries[2]?.sql).toContain('on conflict (spell_id) do update')
  })

  it('publishes the exact-version marker for a Spell with no Classes', async () => {
    const { db, queries } = createTestDatabase([[], []])

    await syncSpellCatalogClassIndex(db as unknown as DBLike, {
      authoredVersionId: spellVersionId,
      classIds: [],
      spellId
    })

    expect(queries).toHaveLength(2)
    expect(queries[1]?.sql).toContain('spell_catalog_index_versions')
  })
})

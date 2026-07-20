import { describe, expect, it, vi } from 'vitest'

import { synchronizeSnapshot, type TableSnapshot } from '../scripts/seedSrdBulk.js'

function createSnapshot(rowCount: number): TableSnapshot {
  return {
    name: 'ordered_projection',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: false },
      { name: 'sort_order', type: 'int4', nullable: false, hasDefault: false }
    ],
    primaryKey: ['id'],
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: `row-${index}`,
      sort_order: index + 1
    }))
  }
}

describe('bulk SRD snapshot synchronization', () => {
  it('deletes every batch before inserting replacement rows', async () => {
    const queries: string[] = []
    const client = {
      query: vi.fn(async (queryText: string) => {
        queries.push(queryText)
        return undefined
      })
    }

    await synchronizeSnapshot(client, createSnapshot(501), true)

    expect(queries).toHaveLength(4)
    expect(queries.slice(0, 2).every((query) => query.includes('delete from'))).toBe(true)
    expect(queries.slice(2).every((query) => query.includes('insert into'))).toBe(true)
    expect(queries.slice(2).every((query) => !query.includes('on conflict'))).toBe(true)
  })

  it('uses primary-key upserts when replacement is unsafe', async () => {
    const queries: string[] = []
    const client = {
      query: vi.fn(async (queryText: string) => {
        queries.push(queryText)
        return undefined
      })
    }

    await synchronizeSnapshot(client, createSnapshot(1), false)

    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('on conflict ("id") do update')
  })
})

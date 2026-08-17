import { describe, expect, it, vi } from 'vitest'

import { assertDatabaseTarget, parseSeedInvocation } from '../scripts/seedSrd.js'
import { remapOwner, synchronizeSnapshot, type TableSnapshot } from '../scripts/srdBatchSync.js'

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

describe('SRD seed invocation', () => {
  it('requires exactly one explicit target', () => {
    expect(() => parseSeedInvocation([])).toThrow('Pass exactly one')
    expect(() => parseSeedInvocation(['--staging', '--production', '--dry-run'])).toThrow(
      'Pass exactly one'
    )
  })

  it('accepts a rollback-only staging dry run without the commit confirmation', () => {
    expect(parseSeedInvocation(['--staging', '--dry-run'])).toEqual({
      dryRun: true,
      target: 'staging'
    })
  })

  it('requires explicit confirmation before a hosted commit', () => {
    expect(() => parseSeedInvocation(['--production'])).toThrow('--confirm-seed-srd')
    expect(parseSeedInvocation(['--production', '--confirm-seed-srd'])).toEqual({
      dryRun: false,
      target: 'production'
    })
  })

  it('keeps local seeding direct and rejects a meaningless local dry run', () => {
    expect(parseSeedInvocation(['--local'])).toEqual({ dryRun: false, target: 'local' })
    expect(() => parseSeedInvocation(['--local', '--dry-run'])).toThrow(
      '--local and --dry-run cannot be used together'
    )
  })

  it('rejects crossing local and hosted database boundaries', () => {
    expect(() =>
      assertDatabaseTarget('staging', 'postgresql://postgres@127.0.0.1:54322/postgres')
    ).toThrow('staging SRD seed command requires a hosted database')
    expect(() =>
      assertDatabaseTarget('local', 'postgresql://postgres@db.example.test:5432/postgres')
    ).toThrow('local SRD seed command requires a local database')
  })
})

describe('hosted SRD batch synchronization', () => {
  it('remaps exact owner values without rewriting UUID text embedded in prose', () => {
    const sourceOwnerId = '11111111-1111-4111-8111-111111111111'
    const targetOwnerId = '22222222-2222-4222-8222-222222222222'
    const source = {
      owner_user_id: sourceOwnerId,
      nested: [{ user_id: sourceOwnerId }],
      description: `Owner reference: ${sourceOwnerId}`
    }

    expect(remapOwner(source, sourceOwnerId, targetOwnerId)).toEqual({
      owner_user_id: targetOwnerId,
      nested: [{ user_id: targetOwnerId }],
      description: `Owner reference: ${sourceOwnerId}`
    })
  })

  it('deletes and inserts normalized rows in 500-row batches when replacement is required', async () => {
    const queries: string[] = []
    const client = {
      query: vi.fn(async (queryText: string) => {
        queries.push(queryText)
        return { rows: [] }
      })
    }

    await synchronizeSnapshot(client, createSnapshot(501), true)

    expect(queries).toHaveLength(4)
    expect(queries.slice(0, 2).every((query) => query.includes('delete from'))).toBe(true)
    expect(queries.slice(2).every((query) => query.includes('insert into'))).toBe(true)
    expect(queries.slice(2).every((query) => !query.includes('on conflict'))).toBe(true)
  })

  it('uses primary-key upserts for ordinary normalized tables', async () => {
    const queries: string[] = []
    const client = {
      query: vi.fn(async (queryText: string) => {
        queries.push(queryText)
        return { rows: [] }
      })
    }

    await synchronizeSnapshot(client, createSnapshot(1), false)

    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('on conflict ("id") do update')
  })
})

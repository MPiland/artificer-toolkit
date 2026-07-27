import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/shared/upserts/detail.js', () => ({
  upsertDetail: vi.fn(async () => {})
}))

import { createDetailRepository } from '../repositories/index.js'
import type { DBLike } from '#types'

function createFakeDb(rows: unknown[]) {
  const queryCounts = new Map<string, number>()
  return {
    queryCounts,
    selectFrom() {
      queryCounts.set('details', (queryCounts.get('details') ?? 0) + 1)
      const state = {
        filtered: [...rows]
      }

      const builder = {
        select() {
          return builder
        },
        where(column: string, _op: string, value: string | string[]) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            if (_op === 'in') {
              return Array.isArray(value) && value.includes(record[column] as string)
            }
            return record[column] === value
          })
          return builder
        },
        orderBy() {
          state.filtered = [...state.filtered].sort((a, b) => {
            const left = (a as Record<string, number>).sort_order
            const right = (b as Record<string, number>).sort_order
            return left - right
          })
          return builder
        },
        async execute() {
          return state.filtered
        },
        async executeTakeFirst() {
          return state.filtered[0] ?? undefined
        }
      }

      return builder
    }
  }
}

describe('createDetailRepository', () => {
  it('batches findByIds while preserving requested order and omitting inaccessible rows', async () => {
    const db = createFakeDb([
      {
        id: 'detail-1',
        label: 'First',
        description: 'First description',
        sort_order: 1
      },
      {
        id: 'detail-2',
        label: 'Second',
        description: 'Second description',
        sort_order: 2
      },
      {
        id: 'detail-unrequested',
        label: 'Unrequested',
        description: 'Should not hydrate',
        sort_order: 3
      }
    ])
    const repository = createDetailRepository(db as unknown as DBLike)

    const results = await repository.findByIds([
      'detail-2',
      'detail-missing',
      'detail-1',
      'detail-2'
    ])

    expect(Array.from(results.keys())).toEqual(['detail-2', 'detail-1'])
    expect(results.has('detail-missing')).toBe(false)
    expect(results.has('detail-unrequested')).toBe(false)
    expect(db.queryCounts.get('details')).toBe(1)
  })

  it('hydrates one detail record', async () => {
    const repository = createDetailRepository(
      createFakeDb([
        {
          id: 'detail-1',
          label: 'Overview',
          description: 'Description',
          sort_order: 2
        }
      ]) as never
    )

    await expect(repository.findById('detail-1')).resolves.toEqual({
      id: 'detail-1',
      label: 'Overview',
      description: 'Description',
      order: 2
    })
  })

  it('returns all details in sort order', async () => {
    const repository = createDetailRepository(
      createFakeDb([
        {
          id: 'detail-2',
          label: 'Second',
          description: 'Second description',
          sort_order: 2
        },
        {
          id: 'detail-1',
          label: 'First',
          description: 'First description',
          sort_order: 1
        }
      ]) as never
    )

    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 'detail-1',
        label: 'First',
        description: 'First description',
        order: 1
      },
      {
        id: 'detail-2',
        label: 'Second',
        description: 'Second description',
        order: 2
      }
    ])
  })
})

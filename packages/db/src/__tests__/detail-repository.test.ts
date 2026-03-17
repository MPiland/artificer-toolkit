import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/shared/upserts/detail.js', () => ({
  upsertDetail: vi.fn(async () => {})
}))

import { createDetailRepository } from '../repositories/index.js'

function createFakeDb(rows: unknown[]) {
  return {
    selectFrom() {
      const state = {
        filtered: [...rows]
      }

      const builder = {
        select() {
          return builder
        },
        where(column: string, _op: string, value: string) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
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
  it('hydrates one detail record', async () => {
    const repository = createDetailRepository(createFakeDb([
      {
        id: 'detail-1',
        label: 'Overview',
        description: 'Description',
        sort_order: 2
      }
    ]) as never)

    await expect(repository.findById('detail-1')).resolves.toEqual({
      id: 'detail-1',
      label: 'Overview',
      description: 'Description',
      order: 2
    })
  })

  it('returns all details in sort order', async () => {
    const repository = createDetailRepository(createFakeDb([
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
    ]) as never)

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

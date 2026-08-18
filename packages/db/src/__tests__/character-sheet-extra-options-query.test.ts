import { describe, expect, it } from 'vitest'

import { getCharacterSheetExtraOptionsQuery } from '../domains/subjects/queries/getCharacterSheetExtraOptionsQuery.js'
import type { DBLike } from '../types/index.js'

type QueryTrace = {
  table: string
  filters: Array<{ column: string; operation: string; value: unknown }>
  limit?: number
  orderBy: string[]
  expressionFilters: number
}

function createQueryDb(rows: Array<{ id: string; label: string; description: string | null }>) {
  const traces: QueryTrace[] = []
  return {
    db: {
      selectFrom(table: string) {
        const trace: QueryTrace = { table, filters: [], orderBy: [], expressionFilters: 0 }
        traces.push(trace)
        const query = {
          select() {
            return query
          },
          where(
            columnOrExpression: string | ((expressionBuilder: unknown) => unknown),
            operation?: string,
            value?: unknown
          ) {
            if (typeof columnOrExpression === 'string') {
              trace.filters.push({ column: columnOrExpression, operation: operation ?? '', value })
            } else {
              trace.expressionFilters += 1
            }
            return query
          },
          orderBy(column: string) {
            trace.orderBy.push(column)
            return query
          },
          limit(limit: number) {
            trace.limit = limit
            return query
          },
          async execute() {
            return rows
          }
        }
        return query
      }
    } as unknown as DBLike,
    traces
  }
}

describe('getCharacterSheetExtraOptionsQuery', () => {
  it('loads one capped Creature page without reading the Vehicle catalog', async () => {
    const { db, traces } = createQueryDb(
      Array.from({ length: 26 }, (_value, index) => ({
        id: `creature-${index + 1}`,
        label: `Creature ${index + 1}`,
        description: null
      }))
    )

    const page = await getCharacterSheetExtraOptionsQuery(db, {
      kind: 'CREATURE',
      systemId: 'system-1',
      userId: 'user-1',
      limit: 25
    })

    expect(page.items).toHaveLength(25)
    expect(page.nextCursor).toEqual({ id: 'creature-25', label: 'Creature 25' })
    expect(traces).toEqual([
      expect.objectContaining({
        table: 'creatures',
        limit: 26,
        orderBy: ['label', 'id'],
        filters: expect.arrayContaining([
          { column: 'system_id', operation: '=', value: 'system-1' },
          { column: 'status', operation: '=', value: 'ACTIVE' }
        ])
      })
    ])
  })

  it('filters one Vehicle page by its typed search query', async () => {
    const { db, traces } = createQueryDb([
      { id: 'vehicle-1', label: 'Sailing Ship', description: 'A vessel.' }
    ])

    const page = await getCharacterSheetExtraOptionsQuery(db, {
      kind: 'VEHICLE',
      systemId: 'system-1',
      userId: 'user-1',
      query: 'ship',
      limit: 25
    })

    expect(page).toEqual({
      items: [{ id: 'vehicle-1', label: 'Sailing Ship', description: 'A vessel.' }],
      nextCursor: null
    })
    expect(traces[0]?.table).toBe('vehicles')
    expect(traces[0]?.filters).toContainEqual({
      column: 'label',
      operation: 'ilike',
      value: '%ship%'
    })
  })
})

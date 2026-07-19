import { describe, expect, it } from 'vitest'
import { getSpellListQuery } from '../domains/subjects/queries/getSpellListQuery.js'
import type { DBLike } from '../types/index.js'

type QueryFilter = {
  column: string
  operation: string
  value: unknown
}

type QueryTrace = {
  table: string
  filters: QueryFilter[]
  groupBy?: string | string[]
}

type QueryRows = Record<string, unknown>[]

function createListQueryDb(options: { items: QueryRows; traces: QueryTrace[] }) {
  return {
    selectFrom(table: string) {
      const trace: QueryTrace = { table, filters: [] }
      options.traces.push(trace)

      const builder = {
        select() {
          return builder
        },
        innerJoin() {
          return builder
        },
        where(column: string, operation: string, value: unknown) {
          trace.filters.push({ column, operation, value })
          return builder
        },
        groupBy(value: string | string[]) {
          trace.groupBy = value
          return builder
        },
        async execute(): Promise<QueryRows> {
          if (table === 'spells' && trace.groupBy === undefined) {
            return options.items
              .filter((item) =>
                trace.filters.every((filter) => {
                  if (filter.operation === 'in') {
                    return Array.isArray(filter.value) && filter.value.includes(item.id)
                  }

                  return item[filter.column] === filter.value
                })
              )
              .map((item) => ({
                id: item.id,
                label: item.label,
                description: item.description,
                status: item.status,
                systemId: item.system_id,
                level: item.level,
                magicSchoolId: item.magic_school_id,
                castingTimeUnit: item.casting_time_unit,
                castingTimeAmount: item.casting_time_amount,
                materialDescription: item.material_description,
                ownerUserId: item.user_id,
                isMaster: item.is_master,
                userId: item.is_master ? 'master' : item.user_id
              }))
          }

          if (table === 'spell_attributes') {
            return [{ id: 'CONCENTRATION', spellIds: ['spell-1'] }]
          }

          if (table === 'spell_classes') {
            return [{ id: 'wizard', label: 'Wizard', spellIds: ['spell-1'] }]
          }

          if (Array.isArray(trace.groupBy) && trace.groupBy.includes('spells.magic_school_id')) {
            return [{ id: 'abjuration', label: 'Abjuration', spellIds: ['spell-1'] }]
          }

          if (trace.groupBy === 'level') {
            return [{ id: 2, spellIds: ['spell-1'] }]
          }

          if (trace.groupBy === 'casting_time_unit') {
            return [{ id: 'ROUND', spellIds: ['spell-1'] }]
          }

          return []
        }
      }

      return builder
    }
  }
}

const itemRows: QueryRows = [
  {
    id: 'spell-1',
    label: 'Arcane Lock',
    description: 'Seals a door or container.',
    status: 'ACTIVE',
    system_id: 'system-1',
    user_id: 'user-1',
    is_master: false,
    level: 2,
    magic_school_id: 'abjuration',
    casting_time_unit: 'ROUND',
    casting_time_amount: 1,
    material_description: 'Gold dust worth at least 25 gp.'
  },
  {
    id: 'spell-2',
    label: 'Other Spell',
    description: 'Not returned by the filter.',
    status: 'ACTIVE',
    system_id: 'system-2',
    user_id: 'user-2',
    is_master: false,
    level: 1,
    magic_school_id: 'evocation',
    casting_time_unit: 'ROUND',
    casting_time_amount: 1,
    material_description: null
  }
]

describe('getSpellListQuery', () => {
  it('returns Builder metadata fields and scopes every facet query to filtered spell ids', async () => {
    const traces: QueryTrace[] = []
    const db = createListQueryDb({ items: itemRows, traces }) as unknown as DBLike

    const result = await getSpellListQuery(db, {
      systemId: 'system-1',
      userId: 'user-1'
    })

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        level: 2,
        materialDescription: 'Gold dust worth at least 25 gp.',
        magicSchoolId: 'abjuration',
        castingTimeUnit: 'ROUND',
        castingTimeAmount: 1
      })
    ])
    expect(result.meta).toEqual({
      attributes: [{ id: 'CONCENTRATION', spellIds: ['spell-1'] }],
      classes: [{ id: 'wizard', label: 'Wizard', spellIds: ['spell-1'] }],
      schools: [{ id: 'abjuration', label: 'Abjuration', spellIds: ['spell-1'] }],
      levels: [{ id: 2, spellIds: ['spell-1'] }],
      castingTimeUnits: [{ id: 'ROUND', spellIds: ['spell-1'] }]
    })
    expect(traces).toHaveLength(6)
    expect(traces[0]?.filters).toEqual([
      { column: 'system_id', operation: '=', value: 'system-1' },
      { column: 'user_id', operation: '=', value: 'user-1' }
    ])

    for (const trace of traces.slice(1)) {
      expect(trace.filters).toContainEqual(
        expect.objectContaining({ operation: 'in', value: ['spell-1'] })
      )
    }
  })

  it('does not run unscoped metadata queries for an empty filtered catalog', async () => {
    const traces: QueryTrace[] = []
    const db = createListQueryDb({ items: itemRows, traces }) as unknown as DBLike

    await expect(getSpellListQuery(db, { systemId: 'missing-system' })).resolves.toEqual({
      items: [],
      meta: {
        attributes: [],
        classes: [],
        schools: [],
        levels: [],
        castingTimeUnits: []
      }
    })
    expect(traces).toHaveLength(1)
  })
})

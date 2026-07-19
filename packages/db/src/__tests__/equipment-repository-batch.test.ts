import { describe, expect, it } from 'vitest'
import { createEquipmentRepository } from '../repositories/index.js'

type RowMap = Record<string, unknown[]>

function createCountingDb(rowsByTable: RowMap, onSelect: () => void) {
  return {
    selectFrom(table: string) {
      onSelect()
      const state = {
        filtered: [...(rowsByTable[table] ?? [])]
      }
      const builder = {
        select() {
          return builder
        },
        where(column: string, op: string, value: string | readonly string[]) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            return op === 'in' && Array.isArray(value)
              ? value.includes(record[column] as string)
              : record[column] === value
          })
          return builder
        },
        orderBy(column: string) {
          state.filtered = [...state.filtered].sort((left, right) => {
            const leftValue = (left as Record<string, number | string>)[column]
            const rightValue = (right as Record<string, number | string>)[column]
            return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
          })
          return builder
        },
        async execute() {
          return state.filtered
        }
      }
      return builder
    }
  }
}

function createEquipmentRows(count: number): RowMap {
  return {
    equipment: Array.from({ length: count }, (_, index) => ({
      id: `equipment-${index + 1}`,
      system_id: 'system-1',
      user_id: 'user-1',
      label: `Equipment ${index + 1}`,
      description: null,
      quote: null,
      status: 'DRAFT',
      category: 'ADVENTURING_GEAR',
      rarity_id: 'common',
      cost_amount: null,
      cost_currency_id: null,
      weight_amount: 1,
      weight_unit: 'POUNDS',
      capacity_amount: null,
      capacity_unit: null,
      max_stack: null,
      max_bonus: null,
      armor_class: null,
      requires_attunement: false,
      charge_id: null,
      restriction_id: null,
      parent_equipment_id: null
    })),
    equipment_effects: [],
    equipment_modifier_grants: [],
    equipment_features: [],
    equipment_attributes: [],
    equipment_properties: [],
    equipment_contains: []
  }
}

async function readResolvedEquipment(rootCount: number) {
  let queryCount = 0
  const repository = createEquipmentRepository(
    createCountingDb(createEquipmentRows(rootCount), () => queryCount++) as never
  )
  const equipment = await repository.findResolvedAll({ systemId: 'system-1' })

  return { equipment, queryCount }
}

describe('createEquipmentRepository batch hydration', () => {
  it('keeps the resolved-equipment query count constant as root count grows', async () => {
    const singleRoot = await readResolvedEquipment(1)
    const manyRoots = await readResolvedEquipment(5)

    expect(singleRoot.equipment).toHaveLength(1)
    expect(manyRoots.equipment).toHaveLength(5)
    expect(manyRoots.queryCount).toBe(singleRoot.queryCount)
  })
})

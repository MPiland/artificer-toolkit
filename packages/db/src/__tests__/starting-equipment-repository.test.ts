import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/shared/upserts/starting_equipment.js', () => ({
  upsertStartingEquipment: vi.fn(async () => {})
}))

import { createStartingEquipmentRepository } from '../repositories/starting-equipment.js'

type RowMap = Record<string, unknown[]>

function createFakeDb(rowsByTable: RowMap) {
  return {
    selectFrom(table: string) {
      const state = {
        filtered: [...(rowsByTable[table] ?? [])]
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
        },
        async executeTakeFirst() {
          return state.filtered[0] ?? undefined
        }
      }

      return builder
    }
  }
}

describe('createStartingEquipmentRepository', () => {
  it('hydrates a full starting equipment tree', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-1' }],
      starting_equipment_sets: [{ id: 'set-1', starting_equipment_id: 'se-1', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-1', equipment_set_id: 'set-1', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-1', equipment_group_id: 'group-1', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-1',
          equipment_option_id: 'option-1',
          starting_equipment_kind: 'EQUIPMENT',
          authoring_mode_kind: 'SELECTED',
          selection_kind: 'GRANTED',
          category_code: 'WEAPON',
          count: null,
          quantity: 1,
          sort_order: 1
        },
        {
          id: 'item-2',
          equipment_option_id: 'option-1',
          starting_equipment_kind: 'CURRENCY',
          authoring_mode_kind: null,
          selection_kind: null,
          category_code: null,
          count: null,
          quantity: null,
          sort_order: 2
        }
      ],
      starting_equipment_option_item_equipment: [
        { option_item_id: 'item-1', equipment_id: 'equipment-1' }
      ],
      starting_equipment_option_item_properties: [
        { option_item_id: 'item-1', property_code: 'LIGHT' }
      ],
      starting_equipment_currencies: [
        { option_item_id: 'item-2', currency_id: 'gp', amount: 10 }
      ]
    }) as never)

    await expect(repository.findById('se-1')).resolves.toEqual({
      id: 'se-1',
      sets: [
        {
          id: 'set-1',
          order: 1,
          groups: [
            {
              id: 'group-1',
              order: 1,
              options: [
                {
                  id: 'option-1',
                  order: 1,
                  items: [
                    {
                      id: 'item-1',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      authoringModeKind: 'SELECTED',
                      selectionKind: 'GRANTED',
                      category: 'WEAPON',
                      quantity: 1,
                      properties: ['LIGHT'],
                      equipmentIds: ['equipment-1']
                    },
                    {
                      id: 'item-2',
                      order: 2,
                      startingEquipmentKind: 'CURRENCY',
                      currencies: [
                        { currencyId: 'gp', amount: 10 }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it('fails loudly when an equipment item is missing its required quantity payload', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-bad-1' }],
      starting_equipment_sets: [{ id: 'set-bad-1', starting_equipment_id: 'se-bad-1', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-bad-1', equipment_set_id: 'set-bad-1', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-bad-1', equipment_group_id: 'group-bad-1', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-bad-1',
          equipment_option_id: 'option-bad-1',
          starting_equipment_kind: 'EQUIPMENT',
          authoring_mode_kind: 'ALL',
          selection_kind: 'GRANTED',
          category_code: 'WEAPON',
          count: null,
          quantity: null,
          sort_order: 1
        }
      ],
      starting_equipment_option_item_equipment: [],
      starting_equipment_option_item_properties: [],
      starting_equipment_currencies: []
    }) as never)

    await expect(repository.findById('se-bad-1')).rejects.toThrow(
      'missing quantity'
    )
  })

  it('fails loudly when a selected equipment item is missing persisted equipment ids', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-bad-selected-ids' }],
      starting_equipment_sets: [{ id: 'set-bad-selected-ids', starting_equipment_id: 'se-bad-selected-ids', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-bad-selected-ids', equipment_set_id: 'set-bad-selected-ids', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-bad-selected-ids', equipment_group_id: 'group-bad-selected-ids', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-bad-selected-ids',
          equipment_option_id: 'option-bad-selected-ids',
          starting_equipment_kind: 'EQUIPMENT',
          authoring_mode_kind: 'SELECTED',
          selection_kind: 'GRANTED',
          category_code: 'WEAPON',
          count: null,
          quantity: 1,
          sort_order: 1
        }
      ],
      starting_equipment_option_item_equipment: [],
      starting_equipment_option_item_properties: [],
      starting_equipment_currencies: []
    }) as never)

    await expect(repository.findById('se-bad-selected-ids')).rejects.toThrow(
      'missing equipmentIds'
    )
  })

  it('fails loudly when a currency item is missing persisted currencies', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-bad-currencies' }],
      starting_equipment_sets: [{ id: 'set-bad-currencies', starting_equipment_id: 'se-bad-currencies', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-bad-currencies', equipment_set_id: 'set-bad-currencies', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-bad-currencies', equipment_group_id: 'group-bad-currencies', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-bad-currencies',
          equipment_option_id: 'option-bad-currencies',
          starting_equipment_kind: 'CURRENCY',
          authoring_mode_kind: null,
          selection_kind: null,
          category_code: null,
          count: null,
          quantity: null,
          sort_order: 1
        }
      ],
      starting_equipment_option_item_equipment: [],
      starting_equipment_option_item_properties: [],
      starting_equipment_currencies: []
    }) as never)

    await expect(repository.findById('se-bad-currencies')).rejects.toThrow(
      'missing currencies'
    )
  })

  it('fails loudly when a granted equipment item persists count', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-bad-count' }],
      starting_equipment_sets: [{ id: 'set-bad-count', starting_equipment_id: 'se-bad-count', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-bad-count', equipment_set_id: 'set-bad-count', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-bad-count', equipment_group_id: 'group-bad-count', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-bad-count',
          equipment_option_id: 'option-bad-count',
          starting_equipment_kind: 'EQUIPMENT',
          authoring_mode_kind: 'ALL',
          selection_kind: 'GRANTED',
          category_code: null,
          count: 1,
          quantity: 1,
          sort_order: 1
        }
      ],
      starting_equipment_option_item_equipment: [],
      starting_equipment_option_item_properties: [],
      starting_equipment_currencies: []
    }) as never)

    await expect(repository.findById('se-bad-count')).rejects.toThrow(
      'cannot hydrate count for GRANTED'
    )
  })

  it('fails loudly when a chosen equipment item persists quantity', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-bad-quantity' }],
      starting_equipment_sets: [{ id: 'set-bad-quantity', starting_equipment_id: 'se-bad-quantity', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-bad-quantity', equipment_set_id: 'set-bad-quantity', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-bad-quantity', equipment_group_id: 'group-bad-quantity', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-bad-quantity',
          equipment_option_id: 'option-bad-quantity',
          starting_equipment_kind: 'EQUIPMENT',
          authoring_mode_kind: 'ALL',
          selection_kind: 'CHOSEN',
          category_code: null,
          count: 1,
          quantity: 1,
          sort_order: 1
        }
      ],
      starting_equipment_option_item_equipment: [],
      starting_equipment_option_item_properties: [],
      starting_equipment_currencies: []
    }) as never)

    await expect(repository.findById('se-bad-quantity')).rejects.toThrow(
      'cannot hydrate quantity for CHOSEN'
    )
  })

  it('fails loudly when an item has an invalid persisted starting equipment kind', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-bad-kind' }],
      starting_equipment_sets: [{ id: 'set-bad-kind', starting_equipment_id: 'se-bad-kind', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-bad-kind', equipment_set_id: 'set-bad-kind', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-bad-kind', equipment_group_id: 'group-bad-kind', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-bad-kind',
          equipment_option_id: 'option-bad-kind',
          starting_equipment_kind: 'MYSTERY',
          authoring_mode_kind: null,
          selection_kind: null,
          category_code: null,
          count: null,
          quantity: null,
          sort_order: 1
        }
      ],
      starting_equipment_option_item_equipment: [],
      starting_equipment_option_item_properties: [],
      starting_equipment_currencies: []
    }) as never)

    await expect(repository.findById('se-bad-kind')).rejects.toThrow(
      'invalid starting_equipment_kind'
    )
  })

  it('fails loudly when an equipment item has an invalid persisted category code', async () => {
    const repository = createStartingEquipmentRepository(createFakeDb({
      starting_equipment: [{ id: 'se-bad-category' }],
      starting_equipment_sets: [{ id: 'set-bad-category', starting_equipment_id: 'se-bad-category', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-bad-category', equipment_set_id: 'set-bad-category', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-bad-category', equipment_group_id: 'group-bad-category', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-bad-category',
          equipment_option_id: 'option-bad-category',
          starting_equipment_kind: 'EQUIPMENT',
          authoring_mode_kind: 'ALL',
          selection_kind: 'GRANTED',
          category_code: 'GADGET',
          count: null,
          quantity: 1,
          sort_order: 1
        }
      ],
      starting_equipment_option_item_equipment: [],
      starting_equipment_option_item_properties: [],
      starting_equipment_currencies: []
    }) as never)

    await expect(repository.findById('se-bad-category')).rejects.toThrow(
      'invalid category_code'
    )
  })
})

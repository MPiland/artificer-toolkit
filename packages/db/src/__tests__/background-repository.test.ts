import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/subjects/upserts/background.js', () => ({
  upsertBackground: vi.fn(async () => {})
}))

import { createBackgroundRepository } from '../repositories/background.js'

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

describe('createBackgroundRepository', () => {
  it('hydrates a background with composed owned content', async () => {
    const repository = createBackgroundRepository(createFakeDb({
      backgrounds: [
        {
          id: 'background-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Scholar',
          description: 'Knows things.',
          starting_equipment_id: 'se-1'
        }
      ],
      background_details: [
        { background_id: 'background-1', detail_id: 'detail-1', sort_order: 1 }
      ],
      background_features: [
        { background_id: 'background-1', feature_id: 'feature-1', sort_order: 1 }
      ],
      details: [
        { id: 'detail-1', label: 'Overview', description: 'Lore', sort_order: 1 }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Researcher',
          description: 'You know how to find answers.',
          detail: null,
          charge_id: null,
          restriction_id: null,
          sort_order: 1,
          available_at_level: null
        }
      ],
      feature_effects: [],
      feature_attributes: [],
      feature_feat_grants: [],
      feature_modifier_grants: [],
      feature_proficiency_grants: [],
      feature_sense_grants: [],
      feature_spell_grants: [],
      feature_options: [],
      feature_option_levels: [],
      background_proficiency_grants: [
        { background_id: 'background-1', proficiency_grant_id: 'grant-1', sort_order: 1 }
      ],
      proficiency_grants: [
        {
          id: 'grant-1',
          sort_order: 1,
          proficiency_kind: 'SKILL',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_skills: [
        { proficiency_grant_id: 'grant-1', skill_id: 'skill-1' }
      ],
      starting_equipment: [{ id: 'se-1' }],
      starting_equipment_sets: [{ id: 'set-1', starting_equipment_id: 'se-1', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-1', equipment_set_id: 'set-1', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-1', equipment_group_id: 'group-1', sort_order: 1 }],
      starting_equipment_option_items: [
        {
          id: 'item-1',
          equipment_option_id: 'option-1',
          starting_equipment_kind: 'CURRENCY',
          authoring_mode_kind: null,
          selection_kind: null,
          category_code: null,
          count: null,
          quantity: null,
          sort_order: 1
        }
      ],
      starting_equipment_currencies: [
        { option_item_id: 'item-1', currency_id: 'gp', amount: 15 }
      ]
    }) as never)

    await expect(repository.findById('background-1')).resolves.toEqual({
      kind: 'BACKGROUND',
      id: 'background-1',
      label: 'Scholar',
      description: 'Knows things.',
      details: [
        {
          id: 'detail-1',
          label: 'Overview',
          description: 'Lore',
          order: 1
        }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Researcher',
          description: 'You know how to find answers.',
          attributes: undefined,
          detail: undefined,
          effects: undefined,
          charges: undefined,
          grants: undefined,
          restrictions: undefined,
          order: 1,
          availableAtLevel: undefined,
          optionChoices: undefined,
          options: undefined
        }
      ],
      startingEquipment: {
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
                        startingEquipmentKind: 'CURRENCY',
                        currencies: [{ currencyId: 'gp', amount: 15 }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      proficiencies: [
        {
          id: 'grant-1',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SKILL',
          order: 1,
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          level: 'FULL',
          rounding: undefined,
          count: undefined,
          skillIds: ['skill-1']
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })
  })

  it('omits optional owned fields when the row graph does not contain them', async () => {
    const repository = createBackgroundRepository(createFakeDb({
      backgrounds: [
        {
          id: 'background-2',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Wanderer',
          description: null,
          starting_equipment_id: null
        }
      ],
      background_details: [],
      background_features: [],
      background_proficiency_grants: []
    }) as never)

    await expect(repository.findById('background-2')).resolves.toEqual({
      kind: 'BACKGROUND',
      id: 'background-2',
      label: 'Wanderer',
      description: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })
  })

  it('fails loudly when a linked detail row is missing', async () => {
    const repository = createBackgroundRepository(createFakeDb({
      backgrounds: [
        {
          id: 'background-missing-detail',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Broken Scholar',
          description: null,
          starting_equipment_id: null
        }
      ],
      background_details: [
        { background_id: 'background-missing-detail', detail_id: 'detail-missing', sort_order: 1 }
      ],
      background_features: [],
      details: [],
      background_proficiency_grants: []
    }) as never)

    await expect(repository.findById('background-missing-detail')).rejects.toThrow('missing detail')
  })

  it('fails loudly when linked starting equipment is missing', async () => {
    const repository = createBackgroundRepository(createFakeDb({
      backgrounds: [
        {
          id: 'background-missing-equipment',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Broken Wanderer',
          description: null,
          starting_equipment_id: 'se-missing'
        }
      ],
      background_details: [],
      background_features: [],
      background_proficiency_grants: [],
      starting_equipment: []
    }) as never)

    await expect(repository.findById('background-missing-equipment')).rejects.toThrow('missing starting equipment')
  })
})

import { describe, expect, it } from 'vitest'
import { createRaceRepository } from '../repositories/index.js'

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

describe('createRaceRepository', () => {
  it('hydrates a base race with supported details and speeds', async () => {
    const repository = createRaceRepository(createFakeDb({
      races: [
        {
          id: 'race-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Elf',
          quote: 'Graceful.',
          description: 'Long-lived and keen.',
          category: 'BASE',
          selection_mode: 'REQUIRES_SUBRACE',
          parent_race_id: null,
          size_code: 'MEDIUM'
        }
      ],
      race_features: [
        { race_id: 'race-1', feature_id: 'feature-1', sort_order: 1 }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Fey Ancestry',
          description: 'Harder to charm.',
          detail: null,
          charge_id: null,
          restriction_id: null,
          sort_order: 1,
          available_at_level: null
        },
        {
          id: 'feature-2',
          label: 'Fire Breath',
          description: 'Breathe fire.',
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
      race_ancestries: [
        {
          id: 'ancestry-1',
          race_id: 'race-1',
          label: 'Draconic Ancestry',
          description: 'Choose your draconic lineage.'
        }
      ],
      race_ancestry_options: [
        {
          id: 'ancestry-option-1',
          ancestry_id: 'ancestry-1',
          label: 'Red',
          description: 'Fire lineage.',
          sort_order: 1
        }
      ],
      race_ancestry_option_features: [
        {
          ancestry_option_id: 'ancestry-option-1',
          feature_id: 'feature-2',
          sort_order: 1
        }
      ],
      race_details: [
        { race_id: 'race-1', detail_id: 'detail-1', sort_order: 1 }
      ],
      race_heritages: [
        { race_id: 'race-1', heritage_id: 'heritage-elven', sort_order: 1 }
      ],
      details: [
        { id: 'detail-1', label: 'Keen Senses', description: 'Alert.', sort_order: 1 }
      ],
      race_speeds: [
        { race_id: 'race-1', speed_id: 'walk', amount: 30, unit_code: 'FEET' }
      ]
    }) as never)

    await expect(repository.findById('race-1')).resolves.toEqual({
      id: 'race-1',
      label: 'Elf',
      quote: 'Graceful.',
      description: 'Long-lived and keen.',
      heritageIds: ['heritage-elven'],
      details: [
        {
          id: 'detail-1',
          label: 'Keen Senses',
          description: 'Alert.',
          order: 1
        }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Fey Ancestry',
          description: 'Harder to charm.',
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
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      ancestry: {
        id: 'ancestry-1',
        label: 'Draconic Ancestry',
        description: 'Choose your draconic lineage.',
        options: [
          {
            id: 'ancestry-option-1',
            label: 'Red',
            description: 'Fire lineage.',
            order: 1,
            features: [
              {
                id: 'feature-2',
                label: 'Fire Breath',
                description: 'Breathe fire.',
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
            ]
          }
        ]
      },
      size: 'MEDIUM',
      speeds: [
        {
          speedId: 'walk',
          amount: 30,
          unit: 'FEET'
        }
      ]
    })
  })

  it('hydrates a subrace as an additive-only child record', async () => {
    const repository = createRaceRepository(createFakeDb({
      races: [
        {
          id: 'race-2',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'High Elf',
          quote: null,
          description: null,
          category: 'SUBRACE',
          selection_mode: null,
          parent_race_id: 'race-1',
          size_code: null
        }
      ],
      race_features: [],
      race_ancestries: [],
      race_details: [],
      race_heritages: [],
      race_speeds: []
    }) as never)

    await expect(repository.findById('race-2')).resolves.toEqual({
      id: 'race-2',
      label: 'High Elf',
      quote: undefined,
      description: undefined,
      heritageIds: undefined,
      details: undefined,
      features: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'SUBRACE',
      parentRaceId: 'race-1'
    })
  })

  it('hydrates ancestry options even when they have no linked features', async () => {
    const repository = createRaceRepository(createFakeDb({
      races: [
        {
          id: 'race-unsupported',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Broken Race',
          quote: null,
          description: null,
          category: 'BASE',
          selection_mode: 'DIRECT',
          parent_race_id: null,
          size_code: 'MEDIUM'
        }
      ],
      race_features: [],
      race_ancestries: [{ id: 'ancestry-1', race_id: 'race-unsupported', label: 'Lineage', description: null }],
      race_ancestry_options: [{ id: 'option-1', ancestry_id: 'ancestry-1', label: 'Blue', description: 'Cold.', sort_order: 1 }],
      race_ancestry_option_features: [],
      race_details: [],
      race_heritages: [],
      race_speeds: []
    }) as never)

    await expect(repository.findById('race-unsupported')).resolves.toMatchObject({
      ancestry: {
        id: 'ancestry-1',
        options: [
          {
            id: 'option-1',
            features: undefined
          }
        ]
      }
    })
  })

  it('resolves subraces against their parent race for effective reads', async () => {
    const repository = createRaceRepository(createFakeDb({
      races: [
        {
          id: 'race-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Elf',
          quote: null,
          description: 'Base elf.',
          category: 'BASE',
          selection_mode: 'REQUIRES_SUBRACE',
          parent_race_id: null,
          size_code: 'MEDIUM'
        },
        {
          id: 'race-2',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Wood Elf',
          quote: null,
          description: 'A swift elf.',
          category: 'SUBRACE',
          selection_mode: null,
          parent_race_id: 'race-1',
          size_code: null
        }
      ],
      race_features: [
        { race_id: 'race-1', feature_id: 'feature-1', sort_order: 1 },
        { race_id: 'race-2', feature_id: 'feature-2', sort_order: 1 }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Keen Senses',
          description: 'Parent feature.',
          detail: null,
          charge_id: null,
          restriction_id: null,
          sort_order: 1,
          available_at_level: null
        },
        {
          id: 'feature-2',
          label: 'Fleet of Foot',
          description: 'Child feature.',
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
      race_ancestries: [
        {
          id: 'ancestry-1',
          race_id: 'race-1',
          label: 'Elven Lineage',
          description: 'Parent ancestry.'
        }
      ],
      race_ancestry_options: [
        {
          id: 'ancestry-option-1',
          ancestry_id: 'ancestry-1',
          label: 'Wood',
          description: 'Forest lineage.',
          sort_order: 1
        }
      ],
      race_ancestry_option_features: [],
      race_details: [
        { race_id: 'race-1', detail_id: 'detail-1', sort_order: 1 },
        { race_id: 'race-2', detail_id: 'detail-2', sort_order: 1 }
      ],
      race_heritages: [
        { race_id: 'race-1', heritage_id: 'heritage-elven', sort_order: 1 }
      ],
      details: [
        { id: 'detail-1', label: 'Parent Detail', description: 'Inherited.', sort_order: 1 },
        { id: 'detail-2', label: 'Child Detail', description: 'Additive.', sort_order: 1 }
      ],
      race_speeds: [
        { race_id: 'race-1', speed_id: 'walk', amount: 30, unit_code: 'FEET' }
      ]
    }) as never)

    const resolved = await repository.findResolvedById('race-2')

    expect(resolved).toMatchObject({
      id: 'race-2',
      category: 'SUBRACE',
      parentRaceId: 'race-1',
      heritageIds: ['heritage-elven'],
      size: 'MEDIUM',
      speeds: [
        {
          speedId: 'walk',
          amount: 30,
          unit: 'FEET'
        }
      ],
      ancestry: {
        id: 'ancestry-1',
        label: 'Elven Lineage'
      },
      details: [
        { id: 'detail-1' },
        { id: 'detail-2' }
      ],
      features: [
        { id: 'feature-1' },
        { id: 'feature-2' }
      ],
      subrace: {
        parentRaceId: 'race-1',
        parentLabel: 'Elf',
        inherited: {
          size: 'MEDIUM',
          heritageIds: ['heritage-elven']
        }
      }
    })
    expect(resolved && resolved.category === 'SUBRACE'
      ? resolved.subrace.inherited
      : undefined).not.toHaveProperty('selectionMode')
  })

  it('fails loudly when an ancestry option is missing its required description', async () => {
    const repository = createRaceRepository(createFakeDb({
      races: [
        {
          id: 'race-bad-ancestry-option',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Broken Race',
          quote: null,
          description: null,
          category: 'BASE',
          selection_mode: 'DIRECT',
          parent_race_id: null,
          size_code: 'MEDIUM'
        }
      ],
      race_features: [],
      race_ancestries: [{ id: 'ancestry-1', race_id: 'race-bad-ancestry-option', label: 'Lineage', description: null }],
      race_ancestry_options: [{ id: 'option-1', ancestry_id: 'ancestry-1', label: 'Blue', description: null, sort_order: 1 }],
      race_ancestry_option_features: [],
      race_details: [],
      race_heritages: [],
      race_speeds: []
    }) as never)

    await expect(repository.findById('race-bad-ancestry-option')).rejects.toThrow(
      'Race "race-bad-ancestry-option" ancestry option "option-1" is missing description.'
    )
  })
})

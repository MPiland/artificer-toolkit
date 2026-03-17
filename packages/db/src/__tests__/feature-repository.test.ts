import { describe, expect, it } from 'vitest'
import { createFeatureRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

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

describe('createFeatureRepository', () => {
  it('hydrates a feature with nested options and option choices', async () => {
    const repository = createFeatureRepository(createFakeDb({
      features: [
        {
          id: 'feature-1',
          label: 'Fighting Style',
          description: 'Choose a technique.',
          detail: 'Applies at level 2.',
          charge_id: null,
          restriction_id: null,
          sort_order: 2,
          available_at_level: 2
        }
      ],
      feature_effects: [],
      feature_attributes: [
        { feature_id: 'feature-1', attribute_code: 'LIMITED_USE', sort_order: 1 }
      ],
      feature_feat_grants: [],
      feature_modifier_grants: [],
      feature_proficiency_grants: [],
      feature_sense_grants: [],
      feature_spell_grants: [],
      feature_options: [
        { feature_id: 'feature-1', option_id: 'option-1', sort_order: 1 }
      ],
      feature_option_levels: [
        { feature_id: 'feature-1', level: 2, count: 1, replace_count: null, sort_order: 1 }
      ],
      options: [
        {
          id: 'option-1',
          label: 'Defense',
          description: 'Gain a defensive bonus.',
          detail: null,
          sort_order: 1,
          charge_id: null,
          restriction_id: null
        }
      ],
      option_effects: [],
      option_attributes: [
        { option_id: 'option-1', attribute_code: 'HIDDEN_ON_SHEET', sort_order: 1 }
      ],
      option_feat_grants: [],
      option_modifier_grants: [],
      option_proficiency_grants: [],
      option_sense_grants: [],
      option_spell_grants: []
    }) as never)

    await expect(repository.findById('feature-1')).resolves.toEqual({
      id: 'feature-1',
      label: 'Fighting Style',
      description: 'Choose a technique.',
      attributes: ['LIMITED_USE'],
      detail: 'Applies at level 2.',
      effects: undefined,
      charges: undefined,
      grants: undefined,
      restrictions: undefined,
      order: 2,
      availableAtLevel: 2,
      optionChoices: [
        {
          level: 2,
          count: 1,
          replaceCount: undefined
        }
      ],
      options: [
        {
          id: 'option-1',
          label: 'Defense',
          description: 'Gain a defensive bonus.',
          attributes: ['HIDDEN_ON_SHEET'],
          detail: undefined,
          effects: undefined,
          charges: undefined,
          grants: undefined,
          restrictions: undefined,
          order: 1
        }
      ]
    })
  })

  it('fails loudly when a linked option row is missing', async () => {
    const repository = createFeatureRepository(createFakeDb({
      features: [
        {
          id: 'feature-missing-option',
          label: 'Broken Feature',
          description: 'Oops.',
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
      feature_options: [
        { feature_id: 'feature-missing-option', option_id: 'option-missing', sort_order: 1 }
      ],
      feature_option_levels: [],
      options: [],
      option_effects: [],
      option_attributes: [],
      option_feat_grants: [],
      option_modifier_grants: [],
      option_proficiency_grants: [],
      option_sense_grants: [],
      option_spell_grants: []
    }) as never)

    await expect(repository.findById('feature-missing-option')).rejects.toThrow('missing option')
  })

  it('round-trips feature and option effects through the typed effect repository', async () => {
    const db = new InMemoryDb()
    const repository = createFeatureRepository(db as never, 'system-1')

    await repository.upsert({
      id: 'feature-effects-1',
      label: 'Reactive Ward',
      description: 'Feature with effects.',
      order: 1,
      effects: [
        {
          id: 'feature-effect-1',
          order: 1,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'feature-range-1',
              rangeKind: 'DISTANCE',
              amount: 30,
              unit: 'FEET'
            }
          },
          moments: [
            {
              id: 'feature-effect-moment-1',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              effectKind: 'DAMAGE',
              damageTypeId: 'force',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 5
            }
          ]
        }
      ],
      options: [
        {
          id: 'feature-option-1',
          label: 'Shielding Choice',
          description: 'Nested option effect.',
          order: 1,
          effects: [
            {
              id: 'option-effect-1',
              order: 1,
              invocation: {
                triggerCode: 'ENTER_AREA',
                activation: {
                  code: 'FREE'
                },
                range: {
                  id: 'option-range-1',
                  rangeKind: 'SELF'
                }
              },
              moments: [
                {
                  id: 'option-effect-moment-1',
                  moment: 'PASSIVE',
                  groupType: 'SINGLE',
                  resolutionKind: 'DIRECT',
                  effectKind: 'CONDITION',
                  conditionId: 'shielded'
                }
              ]
            }
          ]
        }
      ]
    })

    await expect(repository.findById('feature-effects-1')).resolves.toEqual({
      id: 'feature-effects-1',
      label: 'Reactive Ward',
      description: 'Feature with effects.',
      attributes: undefined,
      detail: undefined,
      effects: [
        {
          id: 'feature-effect-1',
          order: 1,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'feature-range-1',
              rangeKind: 'DISTANCE',
              amount: 30,
              unit: 'FEET'
            },
            shape: undefined
          },
          moments: [
            {
              id: 'feature-effect-moment-1',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              duration: undefined,
              effectKind: 'DAMAGE',
              damageTypeId: 'force',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 5,
              bonuses: undefined
            }
          ]
        }
      ],
      charges: undefined,
      grants: undefined,
      restrictions: undefined,
      order: 1,
      availableAtLevel: undefined,
      optionChoices: undefined,
      options: [
        {
          id: 'feature-option-1',
          label: 'Shielding Choice',
          description: 'Nested option effect.',
          attributes: undefined,
          detail: undefined,
          effects: [
            {
              id: 'option-effect-1',
              order: 1,
              invocation: {
                triggerCode: 'ENTER_AREA',
                activation: {
                  code: 'FREE'
                },
                range: {
                  id: 'option-range-1',
                  rangeKind: 'SELF'
                },
                shape: undefined
              },
              moments: [
                {
                  id: 'option-effect-moment-1',
                  moment: 'PASSIVE',
                  groupType: 'SINGLE',
                  resolutionKind: 'DIRECT',
                  duration: undefined,
                  effectKind: 'CONDITION',
                  conditionId: 'shielded'
                }
              ]
            }
          ],
          charges: undefined,
          grants: undefined,
          restrictions: undefined,
          order: 1
        }
      ]
    })
  })

  it('round-trips supported feature and option restrictions through typed facet persistence', async () => {
    const db = new InMemoryDb()
    const repository = createFeatureRepository(db as never, 'system-1')

    const feature = {
      id: 'feature-restrictions-1',
      label: 'Restricted Feature',
      description: 'Requires authored restrictions.',
      order: 1,
      restrictions: {
        id: 'facet-feature-1',
        groups: [
          {
            id: 'facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'facet-context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CLASS_LEVEL',
                    min: 3
                  }
                ]
              },
              {
                id: 'facet-context-2',
                order: 2,
                subject: 'FEAT',
                authoringModeKind: 'SELECTED',
                featIds: ['feat-anchor'],
                conditions: [
                  {
                    id: 'facet-condition-2',
                    order: 1,
                    kind: 'EXISTS',
                    constraint: 'INCLUDE',
                    relationCode: 'FEATURE',
                    authoringModeKind: 'SELECTED',
                    featureIds: ['fighting-style'],
                    where: {
                      authoringModeKind: 'ALL',
                      groups: [
                        {
                          id: 'where-group-1',
                          order: 1,
                          conditions: [
                            {
                              id: 'where-condition-1',
                              order: 1,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'DAMAGE_TYPE',
                              authoringModeKind: 'SELECTED',
                              damageTypeIds: ['fire']
                            }
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      options: [
        {
          id: 'option-restrictions-1',
          label: 'School Gate',
          description: 'Option with spell restrictions.',
          order: 1,
          restrictions: {
            id: 'facet-option-1',
            groups: [
              {
                id: 'facet-group-option-1',
                order: 1,
                contexts: [
                  {
                    id: 'facet-context-option-1',
                    order: 1,
                    subject: 'SPELL',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'facet-condition-option-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'SPELL_LEVEL',
                        min: 1,
                        max: 3
                      },
                      {
                        id: 'facet-condition-option-2',
                        order: 2,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'MAGIC_SCHOOL',
                        authoringModeKind: 'SELECTED',
                        magicSchoolIds: ['evocation']
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    } as const

    await repository.upsert(feature as never)

    await expect(repository.findById('feature-restrictions-1')).resolves.toEqual({
      ...feature,
      attributes: undefined,
      detail: undefined,
      effects: undefined,
      charges: undefined,
      grants: undefined,
      availableAtLevel: undefined,
      optionChoices: undefined,
      options: [
        {
          ...feature.options[0],
          attributes: undefined,
          detail: undefined,
          effects: undefined,
          charges: undefined,
          grants: undefined
        }
      ]
    })
  })
})

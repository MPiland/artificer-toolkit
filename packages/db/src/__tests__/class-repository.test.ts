import { describe, expect, it } from 'vitest'
import { createClassRepository } from '../repositories/class.js'

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

describe('createClassRepository', () => {
  it('hydrates a supported base class with multiclass content', async () => {
    const repository = createClassRepository(createFakeDb({
      classes: [
        {
          id: 'class-1',
          system_id: 'system-1',
          user_id: 'user-1',
          category: 'BASE',
          parent_class_id: null,
          label: 'Wizard',
          description: 'Arcane scholar.',
          starting_equipment_id: 'se-1'
        }
      ],
      class_features: [
        { class_id: 'class-1', feature_id: 'feature-1', sort_order: 1 }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Arcane Recovery',
          description: 'Recover some power.',
          detail: null,
          charge_id: null,
          restriction_id: null,
          sort_order: 1,
          available_at_level: 1
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
      class_resources: [
        {
          id: 'resource-1',
          class_id: 'class-1',
          label: 'Arcane Points',
          description: 'Recoverable points.',
          available_at_level: 2,
          charge_id: 'charge-resource-1'
        }
      ],
      class_spellcasting: [
        {
          id: 'spellcasting-1',
          class_id: 'class-1',
          magic_name: 'Arcana',
          ability_code: 'INTELLIGENCE',
          max_spell_level: 9,
          charge_id: 'charge-sc-1'
        }
      ],
      class_spellcasting_attributes: [
        { spellcasting_id: 'spellcasting-1', attribute_code: 'PREPARES_SPELLS', sort_order: 1 },
        { spellcasting_id: 'spellcasting-1', attribute_code: 'RITUAL_CASTER', sort_order: 2 }
      ],
      class_spellcasting_prepare_limit: [
        { spellcasting_id: 'spellcasting-1', scaling: 'FULL', rounding: null }
      ],
      class_spellcasting_prepare_limit_methods: [
        { spellcasting_id: 'spellcasting-1', method_code: 'CLASS_LEVEL', sort_order: 1 },
        { spellcasting_id: 'spellcasting-1', method_code: 'PER_LEVEL', sort_order: 2 }
      ],
      class_spellcasting_prepare_limit_levels: [
        { spellcasting_id: 'spellcasting-1', class_level: 1, amount: 2 },
        { spellcasting_id: 'spellcasting-1', class_level: 5, amount: 8 }
      ],
      class_spell_limits: [
        {
          id: 'spell-limit-1',
          spellcasting_id: 'spellcasting-1',
          class_level: 1,
          learned_spells_limit: 6,
          prepared_spells_limit: 4,
          cantrips_limit: 3
        },
        {
          id: 'spell-limit-2',
          spellcasting_id: 'spellcasting-1',
          class_level: 5,
          learned_spells_limit: 14,
          prepared_spells_limit: 9,
          cantrips_limit: 4
        }
      ],
      class_spell_slots: [
        { spell_limit_id: 'spell-limit-1', spell_level: 1, slot_count: 2 },
        { spell_limit_id: 'spell-limit-2', spell_level: 1, slot_count: 4 },
        { spell_limit_id: 'spell-limit-2', spell_level: 3, slot_count: 2 }
      ],
      class_details: [
        { class_id: 'class-1', detail_id: 'detail-1', sort_order: 1 }
      ],
      details: [
        { id: 'detail-1', label: 'Spellbook', description: 'Starts with one.', sort_order: 1 }
      ],
      class_proficiency_grants: [
        { class_id: 'class-1', proficiency_grant_id: 'grant-1', sort_order: 1 }
      ],
      class_attributes: [
        { class_id: 'class-1', attribute_code: 'SPELLCASTER', sort_order: 1 }
      ],
      class_subtypes: [],
      class_starting_gold: [
        { class_id: 'class-1', multiplier: 4, currency_id: 'gp', die_config: '4d4' }
      ],
      class_hitpoints: [
        { class_id: 'class-1', ability_code: 'INTELLIGENCE', die_config: '1d6' }
      ],
      class_multiclass: [
        { id: 'multiclass-1', class_id: 'class-1' }
      ],
      class_multiclass_requirement_groups: [
        { id: 'group-1', multiclass_id: 'multiclass-1', sort_order: 1 }
      ],
      class_multiclass_requirements: [
        { id: 'requirement-1', requirement_group_id: 'group-1', ability_code: 'INTELLIGENCE', min: 13, sort_order: 1 }
      ],
      class_multiclass_proficiency_grants: [
        { multiclass_id: 'multiclass-1', proficiency_grant_id: 'grant-2', sort_order: 1 }
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
        },
        {
          id: 'grant-2',
          sort_order: 1,
          proficiency_kind: 'LANGUAGE',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_skills: [
        { proficiency_grant_id: 'grant-1', skill_id: 'arcana' }
      ],
      proficiency_grant_save_abilities: [],
      proficiency_grant_languages: [
        { proficiency_grant_id: 'grant-2', language_id: 'draconic' }
      ],
      proficiency_grant_equipment: [],
      proficiency_grant_equipment_filters: [],
      proficiency_grant_equipment_filter_properties: [],
      proficiency_grant_equipment_properties: [],
      proficiency_grant_equipment_property_filters: [],
      starting_equipment: [{ id: 'se-1' }],
      starting_equipment_sets: [{ id: 'set-1', starting_equipment_id: 'se-1', sort_order: 1 }],
      starting_equipment_groups: [{ id: 'group-se-1', equipment_set_id: 'set-1', sort_order: 1 }],
      starting_equipment_options: [{ id: 'option-1', equipment_group_id: 'group-se-1', sort_order: 1 }],
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
        { option_item_id: 'item-1', currency_id: 'gp', amount: 10 }
      ],
      charges: [
        { id: 'charge-sc-1', scaling_kind: 'NONE', reset_kind: 'LONG_REST' },
        { id: 'charge-resource-1', scaling_kind: 'NONE', reset_kind: 'SHORT_REST' }
      ],
      charge_limits: [
        { charge_id: 'charge-sc-1', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 1, multiplier: null, min: null, max: null },
        { charge_id: 'charge-resource-1', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 4, multiplier: null, min: null, max: null }
      ],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('class-1')).resolves.toEqual({
      id: 'class-1',
      label: 'Wizard',
      description: 'Arcane scholar.',
      details: [
        {
          id: 'detail-1',
          label: 'Spellbook',
          description: 'Starts with one.',
          order: 1
        }
      ],
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
          skillIds: ['arcana']
        }
      ],
      spellcasting: {
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }],
            learnedSpellsLimit: 6,
            preparedSpellsLimit: 4,
            cantripsLimit: 3
          },
          {
            classLevel: 5,
            slots: [
              { spellLevel: 1, slotCount: 4 },
              { spellLevel: 3, slotCount: 2 }
            ],
            learnedSpellsLimit: 14,
            preparedSpellsLimit: 9,
            cantripsLimit: 4
          }
        ],
        magicName: 'Arcana',
        ability: 'INTELLIGENCE',
        maxSpellLevel: 9,
        attributes: ['PREPARES_SPELLS', 'RITUAL_CASTER'],
        charges: {
          id: 'charge-sc-1',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        },
        prepareLimit: {
          methodKinds: ['CLASS_LEVEL', 'PER_LEVEL'],
          scaling: 'FULL',
          rounding: undefined,
          perLevel: [
            { classLevel: 1, amount: 2 },
            { classLevel: 5, amount: 8 }
          ]
        }
      },
      resources: {
        id: 'resource-1',
        label: 'Arcane Points',
        description: 'Recoverable points.',
        availableAtLevel: 2,
        charges: {
          id: 'charge-resource-1',
          resetKind: 'SHORT_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 4
        }
      },
      features: [
        {
          id: 'feature-1',
          label: 'Arcane Recovery',
          description: 'Recover some power.',
          attributes: undefined,
          detail: undefined,
          effects: undefined,
          charges: undefined,
          grants: undefined,
          restrictions: undefined,
          order: 1,
          availableAtLevel: 1,
          optionChoices: undefined,
          options: undefined
        }
      ],
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BASE',
      attributes: ['SPELLCASTER'],
      startingGold: {
        multiplier: 4,
        currencyId: 'gp',
        dieConfig: '4d4'
      },
      startingEquipment: {
        id: 'se-1',
        sets: [
          {
            id: 'set-1',
            order: 1,
            groups: [
              {
                id: 'group-se-1',
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
                        currencies: [{ currencyId: 'gp', amount: 10 }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      hitpoint: {
        ability: 'INTELLIGENCE',
        dieConfig: '1d6'
      },
      multiclass: {
        id: 'multiclass-1',
        requirementGroups: {
          groups: [
            {
              id: 'group-1',
              requirements: [
                {
                  id: 'requirement-1',
                  ability: 'INTELLIGENCE',
                  min: 13
                }
              ]
            }
          ]
        },
        proficiencies: [
          {
            id: 'grant-2',
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'LANGUAGE',
            order: 1,
            selectionKind: 'GRANTED',
            authoringModeKind: 'SELECTED',
            level: 'FULL',
            rounding: undefined,
            count: undefined,
            languageIds: ['draconic']
          }
        ]
      }
    })
  })

  it('hydrates a supported subclass with subtypes', async () => {
    const repository = createClassRepository(createFakeDb({
      classes: [
        {
          id: 'class-2',
          system_id: 'system-1',
          user_id: 'user-1',
          category: 'SUBCLASS',
          parent_class_id: 'class-1',
          label: 'School of Evocation',
          description: null,
          starting_equipment_id: null
        }
      ],
      class_features: [],
      class_resources: [],
      class_spellcasting: [],
      class_details: [],
      class_proficiency_grants: [],
      class_attributes: [
        { class_id: 'class-2', attribute_code: 'SUBTYPE', sort_order: 1 }
      ],
      class_subtypes: [
        { id: 'subtype-1', class_id: 'class-2', label: 'Fire', sort_order: 1 }
      ],
      class_starting_gold: [],
      class_hitpoints: [],
      class_multiclass: []
    }) as never)

    await expect(repository.findById('class-2')).resolves.toEqual({
      id: 'class-2',
      label: 'School of Evocation',
      description: undefined,
      details: undefined,
      proficiencies: undefined,
      spellcasting: undefined,
      resources: undefined,
      features: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'SUBCLASS',
      attributes: ['SUBTYPE'],
      parentClassId: 'class-1',
      subtypes: [
        {
          id: 'subtype-1',
          label: 'Fire',
          order: 1
        }
      ]
    })
  })
})

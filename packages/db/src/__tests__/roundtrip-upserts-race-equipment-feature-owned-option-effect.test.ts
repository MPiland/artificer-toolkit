import { describe, expect, it } from 'vitest'
import { createFeatureRepository } from '../repositories/index.js'
import { createRaceRepository } from '../repositories/index.js'
import { createEquipmentRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('round-trip upsert correctness', () => {
  it('round-trips a race through supported details and speeds while clearing stale owned rows', async () => {
    const db = new InMemoryDb()
    const repository = createRaceRepository(db as never)
    await repository.upsert({
      id: 'race-1',
      label: 'Elf',
      quote: 'Graceful.',
      description: 'Original race',
      heritageIds: ['heritage-elven'],
      details: [
        {
          id: 'race-detail-1',
          label: 'Keen Senses',
          description: 'Old detail',
          order: 1
        }
      ],
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      ancestry: {
        id: 'race-ancestry-1',
        label: 'Draconic',
        description: 'Choose a color.',
        options: [
          {
            id: 'race-ancestry-option-1',
            label: 'Red',
            description: 'Fire lineage.',
            order: 1,
            features: [
              {
                id: 'race-ancestry-feature-1',
                label: 'Fire Breath',
                description: 'Breathe fire.',
                order: 1
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
    await repository.upsert({
      id: 'race-1',
      label: 'Elf',
      quote: 'Graceful.',
      description: 'Updated race',
      status: 'DRAFT',
      heritageIds: ['heritage-elven', 'heritage-fey'],
      details: [
        {
          id: 'race-detail-2',
          label: 'Trance',
          description: 'New detail',
          order: 1
        }
      ],
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      ancestry: {
        id: 'race-ancestry-2',
        label: 'Draconic',
        description: 'Choose a color.',
        options: [
          {
            id: 'race-ancestry-option-2',
            label: 'Blue',
            description: 'Lightning lineage.',
            order: 1,
            features: [
              {
                id: 'race-ancestry-feature-2',
                label: 'Lightning Breath',
                description: 'Breathe lightning.',
                order: 1
              }
            ]
          }
        ]
      },
      size: 'MEDIUM',
      speeds: [
        {
          speedId: 'walk',
          amount: 35,
          unit: 'FEET'
        },
        {
          speedId: 'fly',
          amount: 20,
          unit: 'FEET'
        }
      ]
    })
    await expect(repository.findById('race-1')).resolves.toEqual({
      id: 'race-1',
      label: 'Elf',
      quote: 'Graceful.',
      description: 'Updated race',
      status: 'DRAFT',
      heritageIds: ['heritage-elven', 'heritage-fey'],
      details: [
        {
          id: 'race-detail-2',
          label: 'Trance',
          description: 'New detail',
          order: 1
        }
      ],
      features: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      ancestry: {
        id: 'race-ancestry-2',
        label: 'Draconic',
        description: 'Choose a color.',
        options: [
          {
            id: 'race-ancestry-option-2',
            label: 'Blue',
            description: 'Lightning lineage.',
            order: 1,
            features: [
              {
                id: 'race-ancestry-feature-2',
                label: 'Lightning Breath',
                description: 'Breathe lightning.',
                attributes: undefined,
                details: undefined,
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
          speedId: 'fly',
          amount: 20,
          unit: 'FEET'
        },
        {
          speedId: 'walk',
          amount: 35,
          unit: 'FEET'
        }
      ]
    })
    expect(db.snapshot('details')).toEqual([
      {
        id: 'race-detail-2',
        label: 'Trance',
        description: 'New detail',
        sort_order: 1
      }
    ])
    expect(db.snapshot('race_speeds')).toEqual([
      {
        race_id: 'race-1',
        speed_id: 'walk',
        amount: 35,
        unit_code: 'FEET'
      },
      {
        race_id: 'race-1',
        speed_id: 'fly',
        amount: 20,
        unit_code: 'FEET'
      }
    ])
    expect(db.snapshot('race_heritages')).toEqual([
      {
        race_id: 'race-1',
        heritage_id: 'heritage-elven',
        sort_order: 1
      },
      {
        race_id: 'race-1',
        heritage_id: 'heritage-fey',
        sort_order: 2
      }
    ])
    expect(db.snapshot('race_ancestries')).toEqual([
      {
        id: 'race-ancestry-2',
        race_id: 'race-1',
        label: 'Draconic',
        description: 'Choose a color.'
      }
    ])
    expect(db.snapshot('race_ancestry_options')).toEqual([
      {
        id: 'race-ancestry-option-2',
        ancestry_id: 'race-ancestry-2',
        label: 'Blue',
        description: 'Lightning lineage.',
        sort_order: 1
      }
    ])
  })
  it('rewrites supported equipment rows idempotently and clears stale child rows', async () => {
    const db = new InMemoryDb()
    const repository = createEquipmentRepository(db as never)
    await repository.upsert({
      kind: 'EQUIPMENT',
      id: 'equipment-1',
      label: 'Longsword',
      description: 'Original',
      cost: { amount: 15, currencyId: 'gp' },
      weight: { amount: 3, unit: 'POUNDS' },
      attributes: ['LIMITED_USE'],
      charges: {
        id: 'equipment-charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      },
      rarityId: 'common',
      userId: 'user-1',
      systemId: 'system-1',
      properties: ['MARTIAL'],
      category: 'WEAPON',
      contains: [{ equipmentId: 'sheath-1', quantity: 1 }]
    })
    await repository.upsert({
      kind: 'EQUIPMENT',
      id: 'equipment-1',
      label: 'Longsword',
      description: 'Updated',
      cost: { amount: 20, currencyId: 'gp' },
      weight: { amount: 4, unit: 'POUNDS' },
      rarityId: 'common',
      userId: 'user-1',
      systemId: 'system-1',
      properties: ['VERSATILE'],
      category: 'WEAPON',
      contains: [{ equipmentId: 'sheath-2', quantity: 1 }],
      charges: {
        id: 'equipment-charge-2',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2
      }
    })
    await expect(repository.findById('equipment-1')).resolves.toEqual({
      kind: 'EQUIPMENT',
      id: 'equipment-1',
      label: 'Longsword',
      description: 'Updated',
      status: 'DRAFT',
      attributes: undefined,
      quote: undefined,
      cost: { amount: 20, currencyId: 'gp' },
      weight: { amount: 4, unit: 'POUNDS' },
      effects: undefined,
      charges: {
        id: 'equipment-charge-2',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2,
        bonuses: undefined
      },
      capacity: undefined,
      modifiers: undefined,
      maxStack: undefined,
      rarityId: 'common',
      maxBonus: undefined,
      armorClass: undefined,
      contains: [{ equipmentId: 'sheath-2', quantity: 1 }],
      features: undefined,
      restrictions: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      properties: ['VERSATILE'],
      category: 'WEAPON'
    })
    expect(db.snapshot('equipment_attributes')).toEqual([])
    expect(db.snapshot('equipment_properties')).toEqual([
      {
        equipment_id: 'equipment-1',
        property_code: 'VERSATILE',
        sort_order: 1
      }
    ])
    expect(db.snapshot('equipment_contains')).toEqual([
      {
        equipment_id: 'equipment-1',
        contained_equipment_id: 'sheath-2',
        quantity: 1,
        sort_order: 1
      }
    ])
    expect(db.snapshot('charges')).toEqual([
      {
        id: 'equipment-charge-2',
        scaling_kind: 'NONE',
        reset_kind: 'SHORT_REST'
      }
    ])
  })
  it('round-trips equipment variants and clears stale base-only rows when switching categories', async () => {
    const db = new InMemoryDb()
    const repository = createEquipmentRepository(db as never)
    await repository.upsert({
      kind: 'EQUIPMENT',
      id: 'equipment-variant-1',
      label: 'Longsword',
      description: 'Base item',
      cost: { amount: 15, currencyId: 'gp' },
      weight: { amount: 3, unit: 'POUNDS' },
      rarityId: 'common',
      userId: 'user-1',
      systemId: 'system-1',
      properties: ['MARTIAL'],
      category: 'WEAPON'
    })
    await repository.upsert({
      kind: 'EQUIPMENT',
      id: 'equipment-variant-1',
      label: 'Flame Tongue Longsword',
      description: 'Variant item',
      rarityId: 'rare',
      userId: 'user-1',
      systemId: 'system-1',
      category: 'VARIANT',
      parentEquipmentId: 'equipment-parent-1',
      requiresAttunement: true,
      properties: ['MAGIC']
    })
    await expect(repository.findById('equipment-variant-1')).resolves.toEqual({
      kind: 'EQUIPMENT',
      id: 'equipment-variant-1',
      label: 'Flame Tongue Longsword',
      description: 'Variant item',
      quote: undefined,
      effects: undefined,
      charges: undefined,
      modifiers: undefined,
      rarityId: 'rare',
      maxBonus: undefined,
      features: undefined,
      restrictions: undefined,
      requiresAttunement: true,
      status: 'DRAFT',
      userId: 'user-1',
      systemId: 'system-1',
      category: 'VARIANT',
      parentEquipmentId: 'equipment-parent-1',
      properties: ['MAGIC']
    })
    expect(db.snapshot('equipment')).toEqual([
      {
        id: 'equipment-variant-1',
        system_id: 'system-1',
        user_id: 'user-1',
        label: 'Flame Tongue Longsword',
        description: 'Variant item',
        quote: null,
        category: 'VARIANT',
        rarity_id: 'rare',
        cost_amount: null,
        cost_currency_id: null,
        weight_amount: null,
        weight_unit: null,
        capacity_amount: null,
        capacity_unit: null,
        max_stack: null,
        max_bonus: null,
        armor_class: null,
        requires_attunement: true,
        charge_id: null,
        restriction_id: null,
        status: 'DRAFT',
        parent_equipment_id: 'equipment-parent-1'
      }
    ])
    expect(db.snapshot('equipment_properties')).toEqual([
      {
        equipment_id: 'equipment-variant-1',
        property_code: 'MAGIC',
        sort_order: 1
      }
    ])
  })
  it('rewrites feature-owned options idempotently and removes stale owned option rows', async () => {
    const db = new InMemoryDb()
    const repository = createFeatureRepository(db as never, 'system-1')
    await repository.upsert({
      id: 'feature-1',
      label: 'Fighting Style',
      description: 'Original feature',
      attributes: ['LIMITED_USE'],
      order: 1,
      optionChoices: [
        {
          level: 2,
          count: 1
        }
      ],
      options: [
        {
          id: 'option-1',
          label: 'Defense',
          description: 'Original option',
          order: 1
        }
      ]
    })
    await repository.upsert({
      id: 'feature-1',
      label: 'Fighting Style',
      description: 'Updated feature',
      attributes: ['HIDDEN_ON_SHEET'],
      order: 2,
      optionChoices: [
        {
          level: 4,
          count: 2,
          replaceCount: 1
        }
      ],
      options: [
        {
          id: 'option-2',
          label: 'Dueling',
          description: 'Updated option',
          order: 1,
          attributes: ['LIMITED_USE']
        }
      ]
    })
    await expect(repository.findById('feature-1')).resolves.toEqual({
      id: 'feature-1',
      label: 'Fighting Style',
      description: 'Updated feature',
      attributes: ['HIDDEN_ON_SHEET'],
      details: undefined,
      effects: undefined,
      charges: undefined,
      grants: undefined,
      restrictions: undefined,
      order: 2,
      availableAtLevel: undefined,
      optionChoices: [
        {
          level: 4,
          count: 2,
          replaceCount: 1
        }
      ],
      options: [
        {
          id: 'option-2',
          label: 'Dueling',
          description: 'Updated option',
          attributes: ['LIMITED_USE'],
          details: undefined,
          effects: undefined,
          charges: undefined,
          grants: undefined,
          restrictions: undefined,
          order: 1
        }
      ]
    })
    expect(db.snapshot('feature_attributes')).toEqual([
      {
        feature_id: 'feature-1',
        attribute_code: 'HIDDEN_ON_SHEET',
        sort_order: 1
      }
    ])
    expect(db.snapshot('feature_options')).toEqual([
      {
        feature_id: 'feature-1',
        option_id: 'option-2',
        sort_order: 1
      }
    ])
    expect(db.snapshot('feature_option_levels')).toEqual([
      {
        feature_id: 'feature-1',
        level: 4,
        count: 2,
        replace_count: 1,
        sort_order: 1
      }
    ])
    expect(db.snapshot('options')).toEqual([
      {
        id: 'option-2',
        label: 'Dueling',
        description: 'Updated option',
        sort_order: 1,
        charge_id: null,
        restriction_id: null
      }
    ])
  })
  it('rewrites feature-owned effects idempotently while preserving reused effect ids', async () => {
    const db = new InMemoryDb()
    const repository = createFeatureRepository(db as never, 'system-1')
    await repository.upsert({
      id: 'feature-effect-rewrite-1',
      label: 'Arcane Shield',
      description: 'Original feature',
      order: 1,
      effects: [
        {
          id: 'shared-effect-1',
          order: 1,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'shared-range-1',
              rangeKind: 'DISTANCE',
              amount: 30,
              unit: 'FEET'
            }
          },
          paths: [
            {
              id: 'shared-PATH_CODE-1',
              order: 1,
              pathCode: 'ON_HIT',
              groupType: 'SINGLE',
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: 'shared-PATH_CODE-1',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: 'shared-PATH_CODE-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'force',
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 5
                  }
                ]
              }
            }
          ]
        }
      ]
    })
    await repository.upsert({
      id: 'feature-effect-rewrite-1',
      label: 'Arcane Shield',
      description: 'Updated feature',
      order: 2,
      effects: [
        {
          id: 'shared-effect-1',
          order: 2,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'BONUS_ACTION',
              amount: 1
            },
            range: {
              id: 'shared-range-1',
              rangeKind: 'DISTANCE',
              amount: 60,
              unit: 'FEET'
            }
          },
          paths: [
            {
              id: 'shared-PATH_CODE-2',
              order: 1,
              pathCode: 'ON_HIT',
              groupType: 'SINGLE',
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: 'shared-PATH_CODE-2',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: 'shared-PATH_CODE-2',
                    effectKind: 'CONDITION',
                    conditionId: 'warded'
                  }
                ]
              }
            }
          ]
        }
      ]
    })
    await expect(repository.findById('feature-effect-rewrite-1')).resolves.toMatchObject({
      id: 'feature-effect-rewrite-1',
      label: 'Arcane Shield',
      description: 'Updated feature',
      attributes: undefined,
      details: undefined,
      effects: [
        {
          id: 'shared-effect-1',
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'BONUS_ACTION',
              amount: 1
            },
            range: {
              id: 'shared-range-1',
              rangeKind: 'DISTANCE',
              amount: 60,
              unit: 'FEET'
            }
          },
          paths: [
            {
              id: 'shared-PATH_CODE-2',
              order: 1,
              pathCode: 'ON_HIT',
              groupType: 'SINGLE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'shared-PATH_CODE-2',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'shared-PATH_CODE-2',
                    effectKind: 'CONDITION',
                    conditionId: 'warded'
                  }
                ]
              }
            }
          ]
        }
      ],
      charges: undefined,
      grants: undefined,
      restrictions: undefined,
      order: 2,
      availableAtLevel: undefined,
      optionChoices: undefined,
      options: undefined
    })
    expect(db.snapshot('effects')).toEqual([
      {
        id: 'shared-effect-1',
        sort_order: 2
      }
    ])
    expect(db.snapshot('effect_paths')).toEqual([
      {
        id: 'shared-PATH_CODE-2',
        effect_id: 'shared-effect-1',
        sort_order: 1,
        path_code: 'ON_HIT',
        group_type: 'SINGLE',
        selection_kind: 'FIXED',
        origin_kind: null,
        range_override_characteristic_id: null,
        target_selection_kind: null,
        target_disposition_kind: null,
        max_targets: null,
        max_targets_scaling: null,
        resolution_count: null,
        resolution_count_scaling: null,
        allow_repeated_targets: null,
        excluded_creature_type_ids: null,
        result_block_id: 'shared-PATH_CODE-2',
        roll_table_kind: null,
        die: null
      }
    ])
    expect(db.snapshot('effect_result_blocks')).toEqual([
      {
        id: 'shared-PATH_CODE-2',
        result_kind: 'SINGLE',
        duration_id: null,
        lifecycle_recurring_kind: null,
        lifecycle_consume_on_first_event: null,
        lifecycle_end_on_events: null
      }
    ])
    expect(db.snapshot('effect_result_block_outcomes')).toEqual([
      {
        result_block_id: 'shared-PATH_CODE-2',
        outcome_id: 'shared-PATH_CODE-2',
        effect_kind: 'CONDITION',
        sort_order: 1
      }
    ])
    expect(db.snapshot('damages')).toEqual([])
    expect(db.snapshot('conditions')).toEqual([
      {
        id: 'shared-PATH_CODE-2',
        condition_type_id: 'warded'
      }
    ])
    expect(db.snapshot('feature_effects')).toEqual([
      {
        feature_id: 'feature-effect-rewrite-1',
        effect_id: 'shared-effect-1',
        sort_order: 1
      }
    ])
  })
})

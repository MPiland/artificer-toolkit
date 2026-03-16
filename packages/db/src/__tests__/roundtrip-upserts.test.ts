import { describe, expect, it } from 'vitest'
import { createBackgroundRepository } from '../repositories/background.js'
import { createClassRepository } from '../repositories/class.js'
import { createEquipmentRepository } from '../repositories/equipment.js'
import { createFeatRepository } from '../repositories/feat.js'
import { createFeatGrantRepository } from '../repositories/feat-grant.js'
import { createFeatureRepository } from '../repositories/feature.js'
import { createModifierGrantRepository } from '../repositories/modifier-grant.js'
import { createProficiencyGrantRepository } from '../repositories/proficiency-grant.js'
import { createRaceRepository } from '../repositories/race.js'
import { createSpellGrantRepository } from '../repositories/spell-grant.js'
import { createSpellRepository } from '../repositories/spell.js'
import { createStartingEquipmentRepository } from '../repositories/starting-equipment.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

describe('round-trip upsert correctness', () => {
  it('rewrites modifier grant payloads idempotently without leaving stale child rows behind', async () => {
    const db = new InMemoryDb()
    const repository = createModifierGrantRepository(db as never, 'system-1')

    await repository.upsert({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL_BONUS',
      domain: {
        attackDomain: 'MELEE'
      },
      modifierKind: 'BONUS',
      scope: 'SOURCE',
      payload: {
        valueKind: 'ABILITY_MODIFIER',
        ability: 'STRENGTH',
        multiplier: 1
      }
    })

    await repository.upsert({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 2,
      selectionKind: 'CHOSEN',
      count: 1,
      valueDomainCode: 'CHARGE_LIMIT',
      domain: {},
      modifierKind: 'MODIFY_CHARGE_LIMIT',
      scope: 'GLOBAL',
      payload: {
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'PER_LEVEL',
        levels: [
          { id: 'modifier-level-1', level: 3, amount: 2 }
        ]
      }
    })

    await expect(repository.findById('modifier-1')).resolves.toEqual({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 2,
      selectionKind: 'CHOSEN',
      count: 1,
      valueDomainCode: 'CHARGE_LIMIT',
      domain: {},
      modifierKind: 'MODIFY_CHARGE_LIMIT',
      scope: 'GLOBAL',
      payload: {
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'PER_LEVEL',
        levels: [
          { id: 'modifier-level-1', level: 3, amount: 2 }
        ]
      }
    })

    expect(db.snapshot('modifier_grant_domain_params')).toEqual([])
    expect(db.snapshot('modifier_grant_payloads')).toEqual([
      {
        modifier_grant_id: 'modifier-1',
        modifier_kind: 'MODIFY_CHARGE_LIMIT',
        value_domain_code: 'CHARGE_LIMIT',
        numeric_value_kind: null,
        numeric_amount: null,
        numeric_multiplier: null,
        numeric_ability_code: null,
        numeric_skill_id: null,
        numeric_class_id: null,
        set_amount: null,
        charge_limit_kind: 'FIXED_AMOUNT',
        charge_scaling_kind: 'PER_LEVEL',
        charge_amount: null,
        charge_multiplier: null,
        charge_min: null,
        charge_max: null,
        dice: null,
        damage_type_id: null,
        condition_type_id: null,
        movement_mode_id: null,
        attribute_id: null,
        range_kind: null,
        duration_kind: null,
        shape_kind: null,
        reset_kind: null
      }
    ])
    expect(db.snapshot('modifier_grant_charge_levels')).toEqual([
      {
        id: 'modifier-level-1',
        modifier_grant_id: 'modifier-1',
        level: 3,
        amount: 2,
        sort_order: 1
      }
    ])
  })

  it('rewrites feat grant payload shape without leaving stale root or per-level rows behind', async () => {
    const db = new InMemoryDb()
    const repository = createFeatGrantRepository(db as never)

    await repository.upsert({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 2,
      featIds: ['feat-a', 'feat-b']
    })

    await expect(repository.findById('feat-grant-1')).resolves.toEqual({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 2,
      featIds: ['feat-a', 'feat-b'],
      charges: undefined
    })

    await repository.upsert({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [
          {
            id: 'feat-level-1',
            level: 3,
            order: 1,
            authoringModeKind: 'SELECTED',
            featIds: ['feat-c']
          }
        ]
      }
    })

    await expect(repository.findById('feat-grant-1')).resolves.toEqual({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        classId: undefined,
        levels: [
          {
            id: 'feat-level-1',
            level: 3,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: undefined,
            featIds: ['feat-c']
          }
        ]
      },
      charges: undefined
    })

    expect(db.snapshot('feat_grant_feats')).toEqual([])
    expect(db.snapshot('feat_grant_scaling_levels')).toEqual([
      {
        id: 'feat-level-1',
        feat_grant_id: 'feat-grant-1',
        level: 3,
        sort_order: 1,
        authoring_mode_kind: 'SELECTED',
        selection_count: null
      }
    ])
    expect(db.snapshot('feat_grant_scaling_level_feats')).toEqual([
      {
        scaling_level_id: 'feat-level-1',
        feat_id: 'feat-c'
      }
    ])
  })

  it('preserves multiple same-kind charge bonuses and rewrites stale charge children idempotently', async () => {
    const db = new InMemoryDb()
    const repository = createFeatGrantRepository(db as never)

    await repository.upsert({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 3,
        bonuses: [
          {
            id: 'charge-bonus-1',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-1',
            order: 1
          },
          {
            id: 'charge-bonus-2',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-2',
            order: 2
          }
        ]
      }
    })

    await expect(repository.findById('feat-grant-charge-1')).resolves.toEqual({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      featIds: undefined,
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 3,
        bonuses: [
          {
            id: 'charge-bonus-1',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-1',
            multiplier: undefined,
            min: undefined,
            max: undefined,
            order: 1
          },
          {
            id: 'charge-bonus-2',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-2',
            multiplier: undefined,
            min: undefined,
            max: undefined,
            order: 2
          }
        ]
      }
    })

    await repository.upsert({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 5,
        bonuses: [
          {
            id: 'charge-bonus-3',
            bonusKind: 'PROFICIENCY_BONUS',
            order: 1
          }
        ]
      }
    })

    await expect(repository.findById('feat-grant-charge-1')).resolves.toEqual({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      featIds: undefined,
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 5,
        bonuses: [
          {
            id: 'charge-bonus-3',
            bonusKind: 'PROFICIENCY_BONUS',
            multiplier: undefined,
            min: undefined,
            max: undefined,
            order: 1
          }
        ]
      }
    })

    expect(db.snapshot('charge_limits')).toEqual([
      {
        charge_id: 'charge-1',
        limit_kind: 'FIXED_AMOUNT',
        class_id: null,
        amount: 5,
        multiplier: null,
        min: null,
        max: null
      }
    ])
    expect(db.snapshot('charge_bonuses')).toEqual([
      {
        id: 'charge-bonus-3',
        charge_id: 'charge-1',
        bonus_kind: 'PROFICIENCY_BONUS',
        ability_code: null,
        skill_id: null,
        multiplier: null,
        min: null,
        max: null,
        sort_order: 1
      }
    ])
  })

  it('switches proficiency grant kinds idempotently and clears stale child rows', async () => {
    const db = new InMemoryDb()
    const repository = createProficiencyGrantRepository(db as never)

    await repository.upsert({
      id: 'proficiency-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-1'],
      level: 'FULL'
    })

    await repository.upsert({
      id: 'proficiency-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      order: 2,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 1,
      properties: ['LIGHT'],
      category: 'WEAPON',
      level: 'HALF',
      rounding: 'UP'
    })

    await expect(repository.findById('proficiency-1')).resolves.toEqual({
      id: 'proficiency-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      order: 2,
      selectionKind: 'CHOSEN',
      authoringModeKind: 'SELECTED',
      level: 'HALF',
      rounding: 'UP',
      count: 1,
      properties: ['LIGHT'],
      category: 'WEAPON'
    })

    expect(db.snapshot('proficiency_grant_skills')).toEqual([])
    expect(db.snapshot('proficiency_grant_equipment_properties')).toEqual([
      {
        proficiency_grant_id: 'proficiency-1',
        property_code: 'LIGHT'
      }
    ])
    expect(db.snapshot('proficiency_grant_equipment_property_filters')).toEqual([
      {
        proficiency_grant_id: 'proficiency-1',
        category_code: 'WEAPON'
      }
    ])
  })

  it('replaces starting equipment trees instead of accumulating stale nested rows', async () => {
    const db = new InMemoryDb()
    const repository = createStartingEquipmentRepository(db as never)

    await repository.upsert({
      id: 'starting-equipment-1',
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
                      id: 'currency-item-1',
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
    })

    await repository.upsert({
      id: 'starting-equipment-1',
      sets: [
        {
          id: 'set-2',
          order: 1,
          groups: [
            {
              id: 'group-2',
              order: 1,
              options: [
                {
                  id: 'option-2',
                  order: 1,
                  items: [
                    {
                      id: 'equipment-item-1',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      authoringModeKind: 'SELECTED',
                      selectionKind: 'GRANTED',
                      quantity: 1,
                      equipmentIds: ['equipment-1'],
                      properties: ['LIGHT'],
                      category: 'WEAPON'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })

    await expect(repository.findById('starting-equipment-1')).resolves.toEqual({
      id: 'starting-equipment-1',
      sets: [
        {
          id: 'set-2',
          order: 1,
          groups: [
            {
              id: 'group-2',
              order: 1,
              options: [
                {
                  id: 'option-2',
                  order: 1,
                  items: [
                    {
                      id: 'equipment-item-1',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      authoringModeKind: 'SELECTED',
                      selectionKind: 'GRANTED',
                      quantity: 1,
                      equipmentIds: ['equipment-1'],
                      properties: ['LIGHT'],
                      category: 'WEAPON'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })

    expect(db.snapshot('starting_equipment_sets')).toEqual([
      {
        id: 'set-2',
        starting_equipment_id: 'starting-equipment-1',
        sort_order: 1
      }
    ])
    expect(db.snapshot('starting_equipment_currencies')).toEqual([])
    expect(db.snapshot('starting_equipment_option_item_equipment')).toEqual([
      {
        option_item_id: 'equipment-item-1',
        equipment_id: 'equipment-1'
      }
    ])
  })

  it('round-trips a background through composed owned upserts and cleans replaced owned content', async () => {
    const db = new InMemoryDb()
    const repository = createBackgroundRepository(db as never)

    await repository.upsert({
      kind: 'BACKGROUND',
      id: 'background-1',
      label: 'Scholar',
      description: 'Original background',
      details: [
        {
          id: 'detail-1',
          label: 'Lore',
          description: 'Old detail',
          order: 1
        }
      ],
      startingEquipment: {
        id: 'background-se-1',
        sets: [
          {
            id: 'se-set-1',
            order: 1,
            groups: [
              {
                id: 'se-group-1',
                order: 1,
                options: [
                  {
                    id: 'se-option-1',
                    order: 1,
                    items: [
                      {
                        id: 'se-currency-1',
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
          id: 'background-grant-1',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SKILL',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          skillIds: ['history'],
          level: 'FULL'
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await repository.upsert({
      kind: 'BACKGROUND',
      id: 'background-1',
      label: 'Scholar',
      description: 'Updated background',
      details: [
        {
          id: 'detail-2',
          label: 'Research',
          description: 'New detail',
          order: 1
        }
      ],
      startingEquipment: {
        id: 'background-se-2',
        sets: [
          {
            id: 'se-set-2',
            order: 1,
            groups: [
              {
                id: 'se-group-2',
                order: 1,
                options: [
                  {
                    id: 'se-option-2',
                    order: 1,
                    items: [
                      {
                        id: 'se-equipment-1',
                        order: 1,
                        startingEquipmentKind: 'EQUIPMENT',
                        authoringModeKind: 'ALL',
                        selectionKind: 'GRANTED',
                        quantity: 1,
                        category: 'WEAPON'
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
          id: 'background-grant-2',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'LANGUAGE',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          languageIds: ['elvish'],
          level: 'FULL'
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await expect(repository.findById('background-1')).resolves.toEqual({
      kind: 'BACKGROUND',
      id: 'background-1',
      label: 'Scholar',
      description: 'Updated background',
      details: [
        {
          id: 'detail-2',
          label: 'Research',
          description: 'New detail',
          order: 1
        }
      ],
      startingEquipment: {
        id: 'background-se-2',
        sets: [
          {
            id: 'se-set-2',
            order: 1,
            groups: [
              {
                id: 'se-group-2',
                order: 1,
                options: [
                  {
                    id: 'se-option-2',
                    order: 1,
                    items: [
                      {
                        id: 'se-equipment-1',
                        order: 1,
                        startingEquipmentKind: 'EQUIPMENT',
                        authoringModeKind: 'ALL',
                        selectionKind: 'GRANTED',
                        quantity: 1,
                        category: 'WEAPON',
                        properties: undefined
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
          id: 'background-grant-2',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'LANGUAGE',
          order: 1,
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          level: 'FULL',
          rounding: undefined,
          count: undefined,
          languageIds: ['elvish']
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(db.snapshot('details')).toEqual([
      {
        id: 'detail-2',
        label: 'Research',
        description: 'New detail',
        sort_order: 1
      }
    ])
    expect(db.snapshot('proficiency_grants')).toEqual([
      {
        id: 'background-grant-2',
        sort_order: 1,
        proficiency_kind: 'LANGUAGE',
        selection_kind: 'GRANTED',
        authoring_mode_kind: 'SELECTED',
        count: null,
        level: 'FULL',
        rounding: null,
        restriction_id: null
      }
    ])
    expect(db.snapshot('starting_equipment')).toEqual([
      {
        id: 'background-se-2'
      }
    ])
  })

  it('round-trips a feat through supported owned grants and replaces stale owned rows', async () => {
    const db = new InMemoryDb()
    const repository = createFeatRepository(db as never)

    await repository.upsert({
      id: 'feat-1',
      label: 'Arcane Initiate',
      description: 'Original feat',
      detail: 'Original detail',
      charges: {
        id: 'feat-charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      },
      grants: {
        proficiencies: [
          {
            id: 'feat-prof-1',
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'SKILL',
            order: 1,
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            skillIds: ['arcana'],
            level: 'FULL'
          }
        ],
        senses: [
          {
            id: 'feat-sense-1',
            grantKind: 'SENSE_GRANT',
            order: 2,
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            senseIds: ['darkvision']
          }
        ]
      },
      userId: 'user-1',
      systemId: 'system-1'
    })

    await repository.upsert({
      id: 'feat-1',
      label: 'Arcane Initiate',
      description: 'Updated feat',
      detail: 'Updated detail',
      charges: {
        id: 'feat-charge-2',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2
      },
      grants: {
        spells: [
          {
            id: 'feat-spell-1',
            grantKind: 'SPELL_GRANT',
            order: 1,
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            spellIds: ['magic-missile'],
            attributes: ['CAST_AT_LEVEL'],
            castAtLevel: 1
          }
        ]
      },
      userId: 'user-1',
      systemId: 'system-1'
    })

    await expect(repository.findById('feat-1')).resolves.toEqual({
      id: 'feat-1',
      label: 'Arcane Initiate',
      description: 'Updated feat',
      detail: 'Updated detail',
      charges: {
        id: 'feat-charge-2',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2
      },
      grants: {
        modifiers: undefined,
        proficiencies: undefined,
        senses: undefined,
        spells: [
          {
            id: 'feat-spell-1',
            grantKind: 'SPELL_GRANT',
            order: 1,
            attributes: ['CAST_AT_LEVEL'],
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            count: undefined,
            spellIds: ['magic-missile'],
            castAtLevel: 1,
            charges: undefined
          }
        ]
      },
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(db.snapshot('charges')).toEqual([
      {
        id: 'feat-charge-2',
        scaling_kind: 'NONE',
        reset_kind: 'SHORT_REST'
      }
    ])
    expect(db.snapshot('feat_proficiency_grants')).toEqual([])
    expect(db.snapshot('feat_sense_grants')).toEqual([])
    expect(db.snapshot('feat_spell_grants')).toEqual([
      {
        feat_id: 'feat-1',
        spell_grant_id: 'feat-spell-1',
        sort_order: 1
      }
    ])
    expect(db.snapshot('proficiency_grants')).toEqual([])
    expect(db.snapshot('sense_grants')).toEqual([])
    expect(db.snapshot('spell_grants')).toEqual([
      {
        id: 'feat-spell-1',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'SELECTED',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: null,
        restriction_id: null,
        filter_id: null,
        cast_at_level: 1
      }
    ])
    expect(db.snapshot('spell_grant_attributes')).toEqual([
      {
        spell_grant_id: 'feat-spell-1',
        attribute_code: 'CAST_AT_LEVEL',
        sort_order: 1
      }
    ])
  })

  it('rewrites spell grant attributes explicitly and clears stale attribute rows', async () => {
    const db = new InMemoryDb()
    const repository = createSpellGrantRepository(db as never)

    await repository.upsert({
      id: 'spell-grant-attributes-1',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      attributes: ['LIMITED_USE'],
      charges: {
        id: 'spell-grant-attributes-charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    })

    await repository.upsert({
      id: 'spell-grant-attributes-1',
      grantKind: 'SPELL_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      attributes: ['CAST_AT_WILL', 'CAST_AT_LEVEL', 'SELF_ONLY'],
      castAtLevel: 3
    })

    await expect(repository.findById('spell-grant-attributes-1')).resolves.toEqual({
      id: 'spell-grant-attributes-1',
      grantKind: 'SPELL_GRANT',
      order: 2,
      castAtLevel: 3,
      attributes: ['CAST_AT_WILL', 'CAST_AT_LEVEL', 'SELF_ONLY'],
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: undefined,
      spellIds: undefined,
      charges: undefined,
      filters: undefined,
      restrictions: undefined
    })

    expect(db.snapshot('spell_grant_attributes')).toEqual([
      {
        spell_grant_id: 'spell-grant-attributes-1',
        attribute_code: 'CAST_AT_WILL',
        sort_order: 1
      },
      {
        spell_grant_id: 'spell-grant-attributes-1',
        attribute_code: 'CAST_AT_LEVEL',
        sort_order: 2
      },
      {
        spell_grant_id: 'spell-grant-attributes-1',
        attribute_code: 'SELF_ONLY',
        sort_order: 3
      }
    ])
    expect(db.snapshot('charges')).toEqual([])
  })

  it('rewrites spell class and attribute rows idempotently without leaving stale links behind', async () => {
    const db = new InMemoryDb()
    const repository = createSpellRepository(db as never)

    await repository.upsert({
      kind: 'SPELL',
      id: 'spell-1',
      label: 'Magic Missile',
      description: 'Original spell',
      attributes: ['RITUAL'],
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard', 'sorcerer'],
      magicSchoolId: 'evocation',
      materialDescription: 'A sliver of glass.',
      userId: 'user-1',
      systemId: 'system-1'
    })

    await repository.upsert({
      kind: 'SPELL',
      id: 'spell-1',
      label: 'Magic Missile',
      description: 'Updated spell',
      attributes: ['CONCENTRATION', 'ADDS_TO_WEAPON_ATTACK'],
      castingTime: {
        unit: 'MINUTE',
        amount: 10
      },
      level: 2,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      userId: 'user-1',
      systemId: 'system-1'
    })

    await expect(repository.findById('spell-1')).resolves.toEqual({
      kind: 'SPELL',
      id: 'spell-1',
      label: 'Magic Missile',
      description: 'Updated spell',
      attributes: ['CONCENTRATION', 'ADDS_TO_WEAPON_ATTACK'],
      castingTime: {
        unit: 'MINUTE',
        amount: 10
      },
      level: 2,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: undefined,
      materialDescription: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(db.snapshot('spell_attributes')).toEqual([
      {
        spell_id: 'spell-1',
        attribute_code: 'CONCENTRATION',
        sort_order: 1
      },
      {
        spell_id: 'spell-1',
        attribute_code: 'ADDS_TO_WEAPON_ATTACK',
        sort_order: 2
      }
    ])
    expect(db.snapshot('spell_classes')).toEqual([
      {
        spell_id: 'spell-1',
        class_id: 'wizard'
      }
    ])
  })

  it('rewrites spell-owned effects idempotently while preserving reused effect ids', async () => {
    const db = new InMemoryDb()
    const repository = createSpellRepository(db as never)

    await repository.upsert({
      kind: 'SPELL',
      id: 'spell-effect-rewrite-1',
      label: 'Thunder Burst',
      description: 'Original spell',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'spell-shared-effect-1',
          order: 1,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'spell-effect-range-1',
              rangeKind: 'DISTANCE',
              amount: 60,
              unit: 'FEET'
            }
          },
          moments: [
            {
              id: 'spell-effect-moment-1',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              effectKind: 'DAMAGE',
              damageTypeId: 'thunder',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 5
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await repository.upsert({
      kind: 'SPELL',
      id: 'spell-effect-rewrite-1',
      label: 'Thunder Burst',
      description: 'Updated spell',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'spell-shared-effect-1',
          order: 2,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'BONUS_ACTION',
              amount: 1
            },
            range: {
              id: 'spell-effect-range-1',
              rangeKind: 'DISTANCE',
              amount: 120,
              unit: 'FEET'
            }
          },
          moments: [
            {
              id: 'spell-effect-moment-2',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              effectKind: 'CONDITION',
              conditionId: 'deafened'
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await expect(repository.findById('spell-effect-rewrite-1')).resolves.toEqual({
      kind: 'SPELL',
      id: 'spell-effect-rewrite-1',
      label: 'Thunder Burst',
      description: 'Updated spell',
      attributes: undefined,
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'spell-shared-effect-1',
          order: 2,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'BONUS_ACTION',
              amount: 1
            },
            range: {
              id: 'spell-effect-range-1',
              rangeKind: 'DISTANCE',
              amount: 120,
              unit: 'FEET'
            },
            shape: undefined
          },
          moments: [
            {
              id: 'spell-effect-moment-2',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              duration: undefined,
              effectKind: 'CONDITION',
              conditionId: 'deafened'
            }
          ]
        }
      ],
      materialDescription: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(db.snapshot('spell_effects')).toEqual([
      {
        spell_id: 'spell-effect-rewrite-1',
        effect_id: 'spell-shared-effect-1',
        sort_order: 1
      }
    ])
    expect(db.snapshot('damages')).toEqual([])
    expect(db.snapshot('conditions')).toEqual([
      {
        id: 'spell-effect-moment-2',
        condition_type_id: 'deafened'
      }
    ])
  })

  it('round-trips a race through supported details and speeds while clearing stale owned rows', async () => {
    const db = new InMemoryDb()
    const repository = createRaceRepository(db as never)

    await repository.upsert({
      id: 'race-1',
      label: 'Elf',
      quote: 'Graceful.',
      description: 'Original race',
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
      playable: true,
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
      playable: true,
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
      playable: true,
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
      abilities: [
        {
          op: 'ADD',
          abilities: [{ ability: 'STRENGTH' }]
        }
      ],
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
      abilities: [
        {
          op: 'SET',
          abilities: [{ ability: 'DEXTERITY' }]
        }
      ],
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
        amount: 2
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
      category: 'WEAPON',
      abilities: [
        {
          op: 'SET',
          abilities: [{ ability: 'DEXTERITY' }]
        }
      ]
    })

    expect(db.snapshot('equipment_attributes')).toEqual([])
    expect(db.snapshot('equipment_properties')).toEqual([
      {
        equipment_id: 'equipment-1',
        property_code: 'VERSATILE'
      }
    ])
    expect(db.snapshot('equipment_contains')).toEqual([
      {
        equipment_id: 'equipment-1',
        contained_equipment_id: 'sheath-2',
        quantity: 1
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
      category: 'WEAPON',
      abilities: [
        {
          op: 'ADD',
          abilities: [{ ability: 'STRENGTH' }]
        }
      ]
    })

    await repository.upsert({
      kind: 'EQUIPMENT',
      id: 'equipment-variant-1',
      label: 'Flame Tongue Longsword',
      description: 'Variant item',
      cost: { amount: 1500, currencyId: 'gp' },
      weight: { amount: 3, unit: 'POUNDS' },
      rarityId: 'rare',
      userId: 'user-1',
      systemId: 'system-1',
      category: 'VARIANT',
      parentEquipmentId: 'equipment-parent-1'
    })

    await expect(repository.findById('equipment-variant-1')).resolves.toEqual({
      kind: 'EQUIPMENT',
      id: 'equipment-variant-1',
      label: 'Flame Tongue Longsword',
      description: 'Variant item',
      attributes: undefined,
      quote: undefined,
      cost: { amount: 1500, currencyId: 'gp' },
      weight: { amount: 3, unit: 'POUNDS' },
      effects: undefined,
      charges: undefined,
      capacity: undefined,
      modifiers: undefined,
      maxStack: undefined,
      rarityId: 'rare',
      maxBonus: undefined,
      armorClass: undefined,
      contains: undefined,
      features: undefined,
      restrictions: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'VARIANT',
      parentEquipmentId: 'equipment-parent-1'
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
        cost_amount: 1500,
        cost_currency_id: 'gp',
        weight_amount: 3,
        weight_unit: 'POUNDS',
        capacity_amount: null,
        capacity_unit: null,
        max_stack: null,
        max_bonus: null,
        armor_class: null,
        charge_id: null,
        restriction_id: null,
        parent_equipment_id: 'equipment-parent-1'
      }
    ])
    expect(db.snapshot('equipment_properties')).toEqual([])
    expect(db.snapshot('equipment_abilities')).toEqual([])
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
      detail: undefined,
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
          detail: undefined,
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
        detail: null,
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
          moments: [
            {
              id: 'shared-moment-1',
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
          moments: [
            {
              id: 'shared-moment-2',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              effectKind: 'CONDITION',
              conditionId: 'warded'
            }
          ]
        }
      ]
    })

    await expect(repository.findById('feature-effect-rewrite-1')).resolves.toEqual({
      id: 'feature-effect-rewrite-1',
      label: 'Arcane Shield',
      description: 'Updated feature',
      attributes: undefined,
      detail: undefined,
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
            },
            shape: undefined
          },
          moments: [
            {
              id: 'shared-moment-2',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              duration: undefined,
              effectKind: 'CONDITION',
              conditionId: 'warded'
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
    expect(db.snapshot('effect_moments')).toEqual([
      {
        id: 'shared-moment-2',
        effect_id: 'shared-effect-1',
        trigger_code: 'SPELL_ATTACK',
        moment_code: 'ON_HIT',
        group_type: 'SINGLE',
        resolution_kind: 'DIRECT',
        duration_id: null,
        roll_table_kind: null,
        die: null
      }
    ])
    expect(db.snapshot('damages')).toEqual([])
    expect(db.snapshot('conditions')).toEqual([
      {
        id: 'shared-moment-2',
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

  it('rewrites feat-owned features idempotently and removes stale linked feature rows', async () => {
    const db = new InMemoryDb()
    const repository = createFeatRepository(db as never)

    await repository.upsert({
      id: 'feat-feature-1',
      label: 'Martial Adept',
      description: 'Original feat',
      features: [
        {
          id: 'feature-a',
          label: 'Opening Strike',
          description: 'Original feature',
          order: 1
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await repository.upsert({
      id: 'feat-feature-1',
      label: 'Martial Adept',
      description: 'Updated feat',
      features: [
        {
          id: 'feature-b',
          label: 'Closing Strike',
          description: 'Updated feature',
          order: 1,
          attributes: ['LIMITED_USE']
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await expect(repository.findById('feat-feature-1')).resolves.toEqual({
      id: 'feat-feature-1',
      label: 'Martial Adept',
      description: 'Updated feat',
      detail: undefined,
      charges: undefined,
      features: [
        {
          id: 'feature-b',
          label: 'Closing Strike',
          description: 'Updated feature',
          attributes: ['LIMITED_USE'],
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
      grants: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(db.snapshot('feat_features')).toEqual([
      {
        feat_id: 'feat-feature-1',
        feature_id: 'feature-b',
        sort_order: 1
      }
    ])
    expect(db.snapshot('features')).toEqual([
      {
        id: 'feature-b',
        label: 'Closing Strike',
        description: 'Updated feature',
        detail: null,
        charge_id: null,
        restriction_id: null,
        sort_order: 1,
        available_at_level: null
      }
    ])
    expect(db.snapshot('feature_attributes')).toEqual([
      {
        feature_id: 'feature-b',
        attribute_code: 'LIMITED_USE',
        sort_order: 1
      }
    ])
  })

  it('round-trips a base class and clears stale owned detail, proficiency, starting equipment, and multiclass rows', async () => {
    const db = new InMemoryDb()
    const repository = createClassRepository(db as never)

    await repository.upsert({
      id: 'class-1',
      label: 'Wizard',
      description: 'Original class',
      details: [
        {
          id: 'class-detail-1',
          label: 'Spellbook',
          description: 'Old detail',
          order: 1
        }
      ],
      proficiencies: [
        {
          id: 'class-grant-1',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SKILL',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          skillIds: ['arcana'],
          level: 'FULL'
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
          }
        ],
        magicName: 'Arcana',
        ability: 'INTELLIGENCE',
        maxSpellLevel: 9,
        attributes: ['PREPARES_SPELLS'],
        charges: {
          id: 'class-spellcharge-1',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        },
        prepareLimit: {
          methodKinds: ['CLASS_LEVEL'],
          scaling: 'FULL',
          perLevel: [{ classLevel: 1, amount: 4 }]
        }
      },
      resources: {
        id: 'class-resource-1',
        label: 'Arcane Recovery',
        description: 'Recover slots.',
        availableAtLevel: 1,
        charges: {
          id: 'class-resource-charge-1',
          resetKind: 'SHORT_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        }
      },
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
        id: 'class-se-1',
        sets: [
          {
            id: 'class-set-1',
            order: 1,
            groups: [
              {
                id: 'class-group-1',
                order: 1,
                options: [
                  {
                    id: 'class-option-1',
                    order: 1,
                    items: [
                      {
                        id: 'class-item-1',
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
        id: 'class-multiclass-1',
        requirementGroups: {
          groups: [
            {
              id: 'class-group-a',
              requirements: [
                {
                  id: 'class-req-1',
                  ability: 'INTELLIGENCE',
                  min: 13
                }
              ]
            }
          ]
        }
      }
    })

    await repository.upsert({
      id: 'class-1',
      label: 'Wizard',
      description: 'Updated class',
      details: [
        {
          id: 'class-detail-2',
          label: 'Arcane Recovery',
          description: 'New detail',
          order: 1
        }
      ],
      proficiencies: [
        {
          id: 'class-grant-2',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'LANGUAGE',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          languageIds: ['draconic'],
          level: 'FULL'
        }
      ],
      spellcasting: {
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }],
            learnedSpellsLimit: 6,
            preparedSpellsLimit: 5,
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
        ability: 'WISDOM',
        maxSpellLevel: 9,
        attributes: ['PREPARES_SPELLS', 'RITUAL_CASTER'],
        charges: {
          id: 'class-spellcharge-2',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 2
        },
        prepareLimit: {
          methodKinds: ['CLASS_LEVEL', 'PER_LEVEL'],
          scaling: 'FULL',
          perLevel: [
            { classLevel: 1, amount: 5 },
            { classLevel: 5, amount: 9 }
          ]
        }
      },
      resources: {
        id: 'class-resource-2',
        label: 'Arcane Ward',
        description: 'Protective reserve.',
        availableAtLevel: 2,
        charges: {
          id: 'class-resource-charge-2',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 3
        }
      },
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BASE',
      attributes: ['RESOURCE'],
      startingGold: {
        multiplier: 5,
        currencyId: 'gp',
        dieConfig: '5d4'
      },
      startingEquipment: {
        id: 'class-se-2',
        sets: [
          {
            id: 'class-set-2',
            order: 1,
            groups: [
              {
                id: 'class-group-2',
                order: 1,
                options: [
                  {
                    id: 'class-option-2',
                    order: 1,
                    items: [
                      {
                        id: 'class-item-2',
                        order: 1,
                        startingEquipmentKind: 'EQUIPMENT',
                        authoringModeKind: 'ALL',
                        selectionKind: 'GRANTED',
                        quantity: 1,
                        category: 'WEAPON'
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
        ability: 'WISDOM',
        dieConfig: '1d8'
      },
      multiclass: {
        id: 'class-multiclass-2',
        requirementGroups: {
          groups: [
            {
              id: 'class-group-b',
              requirements: [
                {
                  id: 'class-req-2',
                  ability: 'WISDOM',
                  min: 14
                }
              ]
            }
          ]
        },
        proficiencies: [
          {
            id: 'class-grant-3',
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'SKILL',
            order: 1,
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            skillIds: ['history'],
            level: 'FULL'
          }
        ]
      }
    })

    await expect(repository.findById('class-1')).resolves.toEqual({
      id: 'class-1',
      label: 'Wizard',
      description: 'Updated class',
      details: [
        {
          id: 'class-detail-2',
          label: 'Arcane Recovery',
          description: 'New detail',
          order: 1
        }
      ],
      proficiencies: [
        {
          id: 'class-grant-2',
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
      ],
      spellcasting: {
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }],
            learnedSpellsLimit: 6,
            preparedSpellsLimit: 5,
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
        ability: 'WISDOM',
        maxSpellLevel: 9,
        attributes: ['PREPARES_SPELLS', 'RITUAL_CASTER'],
        charges: {
          id: 'class-spellcharge-2',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 2
        },
        prepareLimit: {
          methodKinds: ['CLASS_LEVEL', 'PER_LEVEL'],
          scaling: 'FULL',
          rounding: undefined,
          perLevel: [
            { classLevel: 1, amount: 5 },
            { classLevel: 5, amount: 9 }
          ]
        }
      },
      resources: {
        id: 'class-resource-2',
        label: 'Arcane Ward',
        description: 'Protective reserve.',
        availableAtLevel: 2,
        charges: {
          id: 'class-resource-charge-2',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 3
        }
      },
      features: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BASE',
      attributes: ['RESOURCE'],
      startingGold: {
        multiplier: 5,
        currencyId: 'gp',
        dieConfig: '5d4'
      },
      startingEquipment: {
        id: 'class-se-2',
        sets: [
          {
            id: 'class-set-2',
            order: 1,
            groups: [
              {
                id: 'class-group-2',
                order: 1,
                options: [
                  {
                    id: 'class-option-2',
                    order: 1,
                    items: [
                      {
                        id: 'class-item-2',
                        order: 1,
                        startingEquipmentKind: 'EQUIPMENT',
                        authoringModeKind: 'ALL',
                        selectionKind: 'GRANTED',
                        quantity: 1,
                        category: 'WEAPON',
                        properties: undefined
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
        ability: 'WISDOM',
        dieConfig: '1d8'
      },
      multiclass: {
        id: 'class-multiclass-2',
        requirementGroups: {
          groups: [
            {
              id: 'class-group-b',
              requirements: [
                {
                  id: 'class-req-2',
                  ability: 'WISDOM',
                  min: 14
                }
              ]
            }
          ]
        },
        proficiencies: [
          {
            id: 'class-grant-3',
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'SKILL',
            order: 1,
            selectionKind: 'GRANTED',
            authoringModeKind: 'SELECTED',
            level: 'FULL',
            rounding: undefined,
            count: undefined,
            skillIds: ['history']
          }
        ]
      }
    })

    expect(db.snapshot('details')).toEqual([
      {
        id: 'class-detail-2',
        label: 'Arcane Recovery',
        description: 'New detail',
        sort_order: 1
      }
    ])
    expect(db.snapshot('proficiency_grants')).toEqual([
      {
        id: 'class-grant-2',
        sort_order: 1,
        proficiency_kind: 'LANGUAGE',
        selection_kind: 'GRANTED',
        authoring_mode_kind: 'SELECTED',
        count: null,
        level: 'FULL',
        rounding: null,
        restriction_id: null
      },
      {
        id: 'class-grant-3',
        sort_order: 1,
        proficiency_kind: 'SKILL',
        selection_kind: 'GRANTED',
        authoring_mode_kind: 'SELECTED',
        count: null,
        level: 'FULL',
        rounding: null,
        restriction_id: null
      }
    ])
    expect(db.snapshot('starting_equipment')).toEqual([
      {
        id: 'class-se-2'
      }
    ])
    expect(db.snapshot('class_resources')).toEqual([
      {
        id: 'class-resource-2',
        class_id: 'class-1',
        label: 'Arcane Ward',
        description: 'Protective reserve.',
        available_at_level: 2,
        charge_id: 'class-resource-charge-2'
      }
    ])
    expect(db.snapshot('class_spellcasting')).toEqual([
      {
        id: 'class-1::spellcasting',
        class_id: 'class-1',
        magic_name: 'Arcana',
        ability_code: 'WISDOM',
        max_spell_level: 9,
        charge_id: 'class-spellcharge-2'
      }
    ])
    expect(db.snapshot('class_multiclass')).toEqual([
      {
        id: 'class-multiclass-2',
        class_id: 'class-1'
      }
    ])
  })
})

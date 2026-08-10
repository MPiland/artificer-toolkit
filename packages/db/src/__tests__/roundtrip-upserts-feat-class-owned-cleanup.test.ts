import { describe, expect, it } from 'vitest'
import { createClassRepository } from '../repositories/index.js'
import { createFeatRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('round-trip upsert correctness', () => {
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
      status: 'DRAFT',
      details: undefined,
      prerequisites: undefined,
      effects: undefined,
      charges: undefined,
      features: [
        {
          id: 'feature-b',
          label: 'Closing Strike',
          description: 'Updated feature',
          attributes: ['LIMITED_USE'],
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
        charge_id: null,
        restriction_id: null,
        section_code: null,
        sort_order: 1,
        available_at_level: null,
        roll_definitions: []
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
        details: [
          {
            id: 'class-spell-detail-1',
            label: 'Preparing Spells',
            description: 'Old spellcasting detail',
            order: 1
          }
        ],
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
      subclassSelectionLevel: 2,
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
        availableAtLevel: 1,
        order: 0,
        attributes: ['PREPARES_SPELLS', 'RITUAL_CASTER'],
        details: [
          {
            id: 'class-spell-detail-2',
            label: 'Ritual Casting',
            description: 'New spellcasting detail',
            order: 1
          }
        ],
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
        order: 1,
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
      subclassSelectionLevel: 3,
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
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          level: 'FULL',
          rounding: undefined,
          count: undefined,
          selectionDuplicatePolicy: undefined,
          restrictions: undefined,
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
        availableAtLevel: 1,
        order: 0,
        attributes: ['PREPARES_SPELLS', 'RITUAL_CASTER'],
        details: [
          {
            id: 'class-spell-detail-2',
            label: 'Ritual Casting',
            description: 'New spellcasting detail',
            order: 1
          }
        ],
        charges: {
          id: 'class-spellcharge-2',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 2,
          bonuses: undefined
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
        order: 1,
        charges: {
          id: 'class-resource-charge-2',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 3,
          bonuses: undefined
        }
      },
      features: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      status: 'DRAFT',
      category: 'BASE',
      subclassSelectionLevel: 3,
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
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            level: 'FULL',
            rounding: undefined,
            count: undefined,
            selectionDuplicatePolicy: undefined,
            restrictions: undefined,
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
      },
      {
        id: 'class-spell-detail-2',
        label: 'Ritual Casting',
        description: 'New spellcasting detail',
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
        selection_duplicate_policy: null,
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
        selection_duplicate_policy: null,
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
        sort_order: 1,
        charge_id: 'class-resource-charge-2'
      }
    ])
    const classSpellcastingRows = db.snapshot('class_spellcasting')
    expect(classSpellcastingRows).toEqual([
      expect.objectContaining({
        class_id: 'class-1',
        magic_name: 'Arcana',
        ability_code: 'WISDOM',
        max_spell_level: 9,
        available_at_level: 1,
        sort_order: 0,
        charge_id: 'class-spellcharge-2'
      })
    ])
    expect(db.snapshot('class_spellcasting_details')).toEqual([
      {
        spellcasting_id: classSpellcastingRows[0].id,
        detail_id: 'class-spell-detail-2',
        sort_order: 1
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

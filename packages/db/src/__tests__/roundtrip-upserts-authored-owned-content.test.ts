import { describe, expect, it } from 'vitest'
import { createFeatRepository } from '../repositories/index.js'
import { createBackgroundRepository } from '../repositories/index.js'
import { createStartingEquipmentRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('round-trip upsert correctness', () => {
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
                  eligibility: {
                    id: 'option-1-eligibility',
                    groups: [
                      {
                        id: 'option-1-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'option-1-eligibility-context',
                            order: 1,
                            subject: 'CHARACTER',
                            conditions: [
                              {
                                id: 'option-1-eligibility-condition',
                                order: 1,
                                kind: 'PREDICATE',
                                constraint: 'INCLUDE',
                                predicateCode: 'CAN_CAST_SPELL'
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
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
                  eligibility: {
                    id: 'option-2-eligibility',
                    groups: [
                      {
                        id: 'option-2-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'option-2-eligibility-context',
                            order: 1,
                            subject: 'CHARACTER',
                            conditions: [
                              {
                                id: 'option-2-eligibility-condition',
                                order: 1,
                                kind: 'PREDICATE',
                                constraint: 'INCLUDE',
                                predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
                                authoringModeKind: 'SELECTED',
                                category: 'ARMOR',
                                properties: ['HEAVY']
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
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
                  eligibility: {
                    id: 'option-2-eligibility',
                    groups: [
                      {
                        id: 'option-2-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'option-2-eligibility-context',
                            order: 1,
                            subject: 'CHARACTER',
                            conditions: [
                              {
                                id: 'option-2-eligibility-condition',
                                order: 1,
                                kind: 'PREDICATE',
                                constraint: 'INCLUDE',
                                predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
                                authoringModeKind: 'SELECTED',
                                category: 'ARMOR',
                                properties: ['HEAVY']
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
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
    expect(db.snapshot('facets')).toEqual([{ id: 'option-2-eligibility' }])
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
      status: 'DRAFT',
      details: [
        {
          id: 'detail-2',
          label: 'Research',
          description: 'New detail',
          order: 1
        }
      ],
      features: undefined,
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
      status: 'DRAFT',
      details: [
        {
          id: 'detail-2',
          label: 'Research',
          description: 'New detail',
          order: 1
        }
      ],
      features: undefined,
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
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          level: 'FULL',
          rounding: undefined,
          count: undefined,
          selectionDuplicatePolicy: undefined,
          restrictions: undefined,
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
        selection_duplicate_policy: null,
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
      details: [
        {
          id: 'feat-detail-1',
          label: 'Detail',
          description: 'Original detail',
          order: 1
        }
      ],
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
      status: 'DRAFT',
      details: [
        {
          id: 'feat-detail-2',
          label: 'Detail',
          description: 'Updated detail',
          order: 1
        }
      ],
      charges: {
        id: 'feat-charge-2',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2
      },
      grants: {
        feats: [
          {
            id: 'feat-feat-grant-1',
            grantKind: 'FEAT_GRANT',
            order: 2,
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            featIds: ['grappler']
          }
        ],
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
            castAtLevel: 1,
            castingAbility: 'INTELLIGENCE'
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
      status: 'DRAFT',
      details: [
        {
          id: 'feat-detail-2',
          label: 'Detail',
          description: 'Updated detail',
          order: 1
        }
      ],
      prerequisites: undefined,
      effects: undefined,
      features: undefined,
      charges: {
        id: 'feat-charge-2',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2,
        bonuses: undefined
      },
      grants: {
        feats: [
          {
            id: 'feat-feat-grant-1',
            grantKind: 'FEAT_GRANT',
            order: 2,
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            featIds: ['grappler'],
            charges: undefined
          }
        ],
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
            castingAbility: 'INTELLIGENCE',
            charges: undefined,
            filters: undefined,
            restrictions: undefined
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
    expect(db.snapshot('feat_feat_grants')).toEqual([
      {
        feat_id: 'feat-1',
        feat_grant_id: 'feat-feat-grant-1',
        sort_order: 2
      }
    ])
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
        selection_duplicate_policy: null,
        scaling_source: null,
        class_id: null,
        charge_id: null,
        restriction_id: null,
        filter_id: null,
        cast_at_level: 1,
        casting_ability_code: 'INTELLIGENCE'
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
  it('round-trips feat, feature, and option details and clears empty detail arrays', async () => {
    const db = new InMemoryDb()
    const repository = createFeatRepository(db as never)
    await repository.upsert({
      id: 'feat-detail-roundtrip-1',
      label: 'Layered Feat',
      description: 'Has nested prose.',
      details: [
        {
          id: 'feat-detail-a',
          label: 'Feat Detail A',
          description: 'First feat detail.',
          order: 1
        },
        {
          id: 'feat-detail-b',
          label: 'Feat Detail B',
          description: 'Second feat detail.',
          order: 2
        }
      ],
      features: [
        {
          id: 'feature-detail-a',
          label: 'Layered Feature',
          description: 'Feature prose.',
          order: 1,
          details: [
            {
              id: 'feature-detail-a-1',
              label: 'Feature Detail A',
              description: 'First feature detail.',
              order: 1
            },
            {
              id: 'feature-detail-a-2',
              label: 'Feature Detail B',
              description: 'Second feature detail.',
              order: 2
            }
          ],
          options: [
            {
              id: 'option-detail-a',
              label: 'Layered Option',
              description: 'Option prose.',
              order: 1,
              details: [
                {
                  id: 'option-detail-a-1',
                  label: 'Option Detail A',
                  description: 'First option detail.',
                  order: 1
                },
                {
                  id: 'option-detail-a-2',
                  label: 'Option Detail B',
                  description: 'Second option detail.',
                  order: 2
                }
              ]
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })
    await expect(repository.findById('feat-detail-roundtrip-1')).resolves.toMatchObject({
      details: [
        { id: 'feat-detail-a', label: 'Feat Detail A' },
        { id: 'feat-detail-b', label: 'Feat Detail B' }
      ],
      features: [
        {
          details: [
            { id: 'feature-detail-a-1', label: 'Feature Detail A' },
            { id: 'feature-detail-a-2', label: 'Feature Detail B' }
          ],
          options: [
            {
              details: [
                { id: 'option-detail-a-1', label: 'Option Detail A' },
                { id: 'option-detail-a-2', label: 'Option Detail B' }
              ]
            }
          ]
        }
      ]
    })
    await repository.upsert({
      id: 'feat-detail-roundtrip-1',
      label: 'Layered Feat',
      description: 'Has nested prose.',
      details: [],
      features: [
        {
          id: 'feature-detail-a',
          label: 'Layered Feature',
          description: 'Feature prose.',
          order: 1,
          details: [],
          options: [
            {
              id: 'option-detail-a',
              label: 'Layered Option',
              description: 'Option prose.',
              order: 1,
              details: []
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })
    await expect(repository.findById('feat-detail-roundtrip-1')).resolves.toMatchObject({
      details: undefined,
      features: [
        {
          details: undefined,
          options: [
            {
              details: undefined
            }
          ]
        }
      ]
    })
    expect(db.snapshot('feat_details')).toEqual([])
    expect(db.snapshot('feature_details')).toEqual([])
    expect(db.snapshot('option_details')).toEqual([])
  })
})

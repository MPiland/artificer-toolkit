import { describe, expect, it } from 'vitest'

import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import { classAuthoredDtoSchema, classAuthoringInputDtoSchema } from '../subjects/class.js'
import { classPrepareLimitDtoSchema } from '../subjects/shared.js'

describe('class schema parsing', () => {
  it('parses starting equipment item unions with selected equipment choices', () => {
    const parsed = startingEquipmentDtoSchema.parse({
      id: 'fighter-start',
      sets: [
        {
          id: 'fighter-set',
          order: 1,
          groups: [
            {
              id: 'fighter-group',
              order: 1,
              options: [
                {
                  id: 'fighter-option',
                  order: 1,
                  eligibility: {
                    id: 'fighter-option-eligibility',
                    groups: [
                      {
                        id: 'fighter-option-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'fighter-option-eligibility-context',
                            order: 1,
                            subject: 'CHARACTER',
                            conditions: [
                              {
                                id: 'fighter-option-eligibility-condition',
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
                      id: 'martial-weapon-choice',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      category: 'WEAPON',
                      selectionKind: 'CHOSEN',
                      count: 1,
                      authoringModeKind: 'SELECTED',
                      equipmentIds: ['longsword', 'battleaxe']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })

    expect(parsed.sets[0]?.groups[0]?.options[0]?.items[0]?.startingEquipmentKind).toBe('EQUIPMENT')
    expect(
      parsed.sets[0]?.groups[0]?.options[0]?.eligibility?.groups[0]?.contexts[0]?.conditions?.[0]
    ).toMatchObject({
      predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
      category: 'ARMOR',
      properties: ['HEAVY']
    })
  })

  it('rejects non-character eligibility facets on starting equipment options', () => {
    const result = startingEquipmentDtoSchema.safeParse({
      id: 'invalid-starting-equipment',
      sets: [
        {
          id: 'invalid-set',
          order: 1,
          groups: [
            {
              id: 'invalid-group',
              order: 1,
              options: [
                {
                  id: 'invalid-option',
                  order: 1,
                  eligibility: {
                    id: 'invalid-eligibility',
                    groups: [
                      {
                        id: 'invalid-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'invalid-eligibility-context',
                            order: 1,
                            subject: 'CREATURE'
                          }
                        ]
                      }
                    ]
                  },
                  items: []
                }
              ]
            }
          ]
        }
      ]
    })

    expect(result.success).toBe(false)
  })

  it('parses a base class with nested authored substructures', () => {
    const parsed = classAuthoredDtoSchema.parse({
      id: 'wizard',
      category: 'BASE',
      label: 'Wizard',
      subclassSelectionLevel: 2,
      description: 'A scholarly spellcaster.',
      details: [
        {
          id: 'wizard-detail',
          label: 'Arcane Study',
          description: 'You study magic.',
          order: 1
        }
      ],
      proficiencies: [
        {
          grantKind: 'PROFICIENCY_GRANT',
          id: 'wizard-saves',
          order: 1,
          proficiencyKind: 'SAVE_ABILITY',
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          level: 'FULL',
          abilities: ['INTELLIGENCE', 'WISDOM'],
          authoringModeKind: 'SELECTED'
        }
      ],
      spellcasting: {
        availableSpellIds: ['spell-fire-bolt', 'spell-magic-missile'],
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }]
          }
        ],
        details: [
          {
            id: 'wizard-spellcasting-detail',
            label: 'Spellbook',
            description: 'Your spellbook contains wizard spells.',
            order: 1
          }
        ],
        maxSpellLevel: 9,
        charges: {
          id: 'wizard-casting-charge',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        }
      },
      features: [
        {
          id: 'arcane-recovery',
          label: 'Arcane Recovery',
          description: 'Recover spell energy.',
          order: 1
        }
      ],
      userId: 'user-1',
      systemId: 'system-1',
      startingGold: {
        multiplier: 4,
        currencyId: 'gp',
        dieConfig: '4d4'
      },
      startingEquipment: {
        id: 'wizard-start',
        sets: []
      },
      hitpoint: {
        dieConfig: '1d6'
      },
      multiclass: {
        id: 'wizard-multiclass',
        requirementGroups: {
          groups: [
            {
              id: 'wizard-req-group',
              requirements: [{ id: 'int-req', ability: 'INTELLIGENCE', min: 13 }]
            }
          ]
        }
      }
    }) as {
      category?: string
      subclassSelectionLevel?: number
      features?: Array<{ id?: string }>
      spellcasting?: { availableSpellIds?: string[]; details?: Array<{ label?: string }> }
    }

    expect(parsed.category).toBe('BASE')
    expect(parsed.subclassSelectionLevel).toBe(2)
    expect(parsed.features?.[0]?.id).toBe('arcane-recovery')
    expect(parsed.spellcasting?.details?.[0]?.label).toBe('Spellbook')
    expect(parsed.spellcasting?.availableSpellIds).toEqual([
      'spell-fire-bolt',
      'spell-magic-missile'
    ])
  })

  it('keeps class authoring attributes category-correct', () => {
    const input = {
      id: 'class-draft',
      label: 'Class Draft',
      systemId: 'system-1'
    }

    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'BASE',
        attributes: ['SPECIALIZATION']
      }).success
    ).toBe(false)

    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'SUBCLASS',
        attributes: ['SPECIALIZATION']
      }).success
    ).toBe(true)

    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'BASE',
        subclassSelectionLevel: 0
      }).success
    ).toBe(false)
    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'BASE',
        subclassSelectionLevel: 21
      }).success
    ).toBe(false)
    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'SUBCLASS',
        subclassSelectionLevel: 3
      }).success
    ).toBe(false)
  })

  it('rejects unknown class preparation-limit codes', () => {
    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['CLASS_LEVEL'],
        scaling: 'HALF',
        rounding: 'DOWN'
      }).success
    ).toBe(true)

    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['UNKNOWN']
      }).success
    ).toBe(false)
    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['CLASS_LEVEL'],
        scaling: 'UNKNOWN'
      }).success
    ).toBe(false)
    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['CLASS_LEVEL'],
        rounding: 'UNKNOWN'
      }).success
    ).toBe(false)
  })
})

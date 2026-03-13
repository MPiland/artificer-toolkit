import { describe, expect, it } from 'vitest'

import { chargeDtoSchema } from '../shared/charge.js'
import { effectDtoSchema } from '../effects/effect.js'
import { featureDtoSchema } from '../features/feature.js'
import { facetDtoSchema } from '../shared/facet.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import { backgroundListResponseDtoSchema, featureResponseDtoSchema } from '../api/content.js'
import { resourceIdParamsDtoSchema, systemAuthoredDtoSchema, systemListResponseDtoSchema } from '../index.js'
import { classAuthoredDtoSchema } from '../subjects/class.js'

describe('schema package parsing', () => {
  it('parses per-level charges with nested bonuses', () => {
    const parsed = chargeDtoSchema.parse({
      id: 'arcane-recovery',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'PER_LEVEL',
      bonuses: [
        {
          id: 'prof-bonus',
          bonusKind: 'PROFICIENCY_BONUS',
          multiplier: 1,
          order: 1
        }
      ],
      levels: [
        { id: 'level-1', level: 1, amount: 1 },
        { id: 'level-5', level: 5, amount: 2 }
      ]
    })

    expect(parsed.scalingKind).toBe('PER_LEVEL')
    if (parsed.scalingKind !== 'PER_LEVEL') {
      throw new Error('Expected PER_LEVEL charge payload')
    }

    expect(parsed.levels).toHaveLength(2)
  })

  it('parses effects with nested saving throw invocations and moments', () => {
    const parsed = effectDtoSchema.parse({
      id: 'burning-hands-effect',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'dex-save',
          savingThrowKind: 'FIXED_VALUE',
          ability: 'DEXTERITY',
          dc: 13
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'self-range',
          rangeKind: 'SELF'
        }
      },
      moments: [
        {
          id: 'burning-hands-direct',
          moment: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          effectKind: 'DAMAGE',
          damageTypeId: 'fire',
          valueKind: 'DICE',
          scalingKind: 'NONE',
          diceConfig: '3d6'
        }
      ]
    })

    expect(parsed.moments).toHaveLength(1)
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
  })

  it('parses features with nested grant groups and options', () => {
    const parsed = featureDtoSchema.parse({
      id: 'fighting-style',
      label: 'Fighting Style',
      description: 'Choose a style.',
      order: 1,
      grants: {
        feats: [
          {
            grantKind: 'FEAT_GRANT',
            id: 'style-choice',
            order: 1,
            selectionKind: 'CHOSEN',
            scalingKind: 'NONE',
            featIds: ['archery']
          }
        ]
      },
      options: [
        {
          id: 'archery-option',
          label: 'Archery',
          description: 'Gain a ranged accuracy bonus.',
          order: 1
        }
      ]
    })

    expect(parsed.grants?.feats?.[0]?.grantKind).toBe('FEAT_GRANT')
    expect(parsed.options?.[0]?.label).toBe('Archery')
  })

  it('parses recursive facet restrictions with predicate and exists conditions', () => {
    const parsed = facetDtoSchema.parse({
      id: 'fighter-style-restriction',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'CLASS_LEVEL',
                  min: 1
                },
                {
                  id: 'condition-2',
                  order: 2,
                  kind: 'EXISTS',
                  constraint: 'INCLUDE',
                  relationCode: 'FEATURE',
                  authoringModeKind: 'SELECTED',
                  featureIds: ['fighting-style'],
                  where: {
                    authoringModeKind: 'ALL',
                    groups: [
                      {
                        id: 'body-group-1',
                        order: 1,
                        conditions: [
                          {
                            id: 'nested-condition-1',
                            order: 1,
                            kind: 'PREDICATE',
                            constraint: 'INCLUDE',
                            predicateCode: 'FEATURE_OBTAINED',
                            featureIds: ['fighting-style']
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
    })

    expect(parsed.groups).toHaveLength(1)
  })

  it('parses correlated modifier grants for parameterized domains', () => {
    const parsed = modifierGrantDtoSchema.parse({
      grantKind: 'MODIFIER_GRANT',
      id: 'spell-attack-bonus',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL_BONUS',
      domain: {
        attackDomain: 'SPELL'
      },
      modifierKind: 'BONUS',
      scope: 'GLOBAL',
      payload: {
        valueKind: 'ABILITY_MODIFIER',
        ability: 'INTELLIGENCE',
        multiplier: 1
      }
    })

    expect(parsed.valueDomainCode).toBe('ATTACK_ROLL_BONUS')
    expect((parsed as { domain: { attackDomain: string } }).domain.attackDomain).toBe('SPELL')
  })

  it('rejects modifier payloads that do not match the selected domain', () => {
    expect(() => modifierGrantDtoSchema.parse({
      grantKind: 'MODIFIER_GRANT',
      id: 'bad-modifier',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL_BONUS',
      domain: {
        ability: 'INTELLIGENCE'
      },
      modifierKind: 'BONUS',
      scope: 'GLOBAL',
      payload: {
        valueKind: 'FIXED',
        amount: 2
      }
    })).toThrow()
  })

  it('rejects invalid facet predicate payloads once predicate correlation is enforced', () => {
    expect(() => facetDtoSchema.parse({
      id: 'bad-facet',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'CHARGE_RESET_KIND',
                  chargeResetKind: ['LONG_REST'],
                  min: 1
                }
              ]
            }
          ]
        }
      ]
    })).toThrow()
  })

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
  })

  it('parses a base class with nested authored substructures', () => {
    const parsed = classAuthoredDtoSchema.parse({
      id: 'wizard',
      category: 'BASE',
      label: 'Wizard',
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
          level: 'FULL',
          abilities: ['INTELLIGENCE', 'WISDOM'],
          authoringModeKind: 'SELECTED'
        }
      ],
      spellcasting: {
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }]
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
        ability: 'CONSTITUTION',
        dieConfig: '1d6'
      },
      multiclass: {
        id: 'wizard-multiclass',
        requirementGroups: {
          groups: [
            {
              id: 'wizard-req-group',
              requirements: [
                { id: 'int-req', ability: 'INTELLIGENCE', min: 13 }
              ]
            }
          ]
        }
      }
    })

    expect(parsed.category).toBe('BASE')
    expect(parsed.features?.[0]?.id).toBe('arcane-recovery')
  })

  it('rejects legacy placeholder values once nested enums are tightened', () => {
    expect(() => effectDtoSchema.parse({
      id: 'bad-effect',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'dex-save',
          savingThrowKind: 'FIXED_VALUE',
          ability: 'DEXTERITY',
          dc: 13
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'self-range',
          rangeKind: 'SELF'
        }
      },
      moments: [
        {
          id: 'bad-moment',
          moment: 'IMMEDIATE',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          effectKind: 'DAMAGE',
          damageTypeId: 'fire',
          valueKind: 'DICE',
          scalingKind: 'NONE',
          diceConfig: '3d6'
        }
      ]
    })).toThrow()
  })

  it('parses system vocabulary payloads and transport wrappers', () => {
    const system = systemAuthoredDtoSchema.parse({
      id: 'dnd-5e-srd',
      label: 'D&D 5e SRD',
      description: 'Baseline SRD system data.',
      alignments: [],
      conditionTypes: [],
      currencies: [],
      damageTypes: [],
      languages: [],
      magicSchools: [],
      passives: [],
      rarities: [],
      senses: [],
      skills: [],
      speeds: [],
      terrains: [],
      userId: 'master'
    })

    const list = systemListResponseDtoSchema.parse([
      {
        id: system.id,
        label: system.label,
        description: system.description,
        userId: system.userId
      }
    ])

    const params = resourceIdParamsDtoSchema.parse({ id: system.id })

    expect(list[0]?.label).toBe('D&D 5e SRD')
    expect(params.id).toBe(system.id)
  })

  it('parses authored content list and single-resource transport wrappers', () => {
    const list = backgroundListResponseDtoSchema.parse({
      items: [
        {
          id: 'acolyte',
          label: 'Acolyte',
          description: 'Temple-trained background.',
          userId: 'master',
          systemId: 'dnd-5e-srd'
        }
      ],
      meta: {
        total: 1
      }
    })

    const feature = featureResponseDtoSchema.parse({
      id: 'fighting-style',
      label: 'Fighting Style',
      description: 'Choose a martial specialization.',
      order: 1
    })

    expect(list.items[0]?.id).toBe('acolyte')
    expect(feature?.label).toBe('Fighting Style')
  })
})

import { describe, expect, it } from 'vitest'

import { chargeDtoSchema } from '../shared/charge.js'
import { effectDtoSchema } from '../effects/effect.js'
import { featureDtoSchema } from '../features/feature.js'
import { facetDtoSchema } from '../shared/facet.js'
import { featGrantDtoSchema } from '../grants/feat.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import { backgroundListResponseDtoSchema, featureResponseDtoSchema } from '../api/content.js'
import { resourceIdParamsDtoSchema, systemAuthoredDtoSchema, systemListResponseDtoSchema } from '../index.js'
import { classAuthoredDtoSchema } from '../subjects/class.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'

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

  it('parses effects with nested saving throw invocations and branches', () => {
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
      branches: [
        {
          id: 'burning-hands-direct',
          branch: 'ON_SAVE_FAIL',
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

    expect(parsed.branches).toHaveLength(1)
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
    expect(parsed.branches[0]).toMatchObject({
      branch: 'ON_SAVE_FAIL'
    })
  })

  it('parses non-damage outcome families such as apply-grant and rule fallbacks', () => {
    const parsed = effectDtoSchema.parse({
      id: 'shield-effect',
      order: 1,
      invocation: {
        triggerCode: 'SPELL_ATTACK',
        activation: {
          code: 'REACTION',
          amount: 1
        },
        range: {
          id: 'shield-range',
          rangeKind: 'SELF'
        }
      },
      branches: [
        {
          id: 'shield-grant',
          branch: 'ON_CAST',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          effectKind: 'APPLY_GRANT',
          grants: {
            modifiers: [
              {
                grantKind: 'MODIFIER_GRANT',
                id: 'shield-ac-bonus',
                order: 1,
                selectionKind: 'GRANTED',
                valueDomainCode: 'ARMOR_CLASS',
                modifierKind: 'BONUS',
                scope: 'GLOBAL',
                payload: {
                  valueKind: 'FIXED',
                  amount: 5
                }
              }
            ]
          }
        },
        {
          id: 'shield-rule',
          branch: 'ON_CAST',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          effectKind: 'RULE',
          label: 'Magic Missile Interception',
          description: 'This capability blocks the magic missile spell until the start of your next turn.'
        }
      ]
    })

    expect(parsed.branches).toHaveLength(2)
  })

  it('parses activated feature-style capabilities with on-use healing bonuses', () => {
    const parsed = effectDtoSchema.parse({
      id: 'second-wind-capability',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'BONUS_ACTION',
          amount: 1
        },
        range: {
          id: 'second-wind-range',
          rangeKind: 'SELF'
        },
        targeting: {
          selectionKind: 'SELF'
        }
      },
      branches: [
        {
          id: 'second-wind-heal',
          branch: 'ON_USE',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          effectKind: 'HEAL',
          valueKind: 'DICE',
          scalingKind: 'NONE',
          diceConfig: '1d10',
          bonuses: [
            {
              id: 'second-wind-fighter-level',
              bonusKind: 'CLASS_LEVEL',
              classId: 'fighter',
              order: 1
            }
          ]
        }
      ]
    }) as {
      branches?: Array<{
        branch?: string
        bonuses?: Array<{ bonusKind?: string, classId?: string }>
      }>
    }

    expect(parsed.branches?.[0]?.branch).toBe('ON_USE')
    expect(parsed.branches?.[0]?.bonuses?.[0]).toMatchObject({
      bonusKind: 'CLASS_LEVEL',
      classId: 'fighter'
    })
  })

  it('parses long-cast spell capabilities with separate activation and casting time layers', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'find-familiar',
      label: 'Find Familiar',
      description: 'You gain the service of a familiar.',
      castingTime: {
        unit: 'HOUR',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'conjuration',
      attributes: ['RITUAL'],
      capabilities: [
        {
          id: 'find-familiar-capability',
          order: 1,
          invocation: {
            triggerCode: 'ACTIVATED',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'find-familiar-range',
              rangeKind: 'DISTANCE',
              amount: 10,
              unit: 'FEET'
            },
            targeting: {
              selectionKind: 'AREA_CONTENTS',
              detail: 'The familiar appears in an unoccupied space within range.'
            }
          },
          branches: [
            {
              id: 'find-familiar-branch',
              branch: 'ON_USE',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              duration: {
                id: 'find-familiar-duration',
                durationKind: 'UNTIL_DISPELLED'
              },
              effectKind: 'MANIFEST',
              manifestKind: 'CREATURE',
              label: 'Familiar',
              detail: 'A spirit takes an animal form you choose and acts independently while obeying your commands.'
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      capabilities?: Array<{
        invocation?: { activation?: { code?: string, amount?: number } }
        branches?: Array<{ effectKind?: string, manifestKind?: string }>
      }>
    }

    expect(parsed.capabilities?.[0]?.invocation?.activation).toMatchObject({
      code: 'ACTION',
      amount: 1
    })
    expect(parsed.capabilities?.[0]?.branches?.[0]).toMatchObject({
      effectKind: 'MANIFEST',
      manifestKind: 'CREATURE'
    })
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
            count: 1,
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

  it('parses explicit ALL facet authoring mode', () => {
    const parsed = facetDtoSchema.parse({
      id: 'explicit-all-facet',
      authoringModeKind: 'ALL',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'SPELL',
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'SPELL_LEVEL',
                  min: 1
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

  it('parses explicit ALL grant authoring mode', () => {
    const parsed = featGrantDtoSchema.parse({
      grantKind: 'FEAT_GRANT',
      id: 'explicit-all-bonus-feat',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL'
    })

    expect(parsed.id).toBe('explicit-all-bonus-feat')
  })

  it('rejects selected grant targets that omit their required ids', () => {
    expect(() => featGrantDtoSchema.parse({
      grantKind: 'FEAT_GRANT',
      id: 'bad-selected-feat-grant',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED'
    })).toThrow()
  })

  it('parses explicit ALL proficiency authoring mode', () => {
    const parsed = proficiencyGrantDtoSchema.parse({
      grantKind: 'PROFICIENCY_GRANT',
      id: 'all-skill-proficiency',
      order: 1,
      proficiencyKind: 'SKILL',
      selectionKind: 'GRANTED',
      level: 'FULL',
      authoringModeKind: 'ALL'
    })

    expect(parsed.id).toBe('all-skill-proficiency')
  })

  it('rejects selected proficiency targets that omit their required payload ids', () => {
    expect(() => proficiencyGrantDtoSchema.parse({
      grantKind: 'PROFICIENCY_GRANT',
      id: 'bad-selected-proficiency',
      order: 1,
      proficiencyKind: 'SKILL',
      selectionKind: 'GRANTED',
      level: 'FULL',
      authoringModeKind: 'SELECTED'
    })).toThrow()
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
                  predicateCode: 'SPELL_LEVEL'
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
    }) as { category?: string, features?: Array<{ id?: string }> }

    expect(parsed.category).toBe('BASE')
    expect(parsed.features?.[0]?.id).toBe('arcane-recovery')
  })

  it('parses a spell with capability-owned range/shape and structured effect scaling', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'burning-hands',
      label: 'Burning Hands',
      description: 'Each creature in a 15-foot cone must make a Dexterity saving throw.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard', 'sorcerer'],
      magicSchoolId: 'evocation',
      capabilities: [
        {
          id: 'burning-hands-effect',
          order: 1,
          invocation: {
            triggerCode: 'SAVING_THROW',
            savingThrow: {
              id: 'burning-hands-save',
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: 'DEXTERITY'
            },
            activation: {
              code: 'ACTION',
              amount: 1
            },
          range: {
            id: 'burning-hands-effect-range',
            rangeKind: 'SELF'
          },
          targeting: {
            selectionKind: 'AREA_CONTENTS',
            detail: 'Each creature in the cone.'
          },
          shape: {
            id: 'burning-hands-cone',
            shapeKind: 'CONE',
              length: {
                amount: 15,
                unit: 'FEET'
              }
            }
          },
          branches: [
            {
              id: 'burning-hands-damage',
              branch: 'ON_SAVE_FAIL',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'DICE',
              scalingKind: 'PER_LEVEL',
              scalingSource: 'SPELL_CAST_LEVEL',
              levels: [
                {
                  id: 'burning-hands-level-1',
                  level: 1,
                  order: 1,
                  diceConfig: '3d6'
                },
                {
                  id: 'burning-hands-level-2',
                  level: 2,
                  order: 2,
                  diceConfig: '4d6'
                }
              ]
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      capabilities?: Array<{
        invocation: {
          range: { rangeKind: string }
          targeting?: { selectionKind?: string }
        }
        branches?: Array<Record<string, unknown>>
      }>
    }

    expect(parsed.capabilities?.[0]?.invocation.range.rangeKind).toBe('SELF')
    expect(parsed.capabilities?.[0]?.invocation.targeting?.selectionKind).toBe('AREA_CONTENTS')
    expect(parsed.capabilities?.[0]?.branches?.[0]).toMatchObject({
      scalingKind: 'PER_LEVEL',
      scalingSource: 'SPELL_CAST_LEVEL'
    })
  })

  it('parses richer invocation targeting qualifiers for multi-target effects', () => {
    const parsed = effectDtoSchema.parse({
      id: 'mass-cure-wounds-effect',
      order: 1,
      invocation: {
        triggerCode: 'SPELL_ATTACK',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'mass-cure-wounds-range',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        },
        shape: {
          id: 'mass-cure-wounds-shape',
          shapeKind: 'SPHERE',
          radius: {
            amount: 30,
            unit: 'FEET'
          }
        },
        targeting: {
          selectionKind: 'CHOSEN_CREATURES',
          maxTargets: 6,
          excludedCreatureTypeIds: ['undead', 'construct'],
          detail: 'Up to six creatures of your choice.'
        }
      },
      branches: [
        {
          id: 'mass-cure-wounds-heal',
          branch: 'ON_CAST',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          effectKind: 'HEAL',
          valueKind: 'DICE',
          scalingKind: 'PER_LEVEL',
          scalingSource: 'SPELL_CAST_LEVEL',
          levels: [
            {
              id: 'mass-cure-wounds-level-5',
              level: 5,
              order: 1,
              diceConfig: '3d8'
            }
          ]
        }
      ]
    }) as {
      invocation?: {
        targeting?: {
          selectionKind?: string
          maxTargets?: number
          excludedCreatureTypeIds?: string[]
        }
      }
    }

    expect(parsed.invocation?.targeting).toMatchObject({
      selectionKind: 'CHOSEN_CREATURES',
      maxTargets: 6,
      excludedCreatureTypeIds: ['undead', 'construct']
    })
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
      branches: [
        {
          id: 'bad-moment',
          branch: 'IMMEDIATE',
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
    ]) as { label?: string }[]

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
    }) as { items: { id?: string }[] }

    const feature = featureResponseDtoSchema.parse({
      id: 'fighting-style',
      label: 'Fighting Style',
      description: 'Choose a martial specialization.',
      order: 1
    }) as { label?: string }

    expect(list.items[0]?.id).toBe('acolyte')
    expect(feature?.label).toBe('Fighting Style')
  })
})

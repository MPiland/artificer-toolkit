import { describe, expect, it } from 'vitest'

import { chargeDtoSchema } from '../shared/charge.js'
import { effectDtoSchema } from '../effects/effect.js'
import { featureDtoSchema } from '../features/feature.js'
import { facetDtoSchema } from '../shared/facet.js'
import { featGrantDtoSchema } from '../grants/feat.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import { backgroundListResponseDtoSchema, featureResponseDtoSchema, spellResponseDtoSchema } from '../api/content.js'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeResolveRequestDtoSchema,
  nodeRuntimeResolveResponseDtoSchema
} from '../api/nodeRuntime.js'
import { resourceIdParamsDtoSchema, systemAuthoredDtoSchema, systemListResponseDtoSchema } from '../index.js'
import { classAuthoredDtoSchema } from '../subjects/class.js'
import { featAuthoredDtoSchema } from '../subjects/feat.js'
import { raceAuthoredDtoSchema } from '../subjects/race.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'

function singleResultBlock(id: string, outcome: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    id,
    resultKind: 'SINGLE',
    outcomes: [outcome],
    ...extra
  }
}

function sequenceResultBlock(id: string, outcomes: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return {
    id,
    resultKind: 'SEQUENCE',
    outcomes,
    ...extra
  }
}

function fixedPath(
  id: string,
  order: number,
  pathCode: string,
  resultBlock: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'FIXED',
    resultBlock,
    ...extra
  }
}

function choicePath(
  id: string,
  order: number,
  pathCode: string,
  options: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'CHOICE',
    selectionKind: 'CHOICE',
    options,
    ...extra
  }
}

function exactRollTablePath(
  id: string,
  order: number,
  pathCode: string,
  rows: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'ROLL_TABLE',
    rollTableKind: 'EXACT',
    dieConfig: '1d4',
    rows,
    ...extra
  }
}

function rangeRollTablePath(
  id: string,
  order: number,
  pathCode: string,
  rows: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'ROLL_TABLE',
    rollTableKind: 'RANGE',
    dieConfig: '1d4',
    rows,
    ...extra
  }
}

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

  it('parses effects with nested saving throw invocations and fixed paths', () => {
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
      paths: [
        fixedPath(
          'burning-hands-direct',
          1,
          'ON_SAVE_FAIL',
          singleResultBlock('burning-hands-result', {
            id: 'burning-hands-direct-entry',
            effectKind: 'DAMAGE',
            damageTypeId: 'fire',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d6'
          })
        )
      ]
    }) as any

    expect(parsed.paths).toHaveLength(1)
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
    expect(parsed.paths[0]).toMatchObject({
      pathCode: 'ON_SAVE_FAIL'
    }) as any
  })

  it('parses passive effects with saving throw invocations', () => {
    const parsed = effectDtoSchema.parse({
      id: 'spirit-guardians-effect',
      order: 1,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'spirit-guardians-save',
          savingThrowKind: 'FIXED_VALUE',
          ability: 'WISDOM',
          dc: 15
        },
        range: {
          id: 'spirit-guardians-range',
          rangeKind: 'SELF'
        },
        shape: {
          id: 'spirit-guardians-shape',
          shapeKind: 'SPHERE',
          radius: {
            amount: 15,
            unit: 'FEET'
          }
        }
      },
      paths: [
        fixedPath(
          'spirit-guardians-save-fail',
          1,
          'ON_SAVE_FAIL',
          singleResultBlock('spirit-guardians-save-fail-result', {
            id: 'spirit-guardians-save-fail-entry',
            effectKind: 'DAMAGE',
            damageTypeId: 'radiant',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d8'
          })
        ),
        fixedPath(
          'spirit-guardians-save-success',
          2,
          'ON_SAVE_SUCCESS',
          singleResultBlock('spirit-guardians-save-success-result', {
            id: 'spirit-guardians-save-success-entry',
            effectKind: 'DAMAGE',
            damageTypeId: 'radiant',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d8'
          })
        )
      ]
    }) as any

    expect(parsed.invocation.kind).toBe('PASSIVE')
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
    expect('savingThrow' in parsed.invocation).toBe(true)
  })

  it('parses labeled choice options and roll-table rows for authored copy', () => {
    const parsed = effectDtoSchema.parse({
      id: 'choice-copy-effect',
      order: 1,
      invocation: {
        triggerCode: 'SPELL_ATTACK',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'choice-copy-range',
          rangeKind: 'DISTANCE',
          amount: 30,
          unit: 'FEET'
        }
      },
      paths: [
        choicePath('choice-copy-direct', 1, 'ON_HIT', [
          {
            id: 'choice-copy-direct-option',
            order: 1,
            label: 'Primary Result',
            description: 'The main outcome when the effect resolves.',
            resultBlock: singleResultBlock('choice-copy-direct-result', {
              id: 'choice-copy-direct-entry',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 10
            })
          }
        ]),
        exactRollTablePath('choice-copy-roll', 2, 'ON_HIT', [
          {
            id: 'choice-copy-roll-entry',
            order: 1,
            rollValue: 1,
            resultBlock: singleResultBlock('choice-copy-roll-result', {
              id: 'choice-copy-roll-outcome',
              effectKind: 'RULE'
            })
          }
        ])
      ]
    }) as any

    expect(parsed.paths[0].options[0]).toMatchObject({
      label: 'Primary Result',
      description: 'The main outcome when the effect resolves.'
    }) as any

    expect(parsed.paths[1].rows[0]).not.toHaveProperty('label')
    expect(parsed.paths[1].rows[0]).not.toHaveProperty('description')
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
      paths: [
        fixedPath(
          'shield-grant',
          1,
          'ON_CAST',
          singleResultBlock('shield-grant-result', {
            id: 'shield-grant-entry',
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
          })
        ),
        fixedPath(
          'shield-rule',
          2,
          'ON_CAST',
          singleResultBlock('shield-rule-result', {
            id: 'shield-rule-entry',
            effectKind: 'RULE'
          })
        )
      ]
    }) as any

    expect(parsed.paths).toHaveLength(2)
  })

  it('parses result-block lifecycle metadata and sequential outcomes', () => {
    const parsed = effectDtoSchema.parse({
      id: 'dissonant-whispers-effect',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'wis-save',
          savingThrowKind: 'FIXED_VALUE',
          ability: 'WISDOM',
          dc: 14
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'dw-range',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'dw-sequence',
          1,
          'ON_SAVE_FAIL',
          sequenceResultBlock(
            'dw-sequence-result',
            [
              {
                id: 'dw-damage-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'psychic',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '3d6'
              },
              {
                id: 'dw-move-entry',
                effectKind: 'FORCED_MOVEMENT',
                direction: 'AWAY_FROM_SOURCE',
                distanceMode: 'UP_TO_SPEED',
                actionEconomy: 'REACTION'
              }
            ],
            {
              lifecycle: {
                recurringKind: 'NONE',
                consumeOnFirstEvent: 'ON_ATTACK_ROLL',
                endOnEvents: ['ON_CAST_SPELL']
              }
            }
          )
        )
      ]
    }) as {
      paths?: Array<{
        resultBlock?: {
          outcomes?: Array<{
            effectKind?: string
          }>
          lifecycle?: { consumeOnFirstEvent?: string }
        }
      }>
    }

    expect(parsed.paths?.[0]?.resultBlock).toMatchObject({
      outcomes: [{ effectKind: 'DAMAGE' }, { effectKind: 'FORCED_MOVEMENT' }],
      lifecycle: { consumeOnFirstEvent: 'ON_ATTACK_ROLL' }
    }) as any
  })

  it('parses activated feature-style effects with on-use healing bonuses', () => {
    const parsed = effectDtoSchema.parse({
      id: 'second-wind-effect',
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
      paths: [
        fixedPath(
          'second-wind-heal',
          1,
          'ON_USE',
          singleResultBlock('second-wind-result', {
            id: 'second-wind-heal-entry',
            effectKind: 'HEAL',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '1d10',
            bonuses: [
              {
                id: 'second-wind-fighter-level',
                bonusKind: 'CLASS_LEVEL',
                classId: 'fighter'
                ,
                order: 1
              }
            ]
          })
        )
      ]
    }) as {
      paths?: Array<{
        pathCode?: string
        resultBlock?: {
          outcomes?: Array<{
            bonuses?: Array<{ bonusKind?: string, classId?: string }>
          }>
        }
      }>
    }

    expect(parsed.paths?.[0]?.pathCode).toBe('ON_USE')
    expect(parsed.paths?.[0]?.resultBlock?.outcomes?.[0]?.bonuses?.[0]).toMatchObject({
      bonusKind: 'CLASS_LEVEL',
      classId: 'fighter'
    })
  })

  it('parses long-cast spell effects with separate activation and casting time layers', () => {
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
      components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
      effects: [
        {
          id: 'find-familiar-effect',
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
              selectionKind: 'AREA_CONTENTS'
            }
          },
          paths: [
            fixedPath(
              'find-familiar-path',
              1,
              'ON_USE',
              singleResultBlock(
                'find-familiar-result',
                {
                  id: 'find-familiar-entry',
                  effectKind: 'MANIFEST',
                  manifestKind: 'CREATURE'
                },
                {
                  duration: {
                    id: 'find-familiar-duration',
                    durationKind: 'UNTIL_DISPELLED'
                  }
                }
              )
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        invocation?: { activation?: { code?: string, amount?: number } }
        paths?: Array<{ resultBlock?: { outcomes?: Array<{ effectKind?: string, manifestKind?: string }> } }>
      }>
    }

    expect(parsed.effects?.[0]?.invocation?.activation).toMatchObject({
      code: 'ACTION',
      amount: 1
    })
    expect((parsed as { components?: string[] }).components).toEqual(['VERBAL', 'SOMATIC', 'MATERIAL'])
    expect(parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]).toMatchObject({
      effectKind: 'MANIFEST',
      manifestKind: 'CREATURE'
    })
  })

  it('parses manifest-owned nested behaviors when they use non-manifest outcomes', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'arcane-sword',
      label: 'Arcane Sword',
      description: 'You create a sword-shaped plane of force.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 7,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'arcane-sword-effect',
          order: 1,
          invocation: {
            triggerCode: 'ACTIVATED',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'arcane-sword-range',
              rangeKind: 'DISTANCE',
              amount: 60,
              unit: 'FEET'
            }
          },
          paths: [
            fixedPath(
              'arcane-sword-path',
              1,
              'ON_USE',
              singleResultBlock('arcane-sword-result', {
                id: 'arcane-sword-manifest',
                effectKind: 'MANIFEST',
                manifestKind: 'WEAPON',
                behaviors: [
                  {
                    id: 'arcane-sword-attack',
                    order: 1,
                    invocation: {
                      triggerCode: 'SPELL_ATTACK',
                      activation: {
                        code: 'BONUS_ACTION',
                        amount: 1
                      },
                      range: {
                        id: 'arcane-sword-attack-range',
                        rangeKind: 'DISTANCE',
                        amount: 5,
                        unit: 'FEET'
                      }
                    },
                    paths: [
                      fixedPath(
                        'arcane-sword-hit',
                        1,
                        'ON_HIT',
                        singleResultBlock('arcane-sword-hit-result', {
                          id: 'arcane-sword-damage',
                          effectKind: 'DAMAGE',
                          damageTypeId: 'force',
                          valueKind: 'DICE',
                          scalingKind: 'NONE',
                          diceConfig: '3d10'
                        })
                      )
                    ]
                  }
                ]
              })
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        paths?: Array<{
          resultBlock?: {
            outcomes?: Array<{
              behaviors?: Array<{
                paths?: Array<{
                  resultBlock?: { outcomes?: Array<{ effectKind?: string }> }
                }>
              }>
            }>
          }
        }>
      }>
    }

    expect(parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]?.behaviors?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]).toMatchObject({
      effectKind: 'DAMAGE'
    })
  })

  it('rejects manifest-owned nested behaviors that try to manifest again', () => {
    expect(() => spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'bad-nested-manifest',
      label: 'Bad Nested Manifest',
      description: 'A recursive manifest payload.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 4,
      classIds: ['wizard'],
      magicSchoolId: 'conjuration',
      effects: [
        {
          id: 'outer-effect',
          order: 1,
          invocation: {
            triggerCode: 'ACTIVATED',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'outer-range',
              rangeKind: 'DISTANCE',
              amount: 30,
              unit: 'FEET'
            }
          },
          paths: [
            fixedPath(
              'outer-path',
              1,
              'ON_USE',
              singleResultBlock('outer-result', {
                id: 'outer-manifest',
                effectKind: 'MANIFEST',
                manifestKind: 'SUMMON',
                behaviors: [
                  {
                    id: 'nested-effect',
                    order: 1,
                    invocation: {
                      triggerCode: 'ACTIVATED',
                      activation: {
                        code: 'ACTION',
                        amount: 1
                      },
                      range: {
                        id: 'nested-range',
                        rangeKind: 'SELF'
                      }
                    },
                    paths: [
                      fixedPath(
                        'nested-path',
                        1,
                        'ON_USE',
                        singleResultBlock('nested-result', {
                          id: 'recursive-manifest',
                          effectKind: 'MANIFEST',
                          manifestKind: 'OBJECT'
                        })
                      )
                    ]
                  }
                ]
              })
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })).toThrow()
  })

  it('strips roll-table row labels and descriptions', () => {
    const parsed = effectDtoSchema.parse({
      id: 'bad-roll-table-metadata',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'bad-roll-range',
          rangeKind: 'DISTANCE',
          amount: 30,
          unit: 'FEET'
        }
      },
      paths: [
        exactRollTablePath('bad-roll-path', 1, 'ON_USE', [
          {
            id: 'bad-roll-entry',
            order: 1,
            label: 'Should fail',
            description: 'Roll tables should not use entry metadata.',
            rollValue: 1,
            resultBlock: singleResultBlock('bad-roll-result', {
              id: 'bad-roll-outcome',
              effectKind: 'RULE'
            })
          }
        ])
      ]
    })

    expect((parsed as any).paths[0].rows[0]).not.toHaveProperty('label')
    expect((parsed as any).paths[0].rows[0]).not.toHaveProperty('description')
  })

  it('strips creature manifest inline behaviors', () => {
    const parsed = effectDtoSchema.parse({
      id: 'bad-creature-manifest',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'bad-creature-range',
          rangeKind: 'DISTANCE',
          amount: 10,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'bad-creature-path',
          1,
          'ON_USE',
          singleResultBlock('bad-creature-result', {
            id: 'bad-creature-entry',
            effectKind: 'MANIFEST',
            manifestKind: 'CREATURE',
            creatureId: 'owl',
            behaviors: []
          })
        )
      ]
    })

    expect((parsed as any).paths[0].resultBlock.outcomes[0]).toMatchObject({
      manifestKind: 'CREATURE',
      creatureId: 'owl'
    })
    expect((parsed as any).paths[0].resultBlock.outcomes[0]).not.toHaveProperty('behaviors')
  })

  it('parses summon manifests with authored stat block data', () => {
    const parsed = effectDtoSchema.parse({
      id: 'summon-manifest',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'summon-range',
          rangeKind: 'DISTANCE',
          amount: 120,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'summon-path',
          1,
          'ON_USE',
          singleResultBlock('summon-result', {
            id: 'summon-entry',
            effectKind: 'MANIFEST',
            manifestKind: 'SUMMON',
            statBlock: {
              size: 'LARGE',
              armorClass: {
                kind: 'FIXED',
                value: 20
              },
              hitPoints: {
                kind: 'HIT_POINT_MAXIMUM'
              },
              speeds: [
                {
                  speedId: 'arcane-hand-speed',
                  amount: 60,
                  unit: 'FEET'
                }
              ],
              abilityScores: {
                STRENGTH: {
                  kind: 'FIXED',
                  value: 26
                }
              },
              damageabilityKind: 'INVULNERABLE',
              occupiesSpace: true
            }
          })
        )
      ]
    })

    expect((parsed as any).paths[0].resultBlock.outcomes[0]).toMatchObject({
      manifestKind: 'SUMMON',
      statBlock: {
        size: 'LARGE',
        armorClass: {
          kind: 'FIXED',
          value: 20
        },
        hitPoints: {
          kind: 'HIT_POINT_MAXIMUM'
        },
        speeds: [
          {
            speedId: 'arcane-hand-speed',
            amount: 60,
            unit: 'FEET'
          }
        ],
        abilityScores: {
          STRENGTH: {
            kind: 'FIXED',
            value: 26
          }
        },
        damageabilityKind: 'INVULNERABLE',
        occupiesSpace: true
      }
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
      valueDomainCode: 'ATTACK_ROLL',
      domain: {
        attackDomain: 'SPELL'
      },
      modifierKind: 'ABILITY_MODIFIER_BONUS',
      scope: 'GLOBAL',
      payload: {
        ability: 'INTELLIGENCE',
        multiplier: 1
      }
    })

    expect(parsed.valueDomainCode).toBe('ATTACK_ROLL')
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
      valueDomainCode: 'ATTACK_ROLL',
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

  it('parses a spell with effect-owned range/shape and structured scaling', () => {
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
      effects: [
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
            selectionKind: 'AREA_CONTENTS'
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
          paths: [
            fixedPath(
              'burning-hands-damage',
              1,
              'ON_SAVE_FAIL',
              singleResultBlock('burning-hands-result', {
                id: 'burning-hands-damage-entry',
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
              })
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        invocation: {
          range: { rangeKind: string }
          targeting?: { selectionKind?: string }
        }
        paths?: Array<{ resultBlock?: { outcomes?: Array<Record<string, unknown>> } }>
      }>
    }

    expect(parsed.effects?.[0]?.invocation.range.rangeKind).toBe('SELF')
    expect(parsed.effects?.[0]?.invocation.targeting?.selectionKind).toBe('AREA_CONTENTS')
    expect(parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]).toMatchObject({
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
          excludedCreatureTypeIds: ['undead', 'construct']
        }
      },
      paths: [
        fixedPath(
          'mass-cure-wounds-heal',
          1,
          'ON_CAST',
          singleResultBlock('mass-cure-wounds-result', {
            id: 'mass-cure-wounds-heal-entry',
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
          })
        )
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
      paths: [
        fixedPath(
          'bad-moment',
          1,
          'IMMEDIATE',
          singleResultBlock('bad-result', {
            id: 'bad-moment-entry',
            effectKind: 'DAMAGE',
            damageTypeId: 'fire',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d6'
          })
        )
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
      heritages: [],
      languages: [],
      lifestyles: [],
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

  it('parses feat prerequisites authored on CHARACTER facets', () => {
    const feat = featAuthoredDtoSchema.parse({
      id: 'feat-elven-accuracy',
      label: 'Elven Accuracy',
      description: 'You have uncanny aim.',
      prerequisites: {
        id: 'feat-prereq-1',
        groups: [
          {
            id: 'feat-prereq-group-1',
            order: 1,
            contexts: [
              {
                id: 'feat-prereq-context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'feat-prereq-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'HERITAGE',
                    authoringModeKind: 'SELECTED',
                    heritageIds: ['heritage-elven']
                  }
                ]
              }
            ]
          }
        ]
      },
      userId: 'master',
      systemId: 'system-1'
    }) as any

    expect(feat.prerequisites?.groups[0]?.contexts[0]?.conditions?.[0]).toMatchObject({
      predicateCode: 'HERITAGE',
      heritageIds: ['heritage-elven']
    })
  })

  it('parses race heritage memberships', () => {
    const race = raceAuthoredDtoSchema.parse({
      id: 'race-half-elf',
      label: 'Half-Elf',
      description: 'Bridges two lineages.',
      heritageIds: ['heritage-human', 'heritage-elven'],
      userId: 'master',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [
        {
          speedId: 'walk',
          amount: 30,
          unit: 'FEET'
        }
      ]
    }) as any

    expect(race.heritageIds).toEqual(['heritage-human', 'heritage-elven'])
  })

  it('parses authored content list and single-resource transport wrappers', () => {
    const list = backgroundListResponseDtoSchema.parse({
      items: [
        {
          id: 'acolyte',
          label: 'Acolyte',
          description: 'Temple-trained background.',
          status: 'ACTIVE',
          userId: 'master',
          systemId: 'dnd-5e-srd',
          provenance: {
            kind: 'MASTER',
            ownerUserId: null
          },
          permissions: {
            canView: true,
            canEdit: false,
            canCopy: true,
            canDelete: false
          }
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

    const spell = spellResponseDtoSchema.parse({
      item: {
        kind: 'SPELL',
        id: 'magic-missile',
        label: 'Magic Missile',
        description: 'Force darts.',
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        userId: 'master',
        systemId: 'dnd-5e-srd'
      },
      provenance: {
        kind: 'MASTER',
        ownerUserId: null
      },
      permissions: {
        canView: true,
        canEdit: false,
        canCopy: true,
        canDelete: false
      }
    }) as { item?: { id?: string }, permissions?: { canEdit?: boolean } }

    expect(list.items[0]?.id).toBe('acolyte')
    expect(feature?.label).toBe('Fighting Style')
    expect(spell?.permissions?.canEdit).toBe(false)
  })

  it('parses node runtime resolve and normalize contracts', () => {
    const request = nodeRuntimeResolveRequestDtoSchema.parse({
      mapId: 'startingEquipmentItem',
      values: {
        category: 'WEAPON',
        authoringModeKind: 'SELECTED'
      },
      parentValues: {
        selectionKind: 'CHOSEN'
      },
      ancestors: [{ systemId: 'dnd-5e-srd' }],
      systemId: 'dnd-5e-srd'
    })

    const response = nodeRuntimeResolveResponseDtoSchema.parse({
      mapId: 'startingEquipmentItem',
      clearPaths: [['equipmentIds']],
      sections: [{
        id: 'basics',
        label: 'Basics',
        order: 10,
        nodes: [{
          id: 'equipmentIds',
          path: ['equipmentIds'],
          label: 'Equipment',
          kind: 'INPUT',
          type: 'SELECT_MULTI',
          visible: true,
          required: false,
          clearPaths: [],
          options: [{
            value: 'longsword',
            label: 'Longsword',
            description: 'A martial melee weapon.',
            disabled: false,
            group: 'Weapons',
            metadata: { category: 'WEAPON' }
          }]
        }]
      }]
    })

    const normalizeRequest = nodeRuntimeNormalizeValuesRequestDtoSchema.parse(request)

    expect(response.sections[0]?.nodes[0]?.options?.[0]?.value).toBe('longsword')
    expect(normalizeRequest.mapId).toBe('startingEquipmentItem')
  })
})







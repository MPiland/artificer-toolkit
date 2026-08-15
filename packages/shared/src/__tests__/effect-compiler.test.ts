import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  EFFECT_KIND,
  FORCED_MOVEMENT_ACTION_ECONOMY,
  FORCED_MOVEMENT_DIRECTION,
  GRANT_KIND,
  NUMERIC_EXPR_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_RESOLUTION_KIND,
  PATH_ROLL_TABLE_KIND,
  RANGE_KIND,
  SCALING,
  SIZE_CODE,
  TRIGGER
} from '#core'
import { compileEffectResult } from '#compilers'

describe('effect compiler', () => {
  it('preserves authored action resource use on compiled effect groups', () => {
    const result = compileEffectResult({
      id: 'resource-use-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        resourceUse: { chargeId: 'resource-use-charge', cost: 2 },
        range: { id: 'resource-use-range', rangeKind: RANGE_KIND.SELF }
      },
      paths: [
        {
          id: 'resource-use-path',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'resource-use-result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: 'resource-use-outcome',
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: 'resource-use-condition'
              }
            ]
          }
        }
      ]
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    expect(result.value.invocation).toMatchObject({
      resourceUse: { chargeId: 'resource-use-charge', cost: 2 }
    })
  })

  it('compiles exact roll-table condition paths through the effect result wrapper', () => {
    const result = compileEffectResult({
      id: 'potion-side-effects',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ENTER_AREA,
        activation: { code: ACTIVATION_CODE.FREE },
        range: {
          id: 'self-range',
          rangeKind: RANGE_KIND.SELF
        }
      },
      paths: [
        {
          id: 'potion-side-effects-table',
          order: 1,
          pathCode: PATH_CODE.PASSIVE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'ROLL_TABLE' as const,
          dieConfig: 'd6',
          rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
          rows: [
            {
              id: 'slowed',
              order: 1,
              rollValue: 1,
              resolutionKind: 'RESULT',
              resultBlock: {
                id: 'slowed__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: 'slowed',
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: 'slowed'
                  }
                ]
              }
            },
            {
              id: 'poisoned',
              order: 2,
              rollValue: 2,
              resolutionKind: 'RESULT',
              resultBlock: {
                id: 'poisoned__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: 'poisoned',
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: 'poisoned'
                  }
                ]
              }
            }
          ]
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }
    expect(result.diagnostics).toEqual([])
    expect(result.value.entries).toEqual([
      {
        id: 'slowed',
        entryId: 'slowed',
        pathGroupId: 'potion-side-effects-table',
        pathCode: PATH_CODE.PASSIVE,
        pathOrder: 1,
        entryOrder: 1000,
        resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
        groupKind: PATH_GROUP_TYPE.SINGLE,
        rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
        die: 'd6',
        rollValue: 1,
        outcome: {
          id: 'slowed',
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: 'slowed'
        }
      },
      {
        id: 'poisoned',
        entryId: 'poisoned',
        pathGroupId: 'potion-side-effects-table',
        pathCode: PATH_CODE.PASSIVE,
        pathOrder: 1,
        entryOrder: 2000,
        resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
        groupKind: PATH_GROUP_TYPE.SINGLE,
        rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
        die: 'd6',
        rollValue: 2,
        outcome: {
          id: 'poisoned',
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: 'poisoned'
        }
      }
    ])
  })
  it('compiles non-damage effect outcomes like apply-grant and rule without flattening them away', () => {
    const result = compileEffectResult({
      id: 'shield-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
        range: {
          id: 'shield-self',
          rangeKind: RANGE_KIND.SELF
        }
      },
      paths: [
        {
          id: 'shield-buff',
          order: 1,
          pathCode: PATH_CODE.ON_CAST,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'shield-buff__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: 'shield-buff',
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      id: 'shield-ac',
                      order: 1,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      valueDomainCode: 'ARMOR_CLASS',
                      domain: {},
                      modifierKind: 'BONUS',
                      scope: 'GLOBAL',
                      payload: {
                        valueKind: 'FIXED',
                        amount: 5
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          id: 'shield-rule',
          order: 2,
          pathCode: PATH_CODE.ON_CAST,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'shield-rule__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: 'shield-rule',
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve shield rule',
                reasonCode: 'NARRATIVE_JUDGMENT',
                instructions: 'Apply the remaining shield rule as written.'
              }
            ]
          }
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }
    expect(result.value.entries).toEqual([
      {
        id: 'shield-buff',
        entryId: 'shield-buff',
        pathGroupId: 'shield-buff',
        pathCode: PATH_CODE.ON_CAST,
        pathOrder: 1,
        entryOrder: 1,
        resolutionKind: PATH_RESOLUTION_KIND.DIRECT,
        groupKind: PATH_GROUP_TYPE.SINGLE,
        outcome: {
          id: 'shield-buff',
          effectKind: EFFECT_KIND.APPLY_GRANT,
          grants: {
            modifiers: [
              {
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                id: 'shield-ac',
                order: 1,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                valueDomainCode: 'ARMOR_CLASS',
                domain: {},
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
        duration: undefined
      },
      {
        id: 'shield-rule',
        entryId: 'shield-rule',
        pathGroupId: 'shield-rule',
        pathCode: PATH_CODE.ON_CAST,
        pathOrder: 2,
        entryOrder: 1,
        resolutionKind: PATH_RESOLUTION_KIND.DIRECT,
        groupKind: PATH_GROUP_TYPE.SINGLE,
        outcome: {
          id: 'shield-rule',
          effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
          label: 'Resolve shield rule',
          reasonCode: 'NARRATIVE_JUDGMENT',
          instructions: 'Apply the remaining shield rule as written.'
        },
        duration: undefined
      }
    ])
  })
  it('preserves activated on-use healing effects with structured heal bonuses', () => {
    const result = compileEffectResult({
      id: 'second-wind-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
        range: {
          id: 'second-wind-range',
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF'
        }
      },
      paths: [
        {
          id: 'second-wind-heal',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'second-wind-heal__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: 'second-wind-heal',
                effectKind: EFFECT_KIND.HEAL,
                valueKind: 'DICE',
                scalingKind: SCALING.NONE,
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
          }
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }
    expect(result.value.entries[0]).toMatchObject({
      pathCode: PATH_CODE.ON_USE,
      outcome: {
        effectKind: EFFECT_KIND.HEAL,
        bonuses: [
          {
            bonusKind: 'CLASS_LEVEL',
            classId: 'fighter'
          }
        ]
      }
    })
  })
  it('compiles optional labels and descriptions onto flattened path summaries', () => {
    const result = compileEffectResult({
      id: 'choice-copy-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: 'choice-copy-range',
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: 'FEET'
        }
      },
      paths: [
        {
          id: 'choice-copy-direct',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'choice-copy-direct__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: 'choice-copy-direct-entry',
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve direct choice',
                reasonCode: 'NARRATIVE_JUDGMENT',
                instructions: 'Resolve the authored direct choice.'
              }
            ]
          }
        },
        {
          id: 'choice-copy-roll',
          order: 2,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.CHOICE,
          selectionKind: 'ROLL_TABLE' as const,
          dieConfig: '1d4',
          rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
          rows: [
            {
              id: 'choice-copy-roll-entry',
              order: 1,
              rollValue: 1,
              resolutionKind: 'RESULT',
              resultBlock: {
                id: 'choice-copy-roll-entry__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: 'choice-copy-roll-entry',
                    effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Resolve rolled choice',
                    reasonCode: 'NARRATIVE_JUDGMENT',
                    instructions: 'Resolve the authored rolled choice.'
                  }
                ]
              }
            }
          ]
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }
    expect(result.value.entries).toEqual([
      {
        id: 'choice-copy-direct-entry',
        entryId: 'choice-copy-direct-entry',
        pathGroupId: 'choice-copy-direct',
        pathCode: PATH_CODE.ON_HIT,
        pathOrder: 1,
        entryOrder: 1,
        resolutionKind: PATH_RESOLUTION_KIND.DIRECT,
        groupKind: PATH_GROUP_TYPE.SINGLE,
        outcome: {
          id: 'choice-copy-direct-entry',
          effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
          label: 'Resolve direct choice',
          reasonCode: 'NARRATIVE_JUDGMENT',
          instructions: 'Resolve the authored direct choice.'
        }
      },
      {
        id: 'choice-copy-roll-entry',
        entryId: 'choice-copy-roll-entry',
        pathGroupId: 'choice-copy-roll',
        pathCode: PATH_CODE.ON_HIT,
        pathOrder: 2,
        entryOrder: 1000,
        resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
        groupKind: PATH_GROUP_TYPE.SINGLE,
        die: '1d4',
        rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
        rollValue: 1,
        outcome: {
          id: 'choice-copy-roll-entry',
          effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
          label: 'Resolve rolled choice',
          reasonCode: 'NARRATIVE_JUDGMENT',
          instructions: 'Resolve the authored rolled choice.'
        }
      }
    ])
  })
  it('compiles long-cast manifest effects with separate activation and casting layers', () => {
    const result = compileEffectResult({
      id: 'find-familiar-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: 'find-familiar-range',
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 10,
          unit: 'FEET'
        },
        targeting: {
          selectionKind: 'AREA_CONTENTS'
        }
      },
      paths: [
        {
          id: 'find-familiar-path',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'find-familiar-path__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: 'find-familiar-duration',
              durationKind: 'UNTIL_DISPELLED'
            },
            outcomes: [
              {
                id: 'find-familiar-path',
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: 'CREATURE'
              }
            ]
          }
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }
    expect(result.value.entries[0]).toMatchObject({
      pathCode: PATH_CODE.ON_USE,
      outcome: {
        effectKind: EFFECT_KIND.MANIFEST,
        manifestKind: 'CREATURE'
      }
    })
  })
  it('preserves summon stat block payloads on manifested outcomes', () => {
    const result = compileEffectResult({
      id: 'arcane-hand-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: 'arcane-hand-range',
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: 'FEET'
        }
      },
      paths: [
        {
          id: 'arcane-hand-path',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'arcane-hand-path__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: 'arcane-hand-entry',
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: 'SUMMON',
                statBlock: {
                  size: SIZE_CODE.LARGE,
                  armorClass: {
                    kind: NUMERIC_EXPR_CODE.FIXED,
                    value: 20
                  },
                  hitPoints: {
                    kind: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM
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
                      kind: NUMERIC_EXPR_CODE.FIXED,
                      value: 26
                    }
                  },
                  damageabilityKind: 'INVULNERABLE',
                  occupiesSpace: true
                }
              }
            ]
          }
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }
    expect(result.value.entries[0]).toMatchObject({
      outcome: {
        effectKind: EFFECT_KIND.MANIFEST,
        manifestKind: 'SUMMON',
        statBlock: {
          size: SIZE_CODE.LARGE,
          armorClass: {
            kind: NUMERIC_EXPR_CODE.FIXED,
            value: 20
          },
          hitPoints: {
            kind: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM
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
              kind: NUMERIC_EXPR_CODE.FIXED,
              value: 26
            }
          },
          damageabilityKind: 'INVULNERABLE',
          occupiesSpace: true
        }
      }
    })
  })
  it('preserves lifecycle metadata and typed forced movement outcomes', () => {
    const result = compileEffectResult({
      id: 'dissonant-whispers-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: 'dw-save',
          dcMethod: 'FIXED_DC',
          ability: 'WISDOM',
          baseDc: 14
        },
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: 'dw-range',
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: 'FEET'
        }
      },
      paths: [
        {
          id: 'dw-forced-movement',
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'dw-forced-movement__result',
            resultKind: 'SEQUENCE' as const,
            lifecycle: {
              recurringKind: 'NONE',
              consumeOnFirstEvent: 'ON_ATTACK_ROLL',
              endOnEvents: ['ON_CAST_SPELL']
            },
            outcomes: [
              {
                id: 'dw-forced-movement',
                effectKind: EFFECT_KIND.FORCED_MOVEMENT,
                direction: FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE,
                distanceMode: 'UP_TO_SPEED',
                actionEconomy: FORCED_MOVEMENT_ACTION_ECONOMY.REACTION
              }
            ]
          }
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }
    expect(result.value.entries[0]).toMatchObject({
      pathCode: PATH_CODE.ON_SAVE_FAIL,
      lifecycle: {
        recurringKind: 'NONE',
        consumeOnFirstEvent: 'ON_ATTACK_ROLL',
        endOnEvents: ['ON_CAST_SPELL']
      },
      outcome: {
        effectKind: EFFECT_KIND.FORCED_MOVEMENT,
        direction: FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE,
        distanceMode: 'UP_TO_SPEED',
        actionEconomy: FORCED_MOVEMENT_ACTION_ECONOMY.REACTION
      }
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
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
  TRIGGER
} from '#core'
import { compileConditionEffect, compileEffectResult } from '#compilers'
import { checksumRuleDocument } from '../domains/rules/checksum.js'

function expectNoUndefined(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) expectNoUndefined(entry)
    return
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      expect(entry).not.toBeUndefined()
      expectNoUndefined(entry)
    }
  }
}

describe('effect compiler', () => {
  const seeSource = {
    kind: 'PERCEPTION',
    observer: 'TARGET',
    subject: 'SOURCE',
    requirement: 'SEE'
  } as const
  it.each([
    { name: 'repeatRollInfluence', policy: { influence: 'DISADVANTAGE', when: seeSource } },
    // SPELLS-29.T1a: Fear's repeat save is attempted only while the target can't see its source.
    { name: 'repeatAttemptGate', policy: { allow: 'WHEN_UNMET', when: seeSource } }
  ] as const)('preserves $name in compiled follow-up saves', ({ name, policy }) => {
    const result = compileEffectResult({
      id: 'repeat-roll-influence-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: 'repeat-roll-influence-save',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: '00000000-0000-4000-8000-000000000001',
          baseDc: 10
        },
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'repeat-roll-influence-range', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: 'repeat-roll-influence-path',
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'repeat-roll-influence-result',
            resultKind: 'SEQUENCE',
            outcomes: [
              {
                id: 'repeat-roll-influence-follow-up',
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'TARGET_TURN_END',
                [name]: policy,
                savingThrow: {
                  id: 'repeat-roll-influence-follow-up-save',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: '00000000-0000-4000-8000-000000000001',
                  baseDc: 10
                },
                attempts: { kind: 'ONCE', repeatOnFailure: true },
                onSuccess: { kind: 'END' },
                onFailure: { kind: 'CONTINUE' }
              }
            ]
          }
        }
      ]
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    const entry = result.value.entries[0]
    if (!entry || !('outcome' in entry)) throw new Error('Expected compiled follow-up-save entry.')
    expect(entry.outcome).toMatchObject({
      effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
      [name]: policy
    })
  })

  it('omits absent optional damage fields from canonical compiled output', () => {
    const result = compileEffectResult({
      id: 'canonical-damage-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'canonical-damage-range', rangeKind: RANGE_KIND.SELF }
      },
      paths: [
        {
          id: 'canonical-damage-path',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'canonical-damage-result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'canonical-damage-outcome',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: 'canonical-damage-type',
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.NONE,
                diceConfig: '1d6',
                bonuses: [
                  {
                    id: 'canonical-damage-bonus',
                    bonusKind: DAMAGE_BONUS_KIND.ABILITY_BONUS,
                    ability: 'STRENGTH',
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
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    expectNoUndefined(result.value)
    expect(() => checksumRuleDocument(result.value)).not.toThrow()
  })

  it('compiles a rider that takes the triggering weapon damage type without a damage type identity', () => {
    const result = compileEffectResult({
      id: 'weapon-type-rider-effect',
      order: 1,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        range: { id: 'weapon-type-rider-range', rangeKind: RANGE_KIND.SPECIAL },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' }
      },
      paths: [
        {
          id: 'weapon-type-rider-path',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: 'weapon-type-rider-result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'weapon-type-rider-outcome',
                effectKind: EFFECT_KIND.DAMAGE,
                usesTriggeringWeaponDamageType: true,
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.NONE,
                diceConfig: '1d6'
              }
            ]
          }
        }
      ]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    expectNoUndefined(result.value)
    const entry = result.value.entries[0]
    if (!entry || !('outcome' in entry)) throw new Error('Expected a compiled damage entry.')
    expect(entry.outcome).toMatchObject({ usesTriggeringWeaponDamageType: true })
    expect(entry.outcome).not.toHaveProperty('damageTypeId')
  })

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
        resultBlockId: 'slowed__result',
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
          conditionId: 'slowed',
          recordsSource: false,
          fleesSource: false
        }
      },
      {
        id: 'poisoned',
        entryId: 'poisoned',
        resultBlockId: 'poisoned__result',
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
          conditionId: 'poisoned',
          recordsSource: false,
          fleesSource: false
        }
      }
    ])
  })
  it('compiles non-damage effect outcomes like apply-grant and rule without flattening them away', () => {
    const result = compileEffectResult({
      id: 'shield-effect',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
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
        resultBlockId: 'shield-buff__result',
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
        }
      },
      {
        id: 'shield-rule',
        entryId: 'shield-rule',
        resultBlockId: 'shield-rule__result',
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
        }
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
        triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
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
        resultBlockId: 'choice-copy-direct__result',
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
        resultBlockId: 'choice-copy-roll-entry__result',
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
                  size: 'LARGE',
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
          size: 'LARGE',
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
          abilityDefinitionId: '00000000-0000-0000-0011-000500000000',
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
              consumeOnFirstEvents: ['ON_ATTACK_ROLL'],
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
        consumeOnFirstEvents: ['ON_ATTACK_ROLL'],
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

describe('a condition that flees its source (SPELLS-29.T2)', () => {
  const authored = {
    id: 'fear',
    effectKind: EFFECT_KIND.CONDITION,
    conditionId: 'frightened'
  } as const

  it('compiles an authored fleesSource and states false when it is not authored', () => {
    expect(
      compileConditionEffect({ ...authored, recordsSource: true, fleesSource: true })
    ).toMatchObject([{ recordsSource: true, fleesSource: true }])
    expect(compileConditionEffect({ ...authored, recordsSource: true })).toMatchObject([
      { fleesSource: false }
    ])
  })
})

describe('hit-point gate and tiers (SPELLS-4.T2i)', () => {
  const invocation = {
    triggerCode: TRIGGER.ACTIVATED,
    activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
    range: { id: 'tier-range', rangeKind: RANGE_KIND.SELF }
  } as const
  const kill = { id: 'kill', effectKind: EFFECT_KIND.KILL } as const

  it('carries a result block gate onto each compiled entry', () => {
    const result = compileEffectResult({
      id: 'gated-effect',
      order: 1,
      invocation,
      paths: [
        {
          id: 'gated-path',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'gated-result',
            resultKind: 'SINGLE',
            gate: { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 100 },
            outcomes: [kill]
          }
        }
      ]
    })
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    expect(result.value.entries).toMatchObject([
      { gate: { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 100 }, outcome: kill }
    ])
  })

  it('carries an at-least gate onto a compiled heal entry', () => {
    const heal = {
      id: 'heal',
      effectKind: EFFECT_KIND.HEAL,
      valueKind: 'FIXED',
      scalingKind: SCALING.NONE,
      amount: 10
    } as const
    const result = compileEffectResult({
      id: 'regen-effect',
      order: 1,
      invocation: { triggerCode: TRIGGER.START_OF_TURN, kind: 'PASSIVE', range: invocation.range },
      paths: [
        {
          id: 'regen-path',
          order: 1,
          pathCode: PATH_CODE.PASSIVE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'regen-result',
            resultKind: 'SINGLE',
            gate: { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 },
            outcomes: [heal]
          }
        }
      ]
    })
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    expect(result.value.entries).toMatchObject([
      { gate: { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 }, outcome: heal }
    ])
  })

  it('carries a reduced-to-0 gate onto the entry it follows damage with', () => {
    const gate = {
      kind: 'REDUCED_TO_ZERO_BY',
      damageOutcomeId: '00000000-0000-4000-8000-0000000000d1'
    } as const
    const result = compileEffectResult({
      id: 'slay-effect',
      order: 1,
      invocation,
      paths: [
        {
          id: 'slay-path',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'slay-result',
            resultKind: 'SINGLE',
            gate,
            outcomes: [kill]
          }
        }
      ]
    })
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    expect(result.value.entries).toMatchObject([{ gate, outcome: kill }])
  })

  it('compiles each tier row to its own entry carrying the row ceiling', () => {
    const result = compileEffectResult({
      id: 'tier-effect',
      order: 1,
      invocation,
      paths: [
        {
          id: 'tier-path',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'HIT_POINT_TIERS',
          rows: [
            {
              id: 'low',
              order: 1,
              atMost: 20,
              resultBlock: { id: 'low-result', resultKind: 'SINGLE', outcomes: [kill] }
            },
            {
              id: 'high',
              order: 2,
              atMost: 30,
              resultBlock: { id: 'high-result', resultKind: 'SINGLE', outcomes: [kill] }
            }
          ]
        }
      ]
    })
    if (!result.ok) throw new Error('Expected compileEffectResult to succeed')
    expect(result.value.entries).toMatchObject([
      { hitPointTier: { atMost: 20 }, outcome: kill },
      { hitPointTier: { atMost: 30 }, outcome: kill }
    ])
  })
})

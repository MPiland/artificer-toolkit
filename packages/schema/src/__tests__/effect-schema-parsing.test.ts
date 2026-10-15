import { describe, expect, it } from 'vitest'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'

import { effectDtoSchema } from '../effects/effect.js'
import { hitPointMaximumReductionDtoSchema } from '../effects/hitPointMaximumReduction.js'
import { manifestBehaviorPathDtoSchema, pathDtoSchema } from '../effects/path.js'
import { targetingDtoSchema } from '../effects/targeting.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'

type ParsedEffectForAssertions = {
  invocation: {
    kind?: string
    triggerCode?: string
    savingThrow?: unknown
  }
  paths: Array<{
    pathCode?: string
    options?: Array<Record<string, unknown>>
    rows?: Array<Record<string, unknown>>
    resultBlock?: {
      outcomes?: Array<
        Record<string, unknown> & {
          bonuses?: Array<Record<string, unknown>>
        }
      >
      lifecycle?: Record<string, unknown>
    }
  }>
}

function singleResultBlock(
  id: string,
  outcome: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    resultKind: 'SINGLE',
    outcomes: [outcome],
    ...extra
  }
}

function sequenceResultBlock(
  id: string,
  outcomes: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
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

describe('effect schema parsing', () => {
  it.each([
    ['path', pathDtoSchema],
    ['manifest behavior path', manifestBehaviorPathDtoSchema]
  ] as const)('accepts closed-rule and manual outcomes through the %s schema', (_name, schema) => {
    const outcomes = [
      {
        id: 'closed-rule-outcome',
        effectKind: 'CLOSED_RULE',
        ruleKind: CLOSED_RULE_KIND.ANIMAL_FRIENDSHIP
      },
      {
        id: 'manual-adjudication-outcome',
        effectKind: 'MANUAL_ADJUDICATION',
        label: 'Resolve manually',
        instructions: 'Resolve at the table.',
        reasonCode: 'NARRATIVE_JUDGMENT'
      }
    ]
    const malformedOutcomes: Record<string, unknown>[] = [
      { ...outcomes[0], ruleKind: undefined },
      { ...outcomes[0], ruleKind: 'NOT_A_RULE' }
    ]
    for (const missingField of ['label', 'instructions', 'reasonCode'] as const) {
      const outcome: Record<string, unknown> = { ...outcomes[1] }
      delete outcome[missingField]
      malformedOutcomes.push(outcome)
    }

    for (const outcome of outcomes) {
      const parsed = schema.parse(
        fixedPath(
          `${outcome.id}-path`,
          1,
          'ON_USE',
          singleResultBlock(`${outcome.id}-result`, outcome)
        )
      )
      expect(parsed).toMatchObject({
        resultBlock: { outcomes: [{ effectKind: outcome.effectKind }] }
      })
    }
    for (const outcome of malformedOutcomes) {
      expect(
        schema.safeParse(
          fixedPath(
            'invalid-outcome-path',
            1,
            'ON_USE',
            singleResultBlock('invalid-outcome-result', outcome)
          )
        ).success
      ).toBe(false)
    }
  })

  it.each([
    ['path', pathDtoSchema],
    ['manifest behavior path', manifestBehaviorPathDtoSchema]
  ] as const)(
    'accepts a payload-free ADD_SPEED_TO_MOVEMENT rule and an ENABLE opportunity-attack-immunity grant through the %s schema',
    (_name, schema) => {
      const outcomes = [
        { id: 'dash-outcome', effectKind: 'MOVEMENT_RULE', ruleKind: 'ADD_SPEED_TO_MOVEMENT' },
        {
          id: 'disengage-outcome',
          effectKind: 'APPLY_GRANT',
          grants: {
            modifiers: [
              {
                id: 'disengage-grant',
                grantKind: 'MODIFIER_GRANT',
                valueDomainCode: 'OPPORTUNITY_ATTACK_IMMUNITY',
                domain: {},
                modifierKind: 'ENABLE',
                scope: 'GLOBAL',
                selectionKind: 'GRANTED',
                order: 0
              }
            ]
          }
        }
      ]
      for (const outcome of outcomes)
        expect(
          schema.parse(
            fixedPath(
              `${outcome.id}-path`,
              1,
              'ON_USE',
              singleResultBlock(`${outcome.id}-result`, outcome)
            )
          )
        ).toMatchObject({ resultBlock: { outcomes: [{ effectKind: outcome.effectKind }] } })
    }
  )

  it('accepts one UUID-backed maximum hit point reduction source and its recovery tags', () => {
    const valid = {
      id: '00000000-0000-4000-8000-0000000000f0',
      effectKind: 'HIT_POINT_MAXIMUM_REDUCTION',
      amountSource: {
        kind: 'DAMAGE_TAKEN',
        damageOutcomeId: '00000000-0000-4000-8000-0000000000f1'
      },
      recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
    }
    expect(hitPointMaximumReductionDtoSchema.safeParse(valid).success).toBe(true)
    // Life Drain also ends on a long rest (D62).
    for (const recoveryTags of [
      ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST'],
      ['LONG_REST', 'RESTORE_HIT_POINT_MAXIMUM']
    ])
      expect(hitPointMaximumReductionDtoSchema.safeParse({ ...valid, recoveryTags }).success).toBe(
        true
      )
    // Restoration magic always ends a reduction; tags are unique.
    for (const recoveryTags of [
      [],
      ['LONG_REST'],
      ['RESTORE_HIT_POINT_MAXIMUM', 'RESTORE_HIT_POINT_MAXIMUM'],
      ['RESTORE_HIT_POINT_MAXIMUM', 'SHORT_REST']
    ])
      expect(hitPointMaximumReductionDtoSchema.safeParse({ ...valid, recoveryTags }).success).toBe(
        false
      )
    expect(
      hitPointMaximumReductionDtoSchema.safeParse({
        ...valid,
        amountSource: { kind: 'DAMAGE_TAKEN', damageOutcomeId: 'damage-1' }
      }).success
    ).toBe(false)
  })

  it('rejects a cylinder shape without its authored height', () => {
    expect(
      effectDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000e0',
        order: 1,
        invocation: {
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: {
            id: 'cylinder-range',
            rangeKind: 'DISTANCE',
            amount: 30,
            unit: 'FEET'
          },
          shape: {
            id: 'cylinder-shape',
            shapeKind: 'CYLINDER',
            radius: { amount: 10, unit: 'FEET' }
          }
        },
        paths: [
          fixedPath(
            'cylinder-path',
            1,
            'ON_USE',
            singleResultBlock('cylinder-result', {
              id: 'cylinder-outcome',
              effectKind: 'CONDITION',
              conditionId: 'cylinder-condition'
            })
          )
        ]
      }).success
    ).toBe(false)
  })

  it('accepts action resource use and rejects passive, zero-cost, and partial resource use', () => {
    const actionEffect = {
      id: '00000000-0000-4000-8000-0000000000e1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: { id: 'resource-use-range', rangeKind: 'SELF' },
        resourceUse: { chargeId: 'resource-use-charge', cost: 2 }
      },
      paths: [
        fixedPath(
          'resource-use-path',
          1,
          'ON_USE',
          singleResultBlock('resource-use-result', {
            id: 'resource-use-outcome',
            effectKind: 'CONDITION',
            conditionId: 'resource-use-condition'
          })
        )
      ]
    }

    expect(effectDtoSchema.safeParse(actionEffect).success).toBe(true)
    expect(
      effectDtoSchema.safeParse({
        ...actionEffect,
        invocation: { ...actionEffect.invocation, kind: 'PASSIVE' }
      }).success
    ).toBe(false)
    expect(
      effectDtoSchema.safeParse({
        ...actionEffect,
        invocation: {
          ...actionEffect.invocation,
          resourceUse: { chargeId: 'resource-use-charge', cost: 0 }
        }
      }).success
    ).toBe(false)
    expect(
      effectDtoSchema.safeParse({
        ...actionEffect,
        invocation: {
          ...actionEffect.invocation,
          resourceUse: { chargeId: 'resource-use-charge' }
        }
      }).success
    ).toBe(false)
  })

  it('accepts an ATTACKED_SELF reaction trigger only on a REACTION action', () => {
    const attackedSelf = {
      id: '00000000-0000-4000-8000-0000000000ea',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'REACTION', amount: 1 },
        range: { id: 'attacked-self-range', rangeKind: 'SELF' },
        reactionTrigger: { kind: 'ATTACKED_SELF' }
      },
      paths: [
        fixedPath(
          'attacked-self-path',
          1,
          'ON_USE',
          singleResultBlock('attacked-self-result', {
            id: 'attacked-self-outcome',
            effectKind: 'CONDITION',
            conditionId: 'attacked-self-condition'
          })
        )
      ]
    }

    expect(effectDtoSchema.parse(attackedSelf).invocation).toMatchObject({
      reactionTrigger: { kind: 'ATTACKED_SELF' }
    })
    expect(
      effectDtoSchema.safeParse({
        ...attackedSelf,
        invocation: {
          ...attackedSelf.invocation,
          activation: { code: 'ACTION', amount: 1 }
        }
      }).success
    ).toBe(false)
    expect(
      effectDtoSchema.safeParse({
        ...attackedSelf,
        invocation: { ...attackedSelf.invocation, reactionTrigger: { kind: 'UNKNOWN' } }
      }).success
    ).toBe(false)
  })

  it('accepts only REACTION action movement trigger bindings', () => {
    const reactionEffect = {
      id: '00000000-0000-4000-8000-0000000000e9',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'REACTION', amount: 1 },
        range: { id: 'reaction-range', rangeKind: 'SELF' },
        reactionTrigger: {
          kind: 'MOVEMENT',
          stage: 'ENTER_REACH',
          perceptionRequirement: null,
          eligibilityDefinitionId: 'AAAAAAAA-0000-4000-8000-000000000001'
        }
      },
      paths: [
        fixedPath(
          'reaction-path',
          1,
          'ON_USE',
          singleResultBlock('reaction-result', {
            id: 'reaction-outcome',
            effectKind: 'CONDITION',
            conditionId: 'reaction-condition'
          })
        )
      ]
    }

    const parsed = effectDtoSchema.parse(reactionEffect)
    expect(parsed.invocation).toMatchObject({
      reactionTrigger: {
        kind: 'MOVEMENT',
        stage: 'ENTER_REACH',
        perceptionRequirement: null,
        eligibilityDefinitionId: 'aaaaaaaa-0000-4000-8000-000000000001'
      }
    })
    expect(
      effectDtoSchema.safeParse({
        ...reactionEffect,
        invocation: {
          ...reactionEffect.invocation,
          activation: { code: 'ACTION', amount: 1 }
        }
      }).success
    ).toBe(false)
    expect(
      effectDtoSchema.safeParse({
        ...reactionEffect,
        invocation: { ...reactionEffect.invocation, kind: 'PASSIVE' }
      }).success
    ).toBe(false)
  })

  it('parses effects with nested saving throw invocations and fixed paths', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000e2',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'dex-save',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          baseDc: 13
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
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.paths).toHaveLength(1)
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
    expect(parsed.paths[0]).toMatchObject({
      pathCode: 'ON_SAVE_FAIL'
    })
  })

  it('accepts repeat roll influence only on a target-turn-end repeated follow-up save', () => {
    const followUpSave = {
      id: '00000000-0000-4000-8000-0000000000e4',
      effectKind: 'FOLLOW_UP_SAVE',
      timing: 'TARGET_TURN_END',
      repeatRollInfluence: {
        influence: 'DISADVANTAGE',
        when: {
          kind: 'PERCEPTION',
          observer: 'TARGET',
          subject: 'SOURCE',
          requirement: 'SEE'
        }
      },
      savingThrow: {
        id: '00000000-0000-4000-8000-0000000000e5',
        dcMethod: 'FIXED_DC',
        abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
        baseDc: 13
      },
      attempts: { kind: 'ONCE', repeatOnFailure: true },
      onSuccess: { kind: 'END' },
      onFailure: { kind: 'CONTINUE' }
    }
    const conditionOutcome = {
      id: '00000000-0000-4000-8000-0000000000e8',
      effectKind: 'CONDITION',
      conditionId: '00000000-0000-4000-8000-0000000000e9'
    }
    const effect = {
      id: '00000000-0000-4000-8000-0000000000e6',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: '00000000-0000-4000-8000-0000000000e7',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          baseDc: 13
        },
        activation: { code: 'ACTION', amount: 1 },
        range: { id: 'repeat-save-range', rangeKind: 'UNLIMITED' },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        fixedPath(
          'repeat-save-path',
          1,
          'ON_SAVE_FAIL',
          sequenceResultBlock('repeat-save-result', [conditionOutcome, followUpSave])
        )
      ]
    }

    expect(effectDtoSchema.safeParse(effect).success).toBe(true)
    expect(
      effectDtoSchema.safeParse({
        ...effect,
        paths: [
          fixedPath(
            'repeat-save-path',
            1,
            'ON_SAVE_FAIL',
            sequenceResultBlock('repeat-save-result', [
              conditionOutcome,
              { ...followUpSave, timing: 'TARGET_TURN_START' }
            ])
          )
        ]
      }).success
    ).toBe(false)
  })

  it('parses passive effects with saving throw invocations', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000e3',
      order: 1,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'spirit-guardians-save',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000500000000',
          baseDc: 15
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
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.invocation.kind).toBe('PASSIVE')
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
    expect('savingThrow' in parsed.invocation).toBe(true)
  })

  it('parses labeled choice options and roll-table rows for authored copy', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000e4',
      order: 1,
      invocation: {
        triggerCode: 'RANGED_SPELL_ATTACK',
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
            resolutionKind: 'RESULT',
            resultBlock: singleResultBlock('choice-copy-roll-result', {
              id: 'choice-copy-roll-outcome',
              effectKind: 'MANUAL_ADJUDICATION',
              label: 'Primary Result',
              instructions: 'Resolve the selected table result.',
              reasonCode: 'NARRATIVE_JUDGMENT'
            })
          }
        ])
      ]
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.paths[0]?.options?.[0]).toMatchObject({
      label: 'Primary Result',
      description: 'The main outcome when the effect resolves.'
    })

    expect(parsed.paths[1]?.rows?.[0]).not.toHaveProperty('label')
    expect(parsed.paths[1]?.rows?.[0]).not.toHaveProperty('description')
  })

  it('parses non-damage outcome families such as apply-grant and rule fallbacks', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000e5',
      order: 1,
      invocation: {
        triggerCode: 'RANGED_SPELL_ATTACK',
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
          })
        ),
        fixedPath(
          'shield-rule',
          2,
          'ON_CAST',
          singleResultBlock('shield-rule-result', {
            id: 'shield-rule-entry',
            effectKind: 'MANUAL_ADJUDICATION',
            label: 'Shield rule fallback',
            instructions: 'Resolve the shield rule that is not represented by the typed grant.',
            reasonCode: 'NARRATIVE_JUDGMENT'
          })
        )
      ]
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.paths).toHaveLength(2)
  })

  it('parses result-block lifecycle metadata and sequential outcomes', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000e6',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'wis-save',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000500000000',
          baseDc: 14
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
                consumeOnFirstEvents: ['ON_ATTACK_ROLL'],
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
          lifecycle?: { consumeOnFirstEvents?: string[] }
        }
      }>
    }

    expect(parsed.paths?.[0]?.resultBlock).toMatchObject({
      outcomes: [{ effectKind: 'DAMAGE' }, { effectKind: 'FORCED_MOVEMENT' }],
      lifecycle: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] }
    }) as unknown as ParsedEffectForAssertions
  })

  it('parses activated feature-style effects with on-use healing bonuses', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000e7',
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
                classId: 'fighter',
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
            bonuses?: Array<{ bonusKind?: string; classId?: string }>
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
          id: '00000000-0000-4000-8000-0000000000e8',
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
        invocation?: { activation?: { code?: string; amount?: number } }
        paths?: Array<{
          resultBlock?: {
            outcomes?: Array<{ effectKind?: string; manifestKind?: string }>
          }
        }>
      }>
    }

    expect(parsed.effects?.[0]?.invocation?.activation).toMatchObject({
      code: 'ACTION',
      amount: 1
    })
    expect((parsed as { components?: string[] }).components).toEqual([
      'VERBAL',
      'SOMATIC',
      'MATERIAL'
    ])
    expect(parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]).toMatchObject({
      effectKind: 'MANIFEST',
      manifestKind: 'CREATURE'
    })
  })

  it('rejects non-UUID Effect entry points before authored domain evaluation', () => {
    expect(
      effectDtoSchema.safeParse({
        id: 'not-an-effect-uuid',
        order: 1,
        invocation: {
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: 'invalid-effect-range', rangeKind: 'SELF' }
        },
        paths: [
          fixedPath(
            'invalid-effect-path',
            1,
            'ON_USE',
            singleResultBlock('invalid-effect-result', {
              id: 'invalid-effect-outcome',
              effectKind: 'MANUAL_ADJUDICATION',
              label: 'Manual resolution',
              instructions: 'Resolve at the table.',
              reasonCode: 'NARRATIVE_JUDGMENT'
            })
          )
        ]
      }).success
    ).toBe(false)
  })
})

describe('single-target self policy (D99)', () => {
  it.each(['ALLOWED', 'WARN', 'REFUSED'])('keeps self: %s on a single target', (self) => {
    const targeting = { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY', self }

    expect(targetingDtoSchema.parse(targeting)).toEqual(targeting)
  })

  it('rejects a self policy that is not one of the three', () => {
    const targeting = { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }

    expect(targetingDtoSchema.safeParse({ ...targeting, self: 'yes' }).success).toBe(false)
    expect(targetingDtoSchema.safeParse({ ...targeting, self: true }).success).toBe(false)
  })
})

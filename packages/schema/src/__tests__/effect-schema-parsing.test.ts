import { describe, expect, it } from 'vitest'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'

import { effectDtoSchema } from '../effects/effect.js'
import { createFollowUpSaveDtoSchema } from '../effects/followUpSave.js'
import { hitPointMaximumReductionDtoSchema } from '../effects/hitPointMaximumReduction.js'
import { manifestBehaviorPathDtoSchema, pathDtoSchema } from '../effects/path.js'
import { targetingDtoSchema } from '../effects/targeting.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'
import { z } from '../zod.js'

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
        ruleKind: CLOSED_RULE_KIND.CONTAGION
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

  it('accepts a SPELL_CAST reaction that cancels the triggering event, only on a REACTION action', () => {
    const spellCast = {
      id: '00000000-0000-4000-8000-0000000000ec',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'REACTION', amount: 1 },
        range: { id: 'spell-cast-range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
        reactionTrigger: { kind: 'SPELL_CAST' }
      },
      paths: [
        fixedPath(
          'spell-cast-path',
          1,
          'ON_USE',
          singleResultBlock('spell-cast-result', {
            id: 'spell-cast-outcome',
            effectKind: 'CANCEL_TRIGGERING_EVENT'
          })
        )
      ]
    }

    expect(effectDtoSchema.parse(spellCast).invocation).toMatchObject({
      reactionTrigger: { kind: 'SPELL_CAST' }
    })
    expect(
      effectDtoSchema.safeParse({
        ...spellCast,
        invocation: { ...spellCast.invocation, activation: { code: 'ACTION', amount: 1 } }
      }).success
    ).toBe(false)
    expect(
      effectDtoSchema.safeParse({
        ...spellCast,
        invocation: { ...spellCast.invocation, reactionTrigger: { kind: 'SPELL_CAST', stage: 'X' } }
      }).success
    ).toBe(false)
  })

  it('accepts a SPELL_CAST reaction that gates a higher-level cast behind an ability check', () => {
    const withCheck = (higherLevelCheck: unknown) =>
      effectDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000ed',
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          activation: { code: 'REACTION', amount: 1 },
          range: { id: 'gate-range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
          reactionTrigger: { kind: 'SPELL_CAST', higherLevelCheck }
        },
        paths: [
          fixedPath(
            'gate-path',
            1,
            'ON_USE',
            singleResultBlock('gate-result', {
              id: 'gate-outcome',
              effectKind: 'CANCEL_TRIGGERING_EVENT'
            })
          )
        ]
      })

    expect(withCheck({ ability: 'SPELLCASTING', baseDc: 10 }).success).toBe(true)
    expect(withCheck({ ability: 'WISDOM', baseDc: 0 }).success).toBe(true)
    expect(withCheck({ ability: 'NONE', baseDc: 10 }).success).toBe(false)
    expect(withCheck({ ability: 'SPELLCASTING', baseDc: -1 }).success).toBe(false)
    expect(withCheck({ ability: 'SPELLCASTING', baseDc: 10.5 }).success).toBe(false)
    expect(withCheck({ ability: 'SPELLCASTING' }).success).toBe(false)
  })

  it('accepts a DAMAGE_TAKEN reaction trigger naming at least one damage type', () => {
    const fire = '00000000-0000-4000-8000-0000000000f1'
    const cold = '00000000-0000-4000-8000-0000000000f2'
    const damageTaken = {
      id: '00000000-0000-4000-8000-0000000000eb',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'REACTION', amount: 1 },
        range: { id: 'damage-taken-range', rangeKind: 'SELF' },
        reactionTrigger: { kind: 'DAMAGE_TAKEN', damageTypeIds: [fire, cold] }
      },
      paths: [
        fixedPath(
          'damage-taken-path',
          1,
          'ON_USE',
          singleResultBlock('damage-taken-result', {
            id: 'damage-taken-outcome',
            effectKind: 'CONDITION',
            conditionId: 'damage-taken-condition'
          })
        )
      ]
    }

    expect(effectDtoSchema.parse(damageTaken).invocation).toMatchObject({
      reactionTrigger: { kind: 'DAMAGE_TAKEN', damageTypeIds: [fire, cold] }
    })
    for (const reactionTrigger of [
      { kind: 'DAMAGE_TAKEN', damageTypeIds: [] },
      { kind: 'DAMAGE_TAKEN' },
      { kind: 'DAMAGE_TAKEN', damageTypeIds: ['fire'] }
    ])
      expect(
        effectDtoSchema.safeParse({
          ...damageTaken,
          invocation: { ...damageTaken.invocation, reactionTrigger }
        }).success
      ).toBe(false)
    expect(
      effectDtoSchema.safeParse({
        ...damageTaken,
        invocation: { ...damageTaken.invocation, activation: { code: 'ACTION', amount: 1 } }
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

  it('accepts a DAMAGE outcome that takes the triggering weapon damage type, but only in place of a damage type', () => {
    const damage = {
      id: 'weapon-type-damage',
      effectKind: 'DAMAGE',
      valueKind: 'DICE',
      scalingKind: 'NONE',
      diceConfig: '1d6'
    }
    const parse = (outcome: Record<string, unknown>) =>
      pathDtoSchema.safeParse(
        fixedPath('weapon-type-path', 1, 'ON_HIT', singleResultBlock('weapon-type-result', outcome))
      )

    expect(parse({ ...damage, usesTriggeringWeaponDamageType: true }).success).toBe(true)
    expect(parse({ ...damage, damageTypeId: 'fire' }).success).toBe(true)
    expect(
      parse({ ...damage, damageTypeId: 'fire', usesTriggeringWeaponDamageType: false }).success
    ).toBe(true)
    expect(parse(damage).success).toBe(false)
    expect(
      parse({ ...damage, usesTriggeringWeaponDamageType: true, damageTypeId: 'fire' }).success
    ).toBe(false)
    expect(parse({ ...damage, usesTriggeringWeaponDamageType: false }).success).toBe(false)
  })

  it("lets only a passive Effect's fixed ON_HIT damage take the triggering weapon damage type", () => {
    const riderDamage = {
      id: 'rider-damage',
      effectKind: 'DAMAGE',
      usesTriggeringWeaponDamageType: true,
      valueKind: 'DICE',
      scalingKind: 'NONE',
      diceConfig: '1d6'
    }
    const passive = {
      kind: 'PASSIVE',
      triggerCode: 'MELEE_WEAPON_ATTACK',
      range: { id: 'rider-range', rangeKind: 'SPECIAL' }
    }
    const activated = {
      triggerCode: 'MELEE_WEAPON_ATTACK',
      activation: { code: 'ACTION', amount: 1 },
      range: { id: 'rider-range', rangeKind: 'SELF' }
    }
    const effect = (invocation: Record<string, unknown>, path: Record<string, unknown>) =>
      effectDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000f1',
        order: 1,
        invocation,
        paths: [path]
      }).success
    const placed = (damage: Record<string, unknown>) => ({
      fixed: (pathCode: string) =>
        fixedPath('rider-path', 1, pathCode, singleResultBlock('rider-result', damage)),
      choice: choicePath('rider-path', 1, 'ON_HIT', [
        {
          id: 'rider-option',
          order: 1,
          label: 'Rider option',
          description: 'One damage option.',
          resultBlock: singleResultBlock('rider-result', damage)
        }
      ])
    })
    const rider = placed(riderDamage)
    const named = placed({
      ...riderDamage,
      usesTriggeringWeaponDamageType: false,
      damageTypeId: 'fire'
    })

    // The same placements are valid for damage that names its type.
    expect(effect(passive, named.fixed('ON_CRIT'))).toBe(true)
    expect(effect(activated, named.fixed('ON_HIT'))).toBe(true)
    expect(effect(passive, named.choice)).toBe(true)

    expect(effect(passive, rider.fixed('ON_HIT'))).toBe(true)
    expect(effect(passive, rider.fixed('ON_CRIT'))).toBe(false)
    expect(effect(activated, rider.fixed('ON_HIT'))).toBe(false)
    expect(effect(passive, rider.choice)).toBe(false)
  })

  it('lets only a passive attack rider name the Feature whose attack it rides (SPELLS-33.T5n2)', () => {
    const path = fixedPath(
      'rider-path',
      1,
      'ON_HIT',
      singleResultBlock('rider-result', {
        id: 'rider-damage',
        effectKind: 'DAMAGE',
        damageTypeId: 'fire',
        valueKind: 'DICE',
        scalingKind: 'NONE',
        diceConfig: '1d6'
      })
    )
    const effect = (invocation: Record<string, unknown>) =>
      effectDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000f2',
        order: 1,
        invocation: { range: { id: 'rider-range', rangeKind: 'SPECIAL' }, ...invocation },
        paths: [path]
      }).success

    expect(
      effect({ kind: 'PASSIVE', triggerCode: 'MELEE_WEAPON_ATTACK', ridesFeatureId: 'ram' })
    ).toBe(true)
    expect(
      effect({
        triggerCode: 'MELEE_WEAPON_ATTACK',
        activation: { code: 'ACTION', amount: 1 },
        ridesFeatureId: 'ram'
      })
    ).toBe(false)
  })

  it('accepts a path gated on the attack roll mode, and rejects an unknown mode', () => {
    const gate = (condition: Record<string, unknown>) => ({
      id: 'gate',
      groups: [
        {
          id: 'gate-group',
          order: 0,
          contexts: [
            {
              id: 'gate-context',
              order: 0,
              subject: 'EQUIPMENT',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'gate-condition',
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  ...condition
                }
              ]
            }
          ]
        }
      ]
    })
    const parse = (restrictions: Record<string, unknown>) =>
      pathDtoSchema.safeParse(
        fixedPath(
          'gated-path',
          1,
          'ON_HIT',
          singleResultBlock('gated-result', {
            id: 'gated-damage',
            effectKind: 'DAMAGE',
            damageTypeId: 'fire',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '1d6'
          }),
          { restrictions }
        )
      )

    for (const rollMode of ['ADVANTAGE', 'DISADVANTAGE']) {
      expect(parse(gate({ predicateCode: 'ATTACK_ROLL_MODE', rollMode })).success).toBe(true)
    }
    expect(
      parse(gate({ predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'DISADVANTAGE', negated: true }))
        .success
    ).toBe(true)
    // The wire checks the code's shape; the System's rollMode list decides membership at ingress.
    expect(
      parse(gate({ predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'not_disadvantage' })).success
    ).toBe(false)
    expect(parse(gate({ predicateCode: 'ATTACK_ROLL_MODE' })).success).toBe(false)

    expect(parse(gate({ predicateCode: 'ENEMY_NEAR_TARGET', feet: 5 })).success).toBe(true)
    for (const feet of [0, -5, undefined]) {
      expect(parse(gate({ predicateCode: 'ENEMY_NEAR_TARGET', feet })).success).toBe(false)
    }

    expect(parse(gate({ predicateCode: 'MOVED_TOWARD_TARGET', minFeet: 20 })).success).toBe(true)
    for (const minFeet of [0, -5, undefined]) {
      expect(parse(gate({ predicateCode: 'MOVED_TOWARD_TARGET', minFeet })).success).toBe(false)
    }
    expect(parse(gate({ predicateCode: 'TARGET_HAS_NOT_TAKEN_TURN' })).success).toBe(true)

    for (const requiresDaylight of [true, false]) {
      expect(
        parse(gate({ predicateCode: 'HOLDER_IN_BRIGHT_LIGHT', requiresDaylight })).success
      ).toBe(true)
    }
    expect(parse(gate({ predicateCode: 'HOLDER_IN_BRIGHT_LIGHT' })).success).toBe(false)
  })

  it('lets only an ON_HIT or ON_CRIT path carry restrictions', () => {
    const restrictions = {
      id: 'gate',
      groups: [
        {
          id: 'gate-group',
          order: 0,
          contexts: [
            {
              id: 'gate-context',
              order: 0,
              subject: 'EQUIPMENT',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'gate-condition',
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'ATTACK_ROLL_MODE',
                  rollMode: 'ADVANTAGE'
                }
              ]
            }
          ]
        }
      ]
    }
    const effect = (pathCode: string) =>
      effectDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000f2',
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          range: { id: 'gate-range', rangeKind: 'SPECIAL' }
        },
        paths: [
          fixedPath(
            'gated-path',
            1,
            pathCode,
            singleResultBlock('gated-result', {
              id: 'gated-damage',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '1d6'
            }),
            { restrictions }
          )
        ]
      }).success

    expect(effect('ON_HIT')).toBe(true)
    expect(effect('ON_CRIT')).toBe(true)
    expect(effect('ON_SAVE_FAIL')).toBe(false)
    expect(effect('ON_MISS')).toBe(false)
  })

  it('lets only an ON_HIT or ON_CRIT path carry a once-per-turn usage limit', () => {
    const effect = (pathCode: string, usage: string) =>
      effectDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000f3',
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          range: { id: 'usage-range', rangeKind: 'SPECIAL' }
        },
        paths: [
          fixedPath(
            'limited-path',
            1,
            pathCode,
            singleResultBlock('limited-result', {
              id: 'limited-damage',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '1d6'
            }),
            { usage }
          )
        ]
      }).success

    expect(effect('ON_HIT', 'ONCE_PER_TURN')).toBe(true)
    expect(effect('ON_CRIT', 'ONCE_PER_TURN')).toBe(true)
    expect(effect('ON_HIT', 'TWICE_PER_TURN')).toBe(false)
    expect(effect('ON_SAVE_FAIL', 'ONCE_PER_TURN')).toBe(false)
    expect(effect('ON_MISS', 'ONCE_PER_TURN')).toBe(false)
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

  it('accepts a repeat attempt gate only on a target-turn-end repeated save with no roll influence (SPELLS-29.T1a)', () => {
    const when = { kind: 'PERCEPTION', observer: 'TARGET', subject: 'SOURCE', requirement: 'SEE' }
    const followUpSaveDtoSchema = createFollowUpSaveDtoSchema(z.unknown())
    const followUpSave = (overrides: Record<string, unknown>) =>
      followUpSaveDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000ea',
        effectKind: 'FOLLOW_UP_SAVE',
        timing: 'TARGET_TURN_END',
        repeatAttemptGate: { allow: 'WHEN_UNMET', when },
        savingThrow: {
          id: '00000000-0000-4000-8000-0000000000eb',
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000500000000'
        },
        attempts: { kind: 'ONCE', repeatOnFailure: true },
        onSuccess: { kind: 'END' },
        onFailure: { kind: 'CONTINUE' },
        ...overrides
      }).success

    expect(followUpSave({})).toBe(true)
    expect(followUpSave({ repeatAttemptGate: { allow: 'WHEN_MET', when } })).toBe(true)
    expect(followUpSave({ repeatAttemptGate: { allow: 'ALWAYS', when } })).toBe(false)
    expect(followUpSave({ timing: 'TARGET_TURN_START' })).toBe(false)
    expect(followUpSave({ attempts: { kind: 'ONCE' } })).toBe(false)
    // The immediate-save plan carries no gate, so the schema must not accept one it cannot run.
    const immediateRepeat = {
      timing: 'IMMEDIATE',
      repeatTiming: 'TARGET_TURN_END',
      onFailure: { kind: 'OUTCOMES', endCurrent: false, resultKind: 'SINGLE', outcomes: [] }
    }
    expect(followUpSave({ ...immediateRepeat, repeatAttemptGate: undefined })).toBe(true)
    expect(followUpSave(immediateRepeat)).toBe(false)
    // The runtime carries one perception result per repeated save, so one perception rule at most.
    expect(followUpSave({ repeatRollInfluence: { influence: 'DISADVANTAGE', when } })).toBe(false)
  })

  it('accepts repeat triggers only on a repeated one-time follow-up save', () => {
    const followUpSaveDtoSchema = createFollowUpSaveDtoSchema(z.unknown())
    const trigger = { kind: 'DAMAGE_TAKEN', by: 'ANYONE', rollInfluence: 'ADVANTAGE' }
    const followUpSave = (overrides: Record<string, unknown>) =>
      followUpSaveDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000ec',
        effectKind: 'FOLLOW_UP_SAVE',
        timing: 'TARGET_TURN_END',
        repeatTriggers: [trigger],
        savingThrow: {
          id: '00000000-0000-4000-8000-0000000000ed',
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000500000000'
        },
        attempts: { kind: 'ONCE', repeatOnFailure: true },
        onSuccess: { kind: 'END' },
        onFailure: { kind: 'CONTINUE' },
        ...overrides
      }).success

    expect(followUpSave({})).toBe(true)
    expect(followUpSave({ repeatTriggers: [{ kind: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE' }] })).toBe(
      true
    )
    expect(followUpSave({ repeatTriggers: [] })).toBe(false)
    expect(followUpSave({ repeatTriggers: [{ ...trigger, kind: 'HOLDER_ACTION' }] })).toBe(false)
    // The schema checks a System code's shape; the System's rollInfluence list decides membership.
    expect(followUpSave({ repeatTriggers: [{ ...trigger, rollInfluence: 'maybe' }] })).toBe(false)
    expect(followUpSave({ attempts: { kind: 'ONCE' } })).toBe(false)
  })

  it('makes an ON_TRIGGERS_ONLY save only on repeat triggers (D176)', () => {
    const followUpSaveDtoSchema = createFollowUpSaveDtoSchema(z.unknown())
    const when = { kind: 'PERCEPTION', observer: 'TARGET', subject: 'SOURCE', requirement: 'SEE' }
    const followUpSave = (overrides: Record<string, unknown>) =>
      followUpSaveDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000ee',
        effectKind: 'FOLLOW_UP_SAVE',
        timing: 'ON_TRIGGERS_ONLY',
        repeatTriggers: [{ kind: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE' }],
        savingThrow: {
          id: '00000000-0000-4000-8000-0000000000ef',
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000500000000'
        },
        attempts: { kind: 'ONCE', repeatOnFailure: true },
        onSuccess: { kind: 'END' },
        onFailure: { kind: 'CONTINUE' },
        ...overrides
      }).success

    expect(followUpSave({})).toBe(true)
    expect(followUpSave({ repeatTriggers: undefined })).toBe(false)
    expect(followUpSave({ attempts: { kind: 'ONCE' } })).toBe(false)
    expect(followUpSave({ repeatRollInfluence: { influence: 'ADVANTAGE', when } })).toBe(false)
    expect(followUpSave({ repeatAttemptGate: { allow: 'WHEN_MET', when } })).toBe(false)
    // It is a first timing only: an immediate save cannot repeat "only on triggers".
    expect(followUpSave({ timing: 'IMMEDIATE', repeatTiming: 'ON_TRIGGERS_ONLY' })).toBe(false)
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

describe('failure margin rider on a direct saving throw (SPELLS-33.T7b)', () => {
  const rider = {
    id: '00000000-0000-4000-8000-0000000000f1',
    failedBy: 5,
    outcomes: [
      {
        id: '00000000-0000-4000-8000-0000000000f2',
        effectKind: 'CONDITION',
        conditionId: '00000000-0000-4000-8000-0000000000f3'
      }
    ],
    lifecycle: {}
  }
  const effectWith = (pathCode: string, triggerCode = 'SAVING_THROW', margin = rider) => ({
    id: '00000000-0000-4000-8000-0000000000f4',
    order: 1,
    invocation: {
      triggerCode,
      savingThrow: {
        id: '00000000-0000-4000-8000-0000000000f5',
        dcMethod: 'FIXED_DC',
        abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
        baseDc: 11
      },
      activation: { code: 'ACTION', amount: 1 },
      range: { id: 'rider-range', rangeKind: 'SELF' }
    },
    paths: [
      fixedPath(
        '00000000-0000-4000-8000-0000000000f6',
        1,
        pathCode,
        singleResultBlock(
          '00000000-0000-4000-8000-0000000000f7',
          {
            id: '00000000-0000-4000-8000-0000000000f8',
            effectKind: 'CONDITION',
            conditionId: '00000000-0000-4000-8000-0000000000f9'
          },
          { failureMarginRider: margin }
        )
      )
    ]
  })

  it('keeps the rider on the failed result of a saving-throw action', () => {
    const parsed = effectDtoSchema.parse(effectWith('ON_SAVE_FAIL'))

    expect(parsed.paths[0]).toMatchObject({ resultBlock: { failureMarginRider: rider } })
  })

  it('keeps the condition outcome the rider ends with (D172)', () => {
    const linked = { ...rider, endsWithOutcomeId: '00000000-0000-4000-8000-0000000000fa' }
    const parsed = effectDtoSchema.parse(effectWith('ON_SAVE_FAIL', 'SAVING_THROW', linked))

    expect(parsed.paths[0]).toMatchObject({ resultBlock: { failureMarginRider: linked } })
  })

  it.each([
    ['a successful save', effectWith('ON_SAVE_SUCCESS')],
    ['an action that is not a saving throw', effectWith('ON_SAVE_FAIL', 'ACTIVATED')]
  ])('refuses the rider on %s', (_label, effect) => {
    expect(effectDtoSchema.safeParse(effect).success).toBe(false)
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

describe('single-target size limit (D152)', () => {
  const targeting = { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' }

  it.each([0, 1])('keeps a limit of %i steps above the actor', (stepsAboveActor) => {
    const limited = { ...targeting, sizeLimit: { stepsAboveActor } }

    expect(targetingDtoSchema.parse(limited)).toEqual(limited)
  })

  it('rejects a negative or fractional limit', () => {
    for (const stepsAboveActor of [-1, 0.5])
      expect(
        targetingDtoSchema.safeParse({ ...targeting, sizeLimit: { stepsAboveActor } }).success
      ).toBe(false)
  })
})

describe('hit-point gate, hit-point tiers and kill (SPELLS-4.T2i)', () => {
  const kill = { id: '00000000-0000-4000-8000-0000000001a1', effectKind: 'KILL' }
  const gated = (gate: unknown) => ({
    id: '00000000-0000-4000-8000-0000000001a2',
    order: 1,
    invocation: {
      triggerCode: 'ACTIVATED',
      activation: { code: 'ACTION', amount: 1 },
      range: { id: 'gate-range', rangeKind: 'SELF' }
    },
    paths: [
      fixedPath(
        '00000000-0000-4000-8000-0000000001a3',
        1,
        'ON_USE',
        singleResultBlock('00000000-0000-4000-8000-0000000001a4', kill, { gate })
      )
    ]
  })

  it('keeps a whole-number hit-point gate around a kill', () => {
    const gate = { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 100 }
    expect(effectDtoSchema.parse(gated(gate)).paths[0]).toMatchObject({
      resultBlock: { gate, outcomes: [{ effectKind: 'KILL' }] }
    })
  })

  it('keeps an at-least hit-point gate', () => {
    const gate = { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 }
    expect(effectDtoSchema.parse(gated(gate)).paths[0]).toMatchObject({ resultBlock: { gate } })
  })

  it('keeps a reduced-to-0 gate naming the damage outcome it follows', () => {
    const gate = {
      kind: 'REDUCED_TO_ZERO_BY',
      damageOutcomeId: '00000000-0000-4000-8000-0000000001b1'
    }
    expect(effectDtoSchema.parse(gated(gate)).paths[0]).toMatchObject({ resultBlock: { gate } })
  })

  it.each([
    ['a zero amount', { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 0 }],
    ['a fractional amount', { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 1.5 }],
    ['an unknown kind', { kind: 'TARGET_IS_BLOODIED', amount: 10 }],
    ['a reduced-to-0 gate without its damage outcome', { kind: 'REDUCED_TO_ZERO_BY' }],
    ['a reduced-to-0 gate with a hit-point amount', { kind: 'REDUCED_TO_ZERO_BY', amount: 5 }]
  ])('refuses a gate with %s', (_label, gate) => {
    expect(effectDtoSchema.safeParse(gated(gate)).success).toBe(false)
  })

  it('parses hit-point tiers whose rows each carry their own result block', () => {
    const effect = gated({ kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 1 })
    const parsed = effectDtoSchema.safeParse({
      ...effect,
      paths: [
        {
          id: '00000000-0000-4000-8000-0000000001a5',
          order: 1,
          pathCode: 'ON_USE',
          groupType: 'SINGLE',
          selectionKind: 'HIT_POINT_TIERS',
          rows: [
            {
              id: '00000000-0000-4000-8000-0000000001a6',
              order: 1,
              atMost: 20,
              resultBlock: singleResultBlock('00000000-0000-4000-8000-0000000001a7', kill)
            }
          ]
        }
      ]
    })
    expect(parsed.success, JSON.stringify(parsed)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  ACTIVATION_CODE,
  DAMAGE_VALUE_KIND,
  CHARGE_RESET_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  BRANCH_ROLL_TABLE_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  TRIGGER
} from '#core'
import {
  compileCharge,
  compileDamageEffect,
  compileEffectResult,
  compileFeatGrant,
  compileFeatGrantResult,
  compileFeatureResult,
  compileScalingSource
} from '#compilers'

describe('shared compiler scaling', () => {
  it('compiles scaling sources with their required payload', () => {
    expect(
      compileScalingSource({
        scalingSource: SCALING_SOURCE.CLASS_LEVEL,
        classId: 'wizard'
      })
    ).toEqual({
      scalingSource: SCALING_SOURCE.CLASS_LEVEL,
      classId: 'wizard'
    })

    expect(
      compileScalingSource({
        scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
      })
    ).toEqual({
      scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
    })
  })

  it('compiles per-level fixed charge progressions without flattening levels', () => {
    const compiled = compileCharge({
      id: 'arcane-recovery-uses',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: SCALING.PER_LEVEL,
      resetKind: CHARGE_RESET_KIND.LONG_REST,
      levels: [
        {
          id: 'charge-level-1',
          level: 1,
          amount: 1
        },
        {
          id: 'charge-level-5',
          level: 5,
          amount: 2
        }
      ]
    })

    expect(compiled).toEqual({
      id: 'arcane-recovery-uses',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: SCALING.PER_LEVEL,
      resetKind: CHARGE_RESET_KIND.LONG_REST,
      bonuses: undefined,
      levels: [
        {
          id: 'charge-level-1',
          level: 1,
          amount: 1
        },
        {
          id: 'charge-level-5',
          level: 5,
          amount: 2
        }
      ]
    })
  })

  it('returns a compile result and preserves nested spell-grant scaling on features', () => {
    const authored = {
      id: 'wizard-spell-progression',
      label: 'Wizard Spell Progression',
      description: 'Baseline SRD spell access with room for homebrew progression.',
      order: 1,
      grants: {
        spells: [
          {
            grantKind: GRANT_KIND.SPELL_GRANT,
            id: 'wizard-spells',
            order: 1,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
              scalingSource: SCALING_SOURCE.CLASS_LEVEL,
              classId: 'wizard',
              levels: [
                {
                  id: 'wizard-spells-1',
                  level: 1,
                  order: 1,
                  count: 2,
                  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                  spellIds: ['magic-missile', 'shield']
                },
                {
                  id: 'wizard-spells-3',
                  level: 3,
                  order: 2,
                  count: 1,
                  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                  spellIds: ['misty-step']
                }
              ]
            }
          }
        ]
      }
    } satisfies FeatureAuthored

    const result = compileFeatureResult(authored)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileFeatureResult to succeed')
    }

    expect(result.diagnostics).toEqual([])
    expect(result.value.id).toBe('wizard-spell-progression')
    expect(result.value.spells).toHaveLength(1)
    expect(result.value.spells?.[0]).toMatchObject({
      grantKind: GRANT_KIND.SPELL_GRANT,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource: SCALING_SOURCE.CLASS_LEVEL,
      classId: 'wizard',
      levels: [
        {
          id: 'wizard-spells-1',
          level: 1,
          count: 2,
          order: 1,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['magic-missile', 'shield']
        },
        {
          id: 'wizard-spells-3',
          level: 3,
          count: 1,
          order: 2,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['misty-step']
        }
      ]
    })
  })

  it('compiles spell-level damage scaling into discrete compiled outcomes', () => {
    const compiled = compileDamageEffect({
      id: 'burning-hands-upcast',
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: 'fire',
      valueKind: DAMAGE_VALUE_KIND.DICE,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
      levels: [
        {
          id: 'burning-hands-1',
          level: 1,
          order: 1,
          diceConfig: '3d6'
        },
        {
          id: 'burning-hands-2',
          level: 2,
          order: 2,
          diceConfig: '4d6'
        },
        {
          id: 'burning-hands-3',
          level: 3,
          order: 3,
          diceConfig: '5d6'
        }
      ]
    })

    expect(compiled).toEqual([
      {
        id: 'burning-hands-1',
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: 'fire',
        valueKind: DAMAGE_VALUE_KIND.DICE,
        level: 1,
        order: 1,
        dice: '3d6',
        bonuses: undefined,
        scalingKind: SCALING.PER_LEVEL,
        scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
      },
      {
        id: 'burning-hands-2',
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: 'fire',
        valueKind: DAMAGE_VALUE_KIND.DICE,
        level: 2,
        order: 2,
        dice: '4d6',
        bonuses: undefined,
        scalingKind: SCALING.PER_LEVEL,
        scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
      },
      {
        id: 'burning-hands-3',
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: 'fire',
        valueKind: DAMAGE_VALUE_KIND.DICE,
        level: 3,
        order: 3,
        dice: '5d6',
        bonuses: undefined,
        scalingKind: SCALING.PER_LEVEL,
        scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
      }
    ])
  })

  it('preserves class-level chosen feat grant progression for SRD-style feature gates', () => {
    const compiled = compileFeatGrant({
      grantKind: GRANT_KIND.FEAT_GRANT,
      id: 'fighting-style-progression',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.PER_LEVEL,
      progression: {
        scalingSource: SCALING_SOURCE.CLASS_LEVEL,
        classId: 'fighter',
        levels: [
          {
            id: 'fighting-style-1',
            level: 1,
            order: 1,
            count: 1,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            featIds: ['archery', 'defense']
          },
          {
            id: 'fighting-style-10',
            level: 10,
            order: 2,
            count: 1,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            featIds: ['superior-technique']
          }
        ]
      }
    })

    expect(compiled).toEqual({
      grantKind: GRANT_KIND.FEAT_GRANT,
      id: 'fighting-style-progression',
      order: 1,
      charges: undefined,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource: SCALING_SOURCE.CLASS_LEVEL,
      classId: 'fighter',
      levels: [
        {
          id: 'fighting-style-1',
          level: 1,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          featIds: ['archery', 'defense'],
          order: 1,
          count: 1
        },
        {
          id: 'fighting-style-10',
          level: 10,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          featIds: ['superior-technique'],
          order: 2,
          count: 1
        }
      ]
    })
  })

  it('exposes grant compiler result wrappers without breaking current grant compilers', () => {
    const result = compileFeatGrantResult({
      grantKind: GRANT_KIND.FEAT_GRANT,
      id: 'bonus-feat',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      featIds: ['alert']
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileFeatGrantResult to succeed')
    }

    expect(result.diagnostics).toEqual([])
    expect(result.value).toEqual(
      compileFeatGrant({
        grantKind: GRANT_KIND.FEAT_GRANT,
        id: 'bonus-feat',
        order: 1,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        featIds: ['alert']
      })
    )
  })

  it('preserves explicit ALL grant authoring mode in compiled grant output', () => {
    const compiled = compileFeatGrant({
      grantKind: GRANT_KIND.FEAT_GRANT,
      id: 'explicit-all-bonus-feat',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      charges: undefined,
      authoringModeKind: AUTHORING_MODE_KIND.ALL
    })

    expect(compiled).toEqual({
      grantKind: GRANT_KIND.FEAT_GRANT,
      id: 'explicit-all-bonus-feat',
      order: 1,
      charges: undefined,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.ALL
    })
  })

  it('compiles exact roll-table condition branches through the effect result wrapper', () => {
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
      branches: [
        {
          id: 'potion-side-effects-table',
          branch: BRANCH.PASSIVE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.ROLL_TABLE,
          rollTableKind: BRANCH_ROLL_TABLE_KIND.EXACT,
          dieConfig: 'd6',
          table: [
            {
              id: 'slowed',
              rollValue: 1,
              effectKind: EFFECT_KIND.CONDITION,
              conditionId: 'slowed'
            },
            {
              id: 'poisoned',
              rollValue: 2,
              effectKind: EFFECT_KIND.CONDITION,
              conditionId: 'poisoned'
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
    expect(result.value).toEqual([
      {
        id: 'slowed',
        branch: BRANCH.PASSIVE,
        resolutionKind: BRANCH_RESOLUTION_KIND.ROLL_TABLE,
        rollTableKind: BRANCH_ROLL_TABLE_KIND.EXACT,
        die: 'd6',
        rollValue: 1,
        outcome: {
          id: 'slowed',
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: 'slowed'
        },
        order: 0,
        duration: undefined
      },
      {
        id: 'poisoned',
        branch: BRANCH.PASSIVE,
        resolutionKind: BRANCH_RESOLUTION_KIND.ROLL_TABLE,
        rollTableKind: BRANCH_ROLL_TABLE_KIND.EXACT,
        die: 'd6',
        rollValue: 2,
        outcome: {
          id: 'poisoned',
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: 'poisoned'
        },
        order: 1,
        duration: undefined
      }
    ])
  })

  it('compiles non-damage capability outcomes like apply-grant and rule without flattening them away', () => {
    const result = compileEffectResult({
      id: 'shield-capability',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
        range: {
          id: 'shield-self',
          rangeKind: RANGE_KIND.SELF
        }
      },
      branches: [
        {
          id: 'shield-buff',
          branch: BRANCH.ON_CAST,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
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
        {
          id: 'shield-rule',
          branch: BRANCH.ON_CAST,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Intercepts Magic Missile',
          description: 'The shield blocks the magic missile spell until the start of your next turn.'
        }
      ]
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }

    expect(result.value).toEqual([
      {
        id: 'shield-buff',
        branch: BRANCH.ON_CAST,
        resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
        groupKind: BRANCH_GROUP_TYPE.SINGLE,
        outcome: {
          id: 'shield-buff',
          effectKind: EFFECT_KIND.APPLY_GRANT,
          branch: BRANCH.ON_CAST,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
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
        order: 0,
        duration: undefined
      },
      {
        id: 'shield-rule',
        branch: BRANCH.ON_CAST,
        resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
        groupKind: BRANCH_GROUP_TYPE.SINGLE,
        outcome: {
          id: 'shield-rule',
          effectKind: EFFECT_KIND.RULE,
          branch: BRANCH.ON_CAST,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          label: 'Intercepts Magic Missile',
          description: 'The shield blocks the magic missile spell until the start of your next turn.'
        },
        order: 1,
        duration: undefined
      }
    ])
  })

  it('preserves activated on-use healing capabilities with structured heal bonuses', () => {
    const result = compileEffectResult({
      id: 'second-wind-capability',
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
      branches: [
        {
          id: 'second-wind-heal',
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
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
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }

    expect(result.value[0]).toMatchObject({
      branch: BRANCH.ON_USE,
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

  it('compiles long-cast manifest capabilities with separate activation and casting layers', () => {
    const result = compileEffectResult({
      id: 'find-familiar-capability',
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
          selectionKind: 'AREA_CONTENTS',
          detail: 'The familiar appears in an unoccupied space within range.'
        }
      },
      branches: [
        {
          id: 'find-familiar-branch',
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: 'find-familiar-duration',
            durationKind: 'UNTIL_DISPELLED'
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: 'CREATURE',
          label: 'Familiar'
        }
      ]
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected compileEffectResult to succeed')
    }

    expect(result.value[0]).toMatchObject({
      branch: BRANCH.ON_USE,
      outcome: {
        effectKind: EFFECT_KIND.MANIFEST,
        manifestKind: 'CREATURE',
        label: 'Familiar'
      }
    })
  })
})

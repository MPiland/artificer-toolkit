import { describe, expect, it } from 'vitest'
import type { FeatAuthored, FeatureAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CHARGE_RESET_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  SCALING,
  SCALING_SOURCE
} from '#core'
import {
  compileCharge,
  compileChargeUse,
  compileDamageEffect,
  compileFeat,
  compileFeatGrant,
  compileFeatGrantResult,
  compileFeatureResult,
  compileScalingSource,
  compileSpellGrant
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

  it('preserves source charge consumption without compiling another resource pool', () => {
    expect(
      compileChargeUse({
        id: 'warping-strike-charges',
        limitKind: 'SOURCE_CHARGES',
        scalingKind: SCALING.NONE,
        cost: 1
      })
    ).toEqual({
      id: 'warping-strike-charges',
      limitKind: 'SOURCE_CHARGES',
      scalingKind: SCALING.NONE,
      cost: 1
    })
  })
  it('preserves exact reusable definition identities on compiled Features', () => {
    const ruleDefinitionIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    ]
    const result = compileFeatureResult({
      id: 'feature-rule-bindings',
      label: 'Feature rule bindings',
      description: 'Uses reusable rule definitions.',
      order: 0,
      ruleDefinitionIds
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.ruleDefinitionIds).toEqual(ruleDefinitionIds)
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
                  selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
                  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                  spellIds: ['magic-missile', 'shield']
                },
                {
                  id: 'wizard-spells-3',
                  level: 3,
                  order: 2,
                  count: 1,
                  selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
          selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
          spellIds: ['magic-missile', 'shield']
        },
        {
          id: 'wizard-spells-3',
          level: 3,
          count: 1,
          order: 2,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
          spellIds: ['misty-step']
        }
      ]
    })
  })
  it('preserves feat grants on authored feats during compilation', () => {
    const authored = {
      id: 'feat-with-feat-grant',
      label: 'Feat Chain',
      description: 'Unlocks a related feat.',
      grants: {
        feats: [
          {
            grantKind: GRANT_KIND.FEAT_GRANT,
            id: 'feat-grant-1',
            order: 1,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            featIds: ['grappler']
          }
        ]
      },
      userId: 'user-1',
      systemId: 'system-1'
    } satisfies FeatAuthored
    const compiled = compileFeat(authored)
    expect(compiled.feats).toHaveLength(1)
    expect(compiled.feats?.[0]).toMatchObject({
      grantKind: GRANT_KIND.FEAT_GRANT,
      featIds: ['grappler']
    })
  })
  it('preserves spell grant restrictions and filters in the compiled grant shape', () => {
    const compiled = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'circle-spells-arctic',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.PER_LEVEL,
      progression: {
        scalingSource: SCALING_SOURCE.CLASS_LEVEL,
        classId: 'druid',
        levels: [
          {
            id: 'circle-spells-3',
            level: 3,
            order: 1,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: ['spike-growth']
          }
        ]
      },
      restrictions: {
        groups: [
          {
            contexts: [
              {
                subject: 'SUBCLASS',
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                conditions: [
                  {
                    predicateCode: 'SUBCLASS_SPECIALIZATION',
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    specializationIds: ['arctic']
                  }
                ]
              }
            ]
          }
        ]
      },
      filters: {
        groups: [
          {
            contexts: [
              {
                subject: 'SPELL',
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                conditions: [
                  {
                    predicateCode: 'SPELL_LEVEL',
                    min: 2
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never)
    expect(compiled).toMatchObject({
      grantKind: GRANT_KIND.SPELL_GRANT,
      restrictions: {
        groups: [
          {
            contexts: [
              {
                subject: 'SUBCLASS',
                conditions: [
                  {
                    predicateCode: 'SUBCLASS_SPECIALIZATION',
                    specializationIds: ['arctic']
                  }
                ]
              }
            ]
          }
        ]
      },
      filters: {
        groups: [
          {
            contexts: [
              {
                subject: 'SPELL',
                conditions: [
                  {
                    predicateCode: 'SPELL_LEVEL',
                    min: 2
                  }
                ]
              }
            ]
          }
        ]
      }
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
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            featIds: ['archery', 'defense']
          },
          {
            id: 'fighting-style-10',
            level: 10,
            order: 2,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
          count: 1,
          selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE
        },
        {
          id: 'fighting-style-10',
          level: 10,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          featIds: ['superior-technique'],
          order: 2,
          count: 1,
          selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE
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
})

import { describe, expect, it } from 'vitest'

import { divineWord } from '@artificer-toolkit/source-data/srd/spells/divine-word.js'

import type { CharacterRuleActionActiveEffectPlan } from '../characterRuleActionSystemAdapter.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { selectHitPointTierPlan } from '../hitPointTiers.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'

/**
 * A cast of Divine Word compiled by the real entry-point compiler and graph compile. `planOverride`
 * replaces the plans the adapter derives, to prove the compiler's tier rules.
 */
function compiledTieredCast(
  planOverride?: (
    plans: readonly CharacterRuleActionActiveEffectPlan[]
  ) => CharacterRuleActionActiveEffectPlan[]
) {
  const spell = divineWord
  return compiledTestSpellCast({
    spell,
    adapter: {
      ...dnd5eCharacterRuleActionSystemAdapter,
      activeEffectPlans: (input) => {
        const plans = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.(input) ?? []
        return planOverride ? planOverride(plans) : plans
      }
    },
    cast: {
      sequence: 0,
      candidateId: `CLASS:class-${spell.id}:${spell.id}:level:7`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId: `class-${spell.id}` },
      spellLevel: 7,
      castMode: 'SPELL_SLOT',
      castLevel: 7,
      baseEntry: true,
      resourceOwnerKey: null
    },
    decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:7' }
  })
}

describe('hit point tiered active-effect plans (SPELLS-4.T2i4a, Divine Word SPELLS-4.T2i4b2)', () => {
  const { compilation } = compiledTieredCast().entry
  const plans = compilation.hitPointTierPlans ?? []

  it('plans one active effect per timed tier, each carrying its ceiling and its own duration', () => {
    expect(plans.map((plan) => [plan.hitPointTier?.atMost, plan.initialRemaining]).sort()).toEqual([
      [30, 600],
      [40, 100],
      [50, 10]
    ])
  })

  it.each([
    [30, 30],
    [31, 40],
    [40, 40],
    [41, 50],
    [50, 50]
  ])('chooses the %i hit point target the %i ceiling plan', (hitPoints, atMost) => {
    expect(selectHitPointTierPlan([20, 30, 40, 50], plans, hitPoints)?.hitPointTier?.atMost).toBe(
      atMost
    )
  })

  it('chooses no plan for a target above every ceiling', () => {
    expect(selectHitPointTierPlan([20, 30, 40, 50], plans, 51)).toBeNull()
  })

  it('compiles the tiers to one plan each, with no plan that serves every target', () => {
    expect(compilation.activeEffectPlan).toBeNull()
    expect(compilation.hitPointTierPlans?.map((plan) => plan.hitPointTier?.atMost).sort()).toEqual([
      30, 40, 50
    ])
  })

  it('refuses two plans for one tier', () => {
    expect(() =>
      compiledTieredCast((plans) =>
        plans.map((plan) => ({ ...plan, hitPointTier: { atMost: 30 } }))
      )
    ).toThrow('does not compile to an Encounter action')
  })

  it('refuses a tiered plan beside a plan that serves every target', () => {
    expect(() =>
      compiledTieredCast(([tiered, ...rest]) => [
        ...(tiered ? [{ ...tiered, hitPointTier: undefined }] : []),
        ...rest
      ])
    ).toThrow('does not compile to an Encounter action')
  })
})

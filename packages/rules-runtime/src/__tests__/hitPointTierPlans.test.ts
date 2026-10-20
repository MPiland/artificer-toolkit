import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import {
  DURATION_KIND,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE
} from '@artificer-toolkit/shared/core'
import { powerWordStun } from '@artificer-toolkit/source-data/srd/spells/power-word-stun.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { CharacterRuleActionActiveEffectPlan } from '../characterRuleActionSystemAdapter.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { selectHitPointTierPlan } from '../hitPointTiers.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'

function conditionId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((conditionType) => conditionType.code === code)
  if (!entry) throw new Error(`Condition ${code} required.`)
  return entry.id
}

function tierRow(order: number, atMost: number, code: string, minutes: number) {
  return {
    id: testUuid(0xd100 + order),
    order,
    atMost,
    resultBlock: {
      id: testUuid(0xd110 + order),
      resultKind: 'SINGLE' as const,
      duration: {
        id: testUuid(0xd120 + order),
        durationKind: DURATION_KIND.MINUTE,
        amount: minutes
      },
      outcomes: [
        {
          id: testUuid(0xd130 + order),
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: conditionId(code)
        }
      ]
    }
  }
}

const TIER_CONDITIONS = ['DEAFENED', 'BLINDED', 'STUNNED']

const [stunEffect] = powerWordStun.effects ?? []
if (!stunEffect) throw new Error('Expected the Power Word Stun effect.')

/** A single-target action whose condition and duration depend on the target's hit points. */
const tieredEffect: EffectAuthored = {
  ...stunEffect,
  id: ACTION_EFFECT_ID,
  paths: [
    {
      id: testUuid(0xd140),
      order: 1,
      pathCode: PATH_CODE.ON_USE,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'HIT_POINT_TIERS',
      rows: [
        tierRow(1, 50, TIER_CONDITIONS[0]!, 1),
        tierRow(2, 30, TIER_CONDITIONS[1]!, 10),
        tierRow(3, 40, TIER_CONDITIONS[2]!, 60)
      ]
    }
  ]
}

/** A published graph the adapter compiles today (Power Word Stun's); stands in for the tiered one. */
const stunAction = {
  ...characterActionDescriptor(compileEffect({ ...stunEffect, id: ACTION_EFFECT_ID })),
  conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id)
}
const stunPlan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
  action: stunAction,
  compilerSource: buildCompiledActionCompilerSource(stunAction)
})
if (stunPlan?.kind !== 'SINGLE_GRAPH') throw new Error('Expected a single-graph plan.')
const untieredPublished = stunPlan.published

const published = { ...untieredPublished, id: ACTION_EFFECT_ID }

function plans() {
  return (
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action: {
        ...characterActionDescriptor(compileEffect(tieredEffect)),
        conditionDefinitionIds: TIER_CONDITIONS.map(conditionId)
      },
      published
    }) ?? []
  )
}

/**
 * A cast of the tiered spell compiled by the real entry-point compiler. The tiered execution graph
 * is not built yet (SPELLS-4.T2i4b), so the adapter's graph compile is stood in by the published
 * identity; the plans the adapter derives and the compiler's tier rules are the real ones.
 */
function compiledTieredCast(
  planOverride?: (
    plans: readonly CharacterRuleActionActiveEffectPlan[]
  ) => CharacterRuleActionActiveEffectPlan[]
) {
  const spell = { ...powerWordStun, effects: [tieredEffect] }
  return compiledTestSpellCast({
    spell,
    registry: {
      get: () => ({
        ...dnd5eCharacterRuleActionSystemAdapter,
        compileExecutionPlan: undefined,
        compile: ({ action }) => ({ ...untieredPublished, id: action.effectId }),
        activeEffectPlans: (input) => {
          const plans = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.(input) ?? []
          return planOverride ? planOverride(plans) : plans
        }
      })
    },
    cast: {
      sequence: 0,
      candidateId: `CLASS:class-${spell.id}:${spell.id}:level:8`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId: `class-${spell.id}` },
      spellLevel: 8,
      castMode: 'SPELL_SLOT',
      castLevel: 8,
      baseEntry: true,
      resourceOwnerKey: null
    },
    decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:8' }
  })
}

describe('hit point tiered active-effect plans (SPELLS-4.T2i4a)', () => {
  it('plans one active effect per tier, each carrying its ceiling and its own duration', () => {
    expect(
      plans()
        .map((plan) => [plan.hitPointTier?.atMost, plan.initialRemaining])
        .sort()
    ).toEqual([
      [30, 100],
      [40, 600],
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
    expect(selectHitPointTierPlan([30, 40, 50], plans(), hitPoints)?.hitPointTier?.atMost).toBe(
      atMost
    )
  })

  it('chooses no plan for a target above every ceiling', () => {
    expect(selectHitPointTierPlan([30, 40, 50], plans(), 51)).toBeNull()
  })

  it('compiles the tiers to one plan each, with no plan that serves every target', () => {
    const { compilation } = compiledTieredCast().entry
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

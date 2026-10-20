import { describe, expect, it } from 'vitest'

import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import {
  DURATION_KIND,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE
} from '@artificer-toolkit/shared/core'
import { divineWord } from '@artificer-toolkit/source-data/srd/spells/divine-word.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { SRD_ABILITIES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { selectHitPointTierPlan } from '../hitPointTiers.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'

function conditionId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((conditionType) => conditionType.code === code)
  if (!entry) throw new Error(`Condition ${code} required.`)
  return entry.id
}

function conditionTier(order: number, atMost: number, codes: string[], minutes: number) {
  return {
    id: testUuid(0xd200 + order),
    order,
    atMost,
    resultBlock: {
      id: testUuid(0xd210 + order),
      resultKind: 'SEQUENCE' as const,
      duration: {
        id: testUuid(0xd220 + order),
        durationKind: DURATION_KIND.MINUTE,
        amount: minutes
      },
      outcomes: codes.map((code, index) => ({
        id: testUuid(0xd230 + order * 8 + index),
        order: index + 1,
        effectKind: EFFECT_KIND.CONDITION,
        conditionId: conditionId(code)
      }))
    }
  }
}

const [saveEffect] = divineWord.effects ?? []
if (!saveEffect) throw new Error('Expected a saving throw Effect.')

const tieredSave: EffectAuthored = {
  ...saveEffect,
  paths: [
    {
      id: testUuid(0xd240),
      order: 1,
      pathCode: PATH_CODE.ON_SAVE_FAIL,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'HIT_POINT_TIERS',
      rows: [
        conditionTier(1, 50, ['DEAFENED'], 1),
        conditionTier(2, 40, ['DEAFENED', 'BLINDED'], 10),
        conditionTier(3, 30, ['BLINDED', 'DEAFENED', 'STUNNED'], 60),
        {
          id: testUuid(0xd250),
          order: 4,
          atMost: 20,
          resultBlock: {
            id: testUuid(0xd251),
            resultKind: 'SINGLE' as const,
            outcomes: [{ id: testUuid(0xd252), effectKind: EFFECT_KIND.KILL }]
          }
        }
      ]
    }
  ]
}

const CHARISMA = SRD_ABILITIES.find(({ code }) => code === 'CHARISMA')!.id
const TARGET_ID = testUuid(0xd260)
/** Out of reach of any d20 total, so every target fails the save. */
const UNSAVEABLE_DC = 99

const spell = { ...divineWord, effects: [tieredSave] }
const { entry } = compiledTestSpellCast({
  spell,
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
const { executionPlan, hitPointTierPlans = [], hitPointTiers = [] } = entry.compilation

/** Casts the tiered save at a target with `hitPoints` that cannot make it. */
function cast(hitPoints: number) {
  return executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: executionPlan,
    occurrenceId: testUuid(0xd261),
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: { abilityDefinitionId: CHARISMA, dc: UNSAVEABLE_DC },
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: {
        statBlock: { armorClass: 12 },
        savingThrowDefinitions: [
          { abilityDefinitionId: CHARISMA, modifier: 0, rollMode: 'NORMAL', contributors: [] }
        ]
      },
      targetConditionIds: [],
      currentHitPoints: hitPoints,
      temporaryHitPoints: 0,
      maximumHitPoints: 60,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined
  })
}

describe('hit point tiered saving throw (SPELLS-4.T2i4b1)', () => {
  it('is a saving throw followed by its tier outcome, with a plan for each timed tier and none for the kill', () => {
    expect(executionPlan.kind).toBe('TEST_OUTCOME')
    expect(hitPointTiers).toEqual([20, 30, 40, 50])
    expect(
      hitPointTierPlans
        .map((plan) => [
          plan.hitPointTier?.atMost,
          plan.initialRemaining,
          plan.conditionContributions?.length
        ])
        .sort()
    ).toEqual([
      [30, 600, 3],
      [40, 100, 2],
      [50, 10, 1]
    ])
  })

  it.each([
    [20, null],
    [21, 30],
    [30, 30],
    [31, 40],
    [40, 40],
    [41, 50],
    [50, 50],
    [51, null]
  ])('gives a failed %i hit point target the %s tier plan', (hitPoints, atMost) => {
    expect(
      selectHitPointTierPlan(hitPointTiers, hitPointTierPlans, hitPoints)?.hitPointTier?.atMost ??
        null
    ).toBe(atMost)
  })

  it.each([
    [20, ['KILL']],
    [21, ['CONDITION_APPLY', 'CONDITION_APPLY', 'CONDITION_APPLY']],
    [30, ['CONDITION_APPLY', 'CONDITION_APPLY', 'CONDITION_APPLY']],
    [31, ['CONDITION_APPLY', 'CONDITION_APPLY']],
    [40, ['CONDITION_APPLY', 'CONDITION_APPLY']],
    [41, ['CONDITION_APPLY']],
    [50, ['CONDITION_APPLY']],
    [51, []]
  ])(
    'applies only the tier whose band holds a failed %i hit point target',
    async (hitPoints, kinds) => {
      const result = await cast(hitPoints)
      expect(result.applications.map(({ kind }) => kind)).toEqual(kinds)
    }
  )

  it('gates the kill on its own band of the hit points fact', async () => {
    const { published } = await cast(20)
    expect(published.definition.nodes).toMatchObject([
      {
        operation: { key: 'dnd5e.kill-proposal', contractVersion: 2 },
        inputs: {
          targetCurrentHitPoints: { kind: 'FACT', factKey: 'dnd5e.target-current-hit-points' },
          hitPointsAbove: { kind: 'LITERAL', value: -1 },
          hitPointsAtMost: { kind: 'LITERAL', value: 20 }
        }
      }
    ])
  })
})

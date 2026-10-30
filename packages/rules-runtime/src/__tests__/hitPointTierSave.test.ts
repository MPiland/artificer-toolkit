import { describe, expect, it } from 'vitest'

import { divineWord } from '@artificer-toolkit/source-data/srd/spells/divine-word.js'
import { SRD_ABILITIES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { selectHitPointTierPlan } from '../hitPointTiers.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'

const CHARISMA = SRD_ABILITIES.find(({ code }) => code === 'CHARISMA')!.id
const TARGET_ID = testUuid(0xd260)
/** Out of reach of any d20 total, so every target fails the save. */
const UNSAVEABLE_DC = 99

const spell = divineWord
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
    resourceOwnerKey: null,
    slotPoolCode: null
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
        attackDomain: null,
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

describe('hit point tiered saving throw (SPELLS-4.T2i4b1, Divine Word SPELLS-4.T2i4b2)', () => {
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

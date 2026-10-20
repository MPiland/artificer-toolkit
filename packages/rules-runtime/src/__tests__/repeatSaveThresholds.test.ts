import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { powerWordStun } from '@artificer-toolkit/source-data/srd/spells/power-word-stun.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SpellAuthored } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'

import { characterRuleActionSystemAdapterRegistry } from '../characterRuleActionSystemAdapterRegistry.js'
import { isSaveTallyStep } from '../encounterTurnEffectState.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  resumeTargetBoundActiveRuleEffectWithPause
} from '../targetBoundActiveRuleEffectExecutor.js'
import { createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'

const SOURCE_ID = testUuid(0xe301)
const TARGET_ID = testUuid(0xe302)
const SAVE_DC = 14
const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id
const STUNNED = SRD_CONDITION_TYPES.find(({ code }) => code === 'STUNNED')!.id

type Attempts = { successesToEnd: number; failuresToResolve: number; consecutive: boolean }

/** A Power Word Stun whose repeated save counts to thresholds, the shape Contagion needs. */
function thresholdSpell(attempts: Attempts): SpellAuthored {
  const [effect] = powerWordStun.effects ?? []
  const [path] = effect!.paths
  if (!path || !('resultBlock' in path)) throw new Error('Expected a result-block path.')
  const block = path.resultBlock
  if (block.resultKind !== 'SEQUENCE') throw new Error('Expected a sequence result block.')
  return {
    ...powerWordStun,
    effects: [
      {
        ...effect!,
        paths: [
          {
            ...path,
            resultBlock: {
              ...block,
              outcomes: block.outcomes.map((outcome) =>
                outcome.effectKind === 'FOLLOW_UP_SAVE'
                  ? { ...outcome, attempts: { kind: 'THRESHOLDS' as const, ...attempts } }
                  : outcome
              )
            }
          }
        ]
      }
    ]
  }
}

function compiled(attempts: Attempts) {
  const spell = thresholdSpell(attempts)
  const { entry } = compiledTestSpellCast({
    spell,
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
  return entry.compilation
}

async function plannedEffect(attempts: Attempts) {
  const { executionPlan, activeEffectPlan } = compiled(attempts)
  if (executionPlan.kind !== 'SINGLE_GRAPH') throw new Error('Expected one graph.')
  const result = await executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: executionPlan,
    occurrenceId: testUuid(0xe303),
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: { abilityDefinitionId: CONSTITUTION, dc: SAVE_DC },
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: { statBlock: { armorClass: 12 }, savingThrowDefinitions: [] },
      targetConditionIds: [],
      currentHitPoints: 100,
      temporaryHitPoints: 0,
      maximumHitPoints: 100,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined
  })
  const planned = prepareEncounterActionEffectPlans({
    encounterId: testUuid(0xe304),
    occurrenceId: testUuid(0xe303),
    commandId: testUuid(0xe305),
    sourceActorId: SOURCE_ID,
    sourceLabel: powerWordStun.label,
    sourceHidden: false,
    currentActorId: null,
    target: {
      actorId: TARGET_ID,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan,
    published: result.published,
    execution: result.execution,
    d20: result.d20,
    applications: result.applications
  })
  if (!planned.recurringEffect) throw new Error('The cast planned no repeating effect.')
  return planned.recurringEffect.definition
}

/** One end-of-turn tick, answered with `face`; a `null` face means the effect must ask for no roll. */
async function endOfTurn(
  definition: Awaited<ReturnType<typeof plannedEffect>>,
  lifecycle: {
    schemaVersion: 1
    remainingTicks: number
    saveTally?: { successes: number; failures: number }
  },
  face: number | null
) {
  const input = {
    activeEffectId: testUuid(0xe306),
    activeEffectVersion: 1,
    definition,
    lifecycle,
    lifecycleChecksum: checksumRuleDocument(lifecycle),
    occurrenceId: testUuid(0xe307),
    targetActorId: TARGET_ID,
    currentHitPoints: 100,
    temporaryHitPoints: 0,
    maximumHitPoints: 100,
    targetScalarValues: {},
    targetConditionIds: [STUNNED],
    targetDerivedFacts: {
      savingThrowDefinitions: [
        { abilityDefinitionId: CONSTITUTION, modifier: 0, rollMode: 'NORMAL', contributors: [] }
      ]
    },
    defenses: [],
    runtime: createSrdRulesRuntime(),
    adapters: characterRuleActionSystemAdapterRegistry
  } as const
  const paused = await executeTargetBoundActiveRuleEffectWithPause(input)
  if (!('continuation' in paused)) {
    if (face !== null) throw new Error('Expected the effect to ask for a save.')
    return paused
  }
  if (face === null) throw new Error('Expected no save to be asked.')
  return resumeTargetBoundActiveRuleEffectWithPause({
    ...input,
    continuation: paused.continuation,
    resolution: {
      requestId: paused.continuation.request.requestId,
      rawFaces: [face],
      rollMode: 'NORMAL',
      addedDice: []
    }
  })
}

const PASS = 20
const FAIL = 1
const START = { schemaVersion: 1 as const, remainingTicks: 10 }

describe('repeat-save THRESHOLDS counts successes and failures across end-of-turn saves (SPELLS-4.T2m1c)', () => {
  it('freezes the authored thresholds into the planned effect', async () => {
    const definition = await plannedEffect({
      successesToEnd: 3,
      failuresToResolve: 2,
      consecutive: true
    })
    expect(Object.values(definition.adapterFacts)).toEqual(expect.arrayContaining([3, 2, true]))
  })

  it('counts a success toward the end without ending the effect early', async () => {
    const definition = await plannedEffect({
      successesToEnd: 2,
      failuresToResolve: 3,
      consecutive: false
    })
    const first = await endOfTurn(definition, START, PASS)
    expect(first).toMatchObject({ terminal: false, saveTally: { successes: 1, failures: 0 } })
  })

  it('ends the effect, releasing its condition, when the success count is reached', async () => {
    const definition = await plannedEffect({
      successesToEnd: 2,
      failuresToResolve: 3,
      consecutive: false
    })
    const ended = await endOfTurn(
      definition,
      { ...START, saveTally: { successes: 1, failures: 2 } },
      PASS
    )
    expect(ended).toMatchObject({
      terminal: true,
      applications: [{ kind: 'CONDITION_REMOVE', conditionId: STUNNED }]
    })
  })

  it('settles the effect at the failure count: it stops rolling and its duration keeps counting', async () => {
    const definition = await plannedEffect({
      successesToEnd: 2,
      failuresToResolve: 3,
      consecutive: false
    })
    const settling = await endOfTurn(
      definition,
      { ...START, saveTally: { successes: 1, failures: 2 } },
      FAIL
    )
    expect(settling).toMatchObject({ terminal: false, saveTally: { successes: 1, failures: 3 } })
    const settled = await endOfTurn(
      definition,
      { ...START, saveTally: { successes: 1, failures: 3 } },
      null
    )
    expect(settled).toMatchObject({ terminal: false, applications: [] })
  })

  it('resets the other count on an opposite result when the thresholds are consecutive', async () => {
    const definition = await plannedEffect({
      successesToEnd: 3,
      failuresToResolve: 3,
      consecutive: true
    })
    const reset = await endOfTurn(
      definition,
      { ...START, saveTally: { successes: 2, failures: 0 } },
      FAIL
    )
    expect(reset).toMatchObject({ terminal: false, saveTally: { successes: 0, failures: 1 } })
  })

  it('keeps the other count on an opposite result when the thresholds are not consecutive', async () => {
    const definition = await plannedEffect({
      successesToEnd: 3,
      failuresToResolve: 3,
      consecutive: false
    })
    const kept = await endOfTurn(
      definition,
      { ...START, saveTally: { successes: 2, failures: 0 } },
      FAIL
    )
    expect(kept).toMatchObject({ terminal: false, saveTally: { successes: 2, failures: 1 } })
  })
})

describe('isSaveTallyStep accepts only one-save advances (SPELLS-4.T2m1c)', () => {
  const before = { successes: 1, failures: 1 }
  it.each([
    ['no tally change recorded', undefined, true],
    ['one more success', { successes: 2, failures: 1 }, true],
    ['one more failure', { successes: 1, failures: 2 }, true],
    ['one success resetting failures', { successes: 2, failures: 0 }, true],
    ['one failure resetting successes', { successes: 0, failures: 2 }, true],
    ['both counts rising', { successes: 2, failures: 2 }, false],
    ['a skipped count', { successes: 3, failures: 1 }, false],
    ['a count going back', { successes: 0, failures: 1 }, false],
    ['no change', { successes: 1, failures: 1 }, false]
  ] as const)('%s', (_label, after, expected) => {
    expect(isSaveTallyStep(before, after)).toBe(expected)
  })

  it('starts a first tally from zero', () => {
    expect(isSaveTallyStep(undefined, { successes: 1, failures: 0 })).toBe(true)
    expect(isSaveTallyStep(undefined, { successes: 1, failures: 1 })).toBe(false)
  })
})

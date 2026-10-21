import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { isSaveTallyStep } from '../encounterTurnEffectState.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  resumeTargetBoundActiveRuleEffectWithPause
} from '../targetBoundActiveRuleEffectExecutor.js'
import { createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  CONSTITUTION,
  plannedThresholdDefinition as plannedEffect,
  TARGET_ID
} from '../testing/repeatSaveThresholdsFixture.js'

const STUNNED = SRD_CONDITION_TYPES.find(({ code }) => code === 'STUNNED')!.id

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
    runtime: createSrdRulesRuntime()
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
    expect(definition.recurrence.saveThresholds).toEqual({
      successesToEnd: 3,
      failuresToResolve: 2,
      consecutive: true
    })
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
  const consecutive = { successesToEnd: 3, failuresToResolve: 3, consecutive: true }
  const counted = { ...consecutive, consecutive: false }
  it.each([
    ['no tally change recorded', undefined, counted, true],
    ['one more success', { successes: 2, failures: 1 }, counted, true],
    ['one more failure', { successes: 1, failures: 2 }, counted, true],
    ['a consecutive success zeroing failures', { successes: 2, failures: 0 }, consecutive, true],
    ['a consecutive failure zeroing successes', { successes: 0, failures: 2 }, consecutive, true],
    ['a consecutive success keeping failures', { successes: 2, failures: 1 }, consecutive, false],
    ['a non-consecutive success losing failures', { successes: 2, failures: 0 }, counted, false],
    ['a non-consecutive failure losing successes', { successes: 0, failures: 2 }, counted, false],
    ['both counts rising', { successes: 2, failures: 2 }, counted, false],
    ['a skipped count', { successes: 3, failures: 1 }, counted, false],
    ['a count going back', { successes: 0, failures: 1 }, counted, false],
    ['no change', { successes: 1, failures: 1 }, counted, false]
  ] as const)('%s', (_label, after, thresholds, expected) => {
    expect(isSaveTallyStep(before, after, thresholds)).toBe(expected)
  })

  it('starts a first tally from zero', () => {
    expect(isSaveTallyStep(undefined, { successes: 1, failures: 0 }, counted)).toBe(true)
    expect(isSaveTallyStep(undefined, { successes: 1, failures: 1 }, counted)).toBe(false)
  })

  it('accepts no tally on an effect without thresholds', () => {
    expect(isSaveTallyStep(undefined, { successes: 1, failures: 0 }, undefined)).toBe(false)
    expect(isSaveTallyStep(undefined, undefined, undefined)).toBe(true)
  })
})

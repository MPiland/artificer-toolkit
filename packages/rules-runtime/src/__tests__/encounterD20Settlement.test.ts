import { describe, expect, it } from 'vitest'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { startEncounterBasicActionCheck } from '../encounterBasicActionCheck.js'
import {
  freezeD20Context,
  settleEncounterD20Answer,
  settleEncounterD20Test
} from '../encounterD20Settlement.js'
import { EncounterValidationError } from '../encounterErrors.js'
import { executeEncounterOptionalContestAction } from '../encounterOptionalContestActionExecution.js'
import { createDnd5eContestGraph } from '../systems/dnd5e/optionalCombatContestGraph.js'
import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { SRD_SYSTEM_ID, createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'

const BLESS: D20AddedDieDto = { label: 'Bless', count: 1, faces: 4, sign: 'ADD' }
const BANE: D20AddedDieDto = { label: 'Bane', count: 1, faces: 4, sign: 'SUBTRACT' }
const CONTRIBUTORS = [{ id: 'a' }, { id: 'b' }]
const keepOf = (rollMode: string) =>
  rollModeCapabilityRegistry.rollModeKeep({ gameSystemId: SRD_SYSTEM_ID, rollMode })
const noRandom = () => {
  throw new Error('This answer rolls nothing.')
}
const refusal = () => new EncounterValidationError('The test does not match its roll.')

/** A seeded random source: each call returns the next value, as `random(max)` would (0-based). */
function sequence(...values: number[]) {
  const pending = [...values]
  return (maxExclusive: number) => {
    const next = pending.shift()
    if (next === undefined || next >= maxExclusive) throw new Error('Unexpected roll.')
    return next
  }
}

/** The System's single-d20 check graph, started with the given added dice. */
async function startCheck(addedDice: readonly D20AddedDieDto[] = []) {
  const runtime = createSrdRulesRuntime()
  const continuation = await startEncounterBasicActionCheck({
    runtime,
    gameSystemId: SRD_SYSTEM_ID,
    occurrenceId: testUuid(700),
    addedDice
  })
  return { runtime, continuation }
}

describe('freezeD20Context', () => {
  it('freezes the roller facts with their contributor checksum and names only present dice', () => {
    expect(
      freezeD20Context({
        gameSystemId: SRD_SYSTEM_ID,
        rollMode: 'ADVANTAGE',
        contributors: CONTRIBUTORS,
        modifier: 3,
        addedDice: [],
        minimumRoll: null
      })
    ).toEqual({
      rollMode: 'ADVANTAGE',
      keep: keepOf('ADVANTAGE'),
      contributors: CONTRIBUTORS,
      contributorChecksum: checksumRuleDocument(CONTRIBUTORS),
      modifier: 3
    })
    const minimumRoll = { amount: 15, label: 'Glibness', sourceId: testUuid(701) }
    expect(
      freezeD20Context({
        gameSystemId: SRD_SYSTEM_ID,
        rollMode: 'NORMAL',
        contributors: [],
        modifier: -1,
        addedDice: [BLESS],
        minimumRoll
      })
    ).toEqual({
      rollMode: 'NORMAL',
      keep: keepOf('NORMAL'),
      contributors: [],
      contributorChecksum: checksumRuleDocument([]),
      modifier: -1,
      addedDice: [BLESS],
      minimumRoll
    })
  })
})

describe('settleEncounterD20Answer', () => {
  it('rolls an auto-roll in the frozen mode, the d20 before its added dice', () => {
    const random = sequence(3, 1, 0)
    expect(
      settleEncounterD20Answer({
        gameSystemId: SRD_SYSTEM_ID,
        d20: { rollMode: 'ADVANTAGE', keep: keepOf('ADVANTAGE'), addedDice: [BLESS] },
        answer: { kind: 'AUTO_ROLL', requestId: 'r' },
        rollD20: () => random(20) + 1,
        random
      })
    ).toEqual({
      rawFaces: [4, 2],
      rollMode: 'ADVANTAGE',
      keep: keepOf('ADVANTAGE'),
      natural: 4,
      addedDice: [{ ...BLESS, rolledFaces: [1] }]
    })
  })

  it('keeps entered dice in the roller mode with their added faces', () => {
    expect(
      settleEncounterD20Answer({
        gameSystemId: SRD_SYSTEM_ID,
        d20: { rollMode: 'NORMAL', keep: keepOf('NORMAL'), addedDice: [BLESS, BANE] },
        answer: {
          kind: 'ENTER_DICE',
          requestId: 'r',
          rollMode: 'DISADVANTAGE',
          rawFaces: [17, 9],
          addedFaces: [4, 2]
        },
        rollD20: noRandom,
        random: noRandom
      })
    ).toEqual({
      rawFaces: [17, 9],
      rollMode: 'DISADVANTAGE',
      keep: keepOf('DISADVANTAGE'),
      natural: 9,
      addedDice: [
        { ...BLESS, rolledFaces: [4] },
        { ...BANE, rolledFaces: [2] }
      ]
    })
  })

  it('refuses an answer without a face for each added die', () => {
    expect(() =>
      settleEncounterD20Answer({
        gameSystemId: SRD_SYSTEM_ID,
        d20: { rollMode: 'NORMAL', keep: keepOf('NORMAL'), addedDice: [BLESS] },
        answer: {
          kind: 'ENTER_DICE',
          requestId: 'r',
          rollMode: 'NORMAL',
          rawFaces: [12]
        },
        rollD20: noRandom,
        random: noRandom
      })
    ).toThrow('The roll needs one face for each added die.')
  })
})

describe('a two-d20 contest answer', () => {
  it('refuses added faces, since a contest rolls no added dice', async () => {
    const policy = {
      rollMode: 'NORMAL' as const,
      keep: 'FIRST' as const,
      contributors: [],
      contributorChecksum: checksumRuleDocument([]),
      modifier: 2
    }
    const contest = {
      autoRoll: {},
      published: createDnd5eContestGraph(testUuid(702)),
      initiator: { ...policy, actorId: 'initiator', requestNodeId: 'initiator_d20' as const },
      defender: { ...policy, actorId: 'defender', requestNodeId: 'target_d20' as const },
      occurrenceId: testUuid(703),
      rollD20: noRandom,
      runtime: createSrdRulesRuntime()
    }
    const pending = await executeEncounterOptionalContestAction(contest)
    if (pending.kind !== 'PENDING') throw new Error('The contest should wait for its initiator.')
    await expect(
      executeEncounterOptionalContestAction({
        ...contest,
        continuation: pending.continuation,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: pending.continuation.request.requestId,
          rollMode: 'NORMAL',
          rawFaces: [12],
          addedFaces: [3]
        }
      })
    ).rejects.toThrow('The roll has no added dice to answer.')
  })
})

describe('settleEncounterD20Test', () => {
  const outputs = { rawDie: 'rawDie', addedTotal: 'addedTotal' }

  it('resumes the d20, then the added dice, and returns the verified graph', async () => {
    const { runtime, continuation } = await startCheck([BLESS, BANE])
    const execution = await settleEncounterD20Test({
      continuation,
      roll: {
        natural: 14,
        addedDice: [
          { ...BLESS, rolledFaces: [4] },
          { ...BANE, rolledFaces: [1] }
        ]
      },
      resume: (step) => runtime.resume(step),
      outputs,
      refusal
    })
    expect(execution.status).toBe('COMPLETE')
    expect([execution.outputs.rawDie, execution.outputs.addedTotal]).toEqual([14, 3])
  })

  it('resumes only the d20 when the test rolls no added dice', async () => {
    const { runtime, continuation } = await startCheck()
    const execution = await settleEncounterD20Test({
      continuation,
      roll: { natural: 7, addedDice: [] },
      resume: (step) => runtime.resume(step),
      outputs,
      refusal
    })
    expect([execution.outputs.rawDie, execution.outputs.addedTotal]).toEqual([7, 0])
  })

  it('refuses added dice the test graph does not ask for, and missing ones it does', async () => {
    const plain = await startCheck()
    await expect(
      settleEncounterD20Test({
        continuation: plain.continuation,
        roll: { natural: 7, addedDice: [{ ...BLESS, rolledFaces: [2] }] },
        resume: (step) => plain.runtime.resume(step),
        outputs,
        refusal
      })
    ).rejects.toThrow("The roll's added dice do not match the test.")
    const blessed = await startCheck([BLESS])
    await expect(
      settleEncounterD20Test({
        continuation: blessed.continuation,
        roll: { natural: 7, addedDice: [] },
        resume: (step) => blessed.runtime.resume(step),
        outputs,
        refusal
      })
    ).rejects.toThrow("The roll's added dice do not match the test.")
  })

  it('refuses a graph whose outputs differ from the roll', async () => {
    const roll = { natural: 11, addedDice: [{ ...BLESS, rolledFaces: [3] }] }
    for (const mismatched of [
      { rawDie: 'addedTotal' },
      { rawDie: 'rawDie', addedTotal: 'rawDie' },
      { rawDie: 'rawDie', total: { port: 'rawDie', modifier: 2 } }
    ]) {
      const { runtime, continuation } = await startCheck([BLESS])
      await expect(
        settleEncounterD20Test({
          continuation,
          roll,
          resume: (step) => runtime.resume(step),
          outputs: mismatched,
          refusal
        })
      ).rejects.toThrow('The test does not match its roll.')
    }
  })

  it('refuses a graph that does not complete', async () => {
    const { runtime, continuation } = await startCheck([BLESS])
    const paused = await runtime.resume({
      continuation,
      response: { requestId: continuation.request.requestId, value: 5 }
    })
    expect(paused.status).toBe('PAUSED')
    await expect(
      settleEncounterD20Test({
        continuation,
        roll: { natural: 5, addedDice: [{ ...BLESS, rolledFaces: [1] }] },
        resume: async () => paused,
        outputs,
        refusal
      })
    ).rejects.toThrow('The test does not match its roll.')
  })
})

import { describe, expect, it } from 'vitest'

import { dnd5eMovementReactionEligibilityOperation } from '../systems/dnd5e/reactionEligibilityPolicy.js'

const eligibleInputs = {
  actualStage: 'BEFORE_LEAVE_REACH',
  expectedStage: 'BEFORE_LEAVE_REACH',
  movementKind: 'VOLUNTARY',
  contactValid: true,
  perceptionSatisfied: true,
  reactorCanAct: true,
  targetHostile: true,
  allowanceAvailable: true,
  freeReactionGranted: false,
  freeAllowanceAvailable: true,
  suppressed: false
}

function evaluate(overrides: Partial<typeof eligibleInputs>) {
  return dnd5eMovementReactionEligibilityOperation.execute({ ...eligibleInputs, ...overrides })
}

describe('D&D movement reaction eligibility with a granted free reaction', () => {
  it.each([
    {
      name: 'a granted free reaction with its allowance left spends no reaction',
      overrides: { freeReactionGranted: true },
      expected: { eligible: true, freeReaction: true }
    },
    {
      name: 'a granted free reaction stays available after the reaction is spent',
      overrides: { freeReactionGranted: true, allowanceAvailable: false },
      expected: { eligible: true, freeReaction: true }
    },
    {
      name: 'once the free allowance is used this turn the reaction is spent',
      overrides: { freeReactionGranted: true, freeAllowanceAvailable: false },
      expected: { eligible: true, freeReaction: false }
    },
    {
      name: 'with the free allowance and the reaction both used there is no reaction',
      overrides: {
        freeReactionGranted: true,
        freeAllowanceAvailable: false,
        allowanceAvailable: false
      },
      expected: { eligible: false, freeReaction: false }
    },
    {
      name: 'an ungranted reactor spends its reaction',
      overrides: {},
      expected: { eligible: true, freeReaction: false }
    },
    {
      name: 'an ungranted reactor without its reaction has none',
      overrides: { allowanceAvailable: false },
      expected: { eligible: false, freeReaction: false }
    },
    {
      name: 'a reactor that cannot take reactions gets no free reaction',
      overrides: { freeReactionGranted: true, suppressed: true },
      expected: { eligible: false, freeReaction: true }
    },
    {
      name: 'a reactor that cannot act gets no free reaction',
      overrides: { freeReactionGranted: true, reactorCanAct: false },
      expected: { eligible: false, freeReaction: true }
    }
  ])('$name', ({ overrides, expected }) => {
    expect(evaluate(overrides)).toEqual(expected)
  })
})

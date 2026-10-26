import { describe, expect, it } from 'vitest'

import {
  encounterAllowanceUsed,
  encounterTurnUsageSnapshot,
  withEncounterAllowanceUsed
} from '../encounterActorState.js'

const eachTurn = {
  definitionId: '00000000-0000-4000-8000-0000000000d9',
  refreshBoundary: 'EACH_TURN'
} as const
const otherEachTurn = {
  definitionId: '00000000-0000-4000-8000-0000000000e1',
  refreshBoundary: 'EACH_TURN'
} as const
const startOfTurn = {
  definitionId: '00000000-0000-4000-8000-0000000000d2',
  refreshBoundary: 'START_OF_TURN'
} as const

describe('Encounter turn-scoped allowance usage', () => {
  it('reads an EACH_TURN allowance as used only on the turn that spent it', () => {
    const actor = { resources: withEncounterAllowanceUsed({ resources: {} }, eachTurn, 7, 1) }

    expect(actor.resources).toEqual({
      turnUsage: { [eachTurn.definitionId]: { turnSequence: 7, used: 1 } }
    })
    expect(encounterAllowanceUsed(actor, eachTurn, 7)).toBe(1)
    // Any later turn, including a GM turn move, carries a new turnSequence and finds it unspent.
    expect(encounterAllowanceUsed(actor, eachTurn, 8)).toBe(0)
    expect(encounterTurnUsageSnapshot(actor, 8)).toEqual({})
  })

  it('drops entries earlier turns left when it writes this turn', () => {
    const earlier = withEncounterAllowanceUsed({ resources: { other: 1 } }, otherEachTurn, 3, 1)
    const resources = withEncounterAllowanceUsed({ resources: earlier }, eachTurn, 4, 1)

    expect(resources).toEqual({
      other: 1,
      turnUsage: { [eachTurn.definitionId]: { turnSequence: 4, used: 1 } }
    })
  })

  it('stores no record once nothing is used, so a restore matches the prior row', () => {
    const prior = { resources: { other: 1 } }
    const spent = { resources: withEncounterAllowanceUsed(prior, eachTurn, 5, 1) }

    expect(withEncounterAllowanceUsed(spent, eachTurn, 5, 0)).toEqual(prior.resources)
  })

  it('keeps START_OF_TURN allowances in the rule usage record', () => {
    const actor = { resources: withEncounterAllowanceUsed({ resources: {} }, startOfTurn, 5, 1) }

    expect(actor.resources).toEqual({ ruleUsage: { [startOfTurn.definitionId]: 1 } })
    expect(encounterAllowanceUsed(actor, startOfTurn, 9)).toBe(1)
  })

  it('rejects a malformed turn usage record', () => {
    const actor = {
      resources: { turnUsage: { [eachTurn.definitionId]: { turnSequence: 1, used: 0 } } }
    }

    expect(() => encounterAllowanceUsed(actor, eachTurn, 1)).toThrow(
      'Encounter turn usage value is invalid.'
    )
  })
})

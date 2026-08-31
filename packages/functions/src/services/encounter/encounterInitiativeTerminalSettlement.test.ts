import { describe, expect, it } from 'vitest'

import { assertEncounterInitiativeTerminalOrder } from './encounterInitiativeTerminalSettlement.js'

const actorA = '00000000-0000-4000-8000-000000000001'
const actorB = '00000000-0000-4000-8000-000000000002'

describe('Encounter initiative terminal settlement', () => {
  it('admits only a complete exact order for the sealed round', () => {
    expect(() =>
      assertEncounterInitiativeTerminalOrder({
        sealedRound: 1,
        settledRound: 1,
        participantActorIds: [actorA, actorB],
        orderedActorIds: [actorA, actorB]
      })
    ).not.toThrow()
  })

  it('rejects a stale round or duplicate terminal order before effects can apply', () => {
    expect(() =>
      assertEncounterInitiativeTerminalOrder({
        sealedRound: 1,
        settledRound: 2,
        participantActorIds: [actorA, actorB],
        orderedActorIds: [actorA, actorB]
      })
    ).toThrow('sealed round')
    expect(() =>
      assertEncounterInitiativeTerminalOrder({
        sealedRound: 1,
        settledRound: 1,
        participantActorIds: [actorA, actorB],
        orderedActorIds: [actorA, actorA]
      })
    ).toThrow('exact actor order')
    expect(() =>
      assertEncounterInitiativeTerminalOrder({
        sealedRound: 1,
        settledRound: 1,
        participantActorIds: [actorA, actorB],
        orderedActorIds: [actorA, '00000000-0000-4000-8000-000000000003']
      })
    ).toThrow('exact actor order')
  })
})

import { describe, expect, it } from 'vitest'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import {
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '../encounterInitiativeStaging.js'
import {
  applyEncounterInitiativeAdvance,
  firstUndefeatedActorId,
  planEncounterInitiativeAdvance,
  settleEncounterInitiativeRound,
  skipDefeatedOpeningTurns
} from '../encounterInitiativeStateSettlement.js'
import {
  ACTOR_A,
  ACTOR_B,
  ACTOR_C,
  SIDE_FOES,
  SIDE_HEROES,
  initiativePolicySnapshot,
  preparingRound
} from './encounterInitiativeFixtures.js'
import { ENCOUNTER_ID } from './dnd5eSrdEncounter.js'

const NONE: ReadonlySet<string> = new Set()
const ACTOR_D = '00000000-0000-4000-8000-0000000000a4'
const SIDE_ALLIES = '00000000-0000-4000-8000-0000000005a3'

const ACTORS = [
  { id: ACTOR_A, sideId: SIDE_HEROES },
  { id: ACTOR_B, sideId: SIDE_FOES },
  { id: ACTOR_C, sideId: SIDE_FOES }
]

/** The persisted form of a round: what the next command reads back. */
function persisted(state: EncounterInitiativeRoundStateDto): EncounterInitiativeRoundStateDto {
  return hydrateStagedState(serializeStagedInitiativeRoundState(state))
}

async function settle(input: {
  state: EncounterInitiativeRoundStateDto
  orderedActorIds: readonly string[]
  orderedSideIds?: readonly string[]
}) {
  const staged = inMemoryInitiativeRepository(input.state)
  return persisted(
    await settleEncounterInitiativeRound({ repository: staged.repository, ...input })
  )
}

async function advance(
  state: EncounterInitiativeRoundStateDto,
  currentActorId: string,
  defeatedActorIds: ReadonlySet<string> = NONE
) {
  const plan = planEncounterInitiativeAdvance({ state, currentActorId, defeatedActorIds })
  const staged = inMemoryInitiativeRepository(state)
  return {
    plan,
    state: persisted(
      await applyEncounterInitiativeAdvance({
        repository: staged.repository,
        state,
        plan,
        defeatedActorIds
      })
    )
  }
}

function cursor(state: EncounterInitiativeRoundStateDto) {
  return {
    round: [state.round.round, state.round.status, state.round.nextTurnOrderOrdinal],
    participants: state.participants.map((participant) => [
      participant.actorId,
      participant.status,
      participant.turnOrderOrdinal,
      participant.version
    ]),
    sides: state.sides.map((side) => [side.sideId, side.status, side.sideOrderOrdinal])
  }
}

const eachRoundPolicy = initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' })
const sideRollPolicy = initiativePolicySnapshot({
  procedure: 'SIDE_ROLL',
  cadence: 'ENCOUNTER_START'
})

describe('settleEncounterInitiativeRound', () => {
  it('orders the locked actors, activates the first, and activates the round', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS }),
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B]
    })

    expect(cursor(settled)).toEqual({
      round: [1, 'ACTIVE', 3],
      participants: [
        [ACTOR_A, 'READY', 1, 1],
        [ACTOR_B, 'READY', 2, 1],
        [ACTOR_C, 'ACTIVE', 0, 2]
      ],
      sides: []
    })
    expect(settled.round).toMatchObject({
      encounterId: ENCOUNTER_ID,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      policySnapshotChecksum: null,
      version: 1
    })
  })

  it('orders side-roll sides, activating the first side with the first actor', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS, policy: sideRollPolicy }),
      orderedActorIds: [ACTOR_C, ACTOR_B, ACTOR_A],
      orderedSideIds: [SIDE_FOES, SIDE_HEROES]
    })

    expect(cursor(settled)).toEqual({
      round: [1, 'ACTIVE', 3],
      participants: [
        [ACTOR_A, 'READY', 2, 1],
        [ACTOR_B, 'READY', 1, 1],
        [ACTOR_C, 'ACTIVE', 0, 2]
      ],
      sides: [
        [SIDE_HEROES, 'READY', 1],
        [SIDE_FOES, 'ACTIVE', 0]
      ]
    })
  })

  it.each([
    {
      name: 'a missing actor',
      orderedActorIds: [ACTOR_A, ACTOR_B],
      message: 'Initiative actor order must contain each locked initiative identity exactly once.'
    },
    {
      name: 'a repeated actor',
      orderedActorIds: [ACTOR_A, ACTOR_A, ACTOR_B],
      message: 'Initiative actor order must contain each locked initiative identity exactly once.'
    },
    {
      name: 'an unknown actor',
      orderedActorIds: [ACTOR_A, ACTOR_B, ENCOUNTER_ID],
      message: 'Initiative actor order must contain each locked initiative identity exactly once.'
    },
    {
      name: 'a side order outside side-roll initiative',
      orderedActorIds: [ACTOR_A, ACTOR_B, ACTOR_C],
      orderedSideIds: [SIDE_HEROES],
      message: 'Initiative side order must contain each locked initiative identity exactly once.'
    }
  ])('refuses $name', async ({ orderedActorIds, orderedSideIds, message }) => {
    await expect(
      settle({ state: preparingRound({ actors: ACTORS }), orderedActorIds, orderedSideIds })
    ).rejects.toThrow(message)
  })

  it('refuses a side-roll actor order that interleaves sides', async () => {
    await expect(
      settle({
        state: preparingRound({ actors: ACTORS, policy: sideRollPolicy }),
        orderedActorIds: [ACTOR_B, ACTOR_A, ACTOR_C],
        orderedSideIds: [SIDE_FOES, SIDE_HEROES]
      })
    ).rejects.toThrow('Side initiative actor order must retain contiguous settled side order.')
  })

  it('refuses a round that is no longer preparing', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS }),
      orderedActorIds: [ACTOR_A, ACTOR_B, ACTOR_C]
    })
    await expect(
      settle({ state: settled, orderedActorIds: [ACTOR_A, ACTOR_B, ACTOR_C] })
    ).rejects.toThrow('Only a preparing initiative round can settle its order.')
  })
})

describe('planEncounterInitiativeAdvance', () => {
  it('advances within the round to the next actor in turn order', async () => {
    const state = await settle({
      state: preparingRound({ actors: ACTORS }),
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B]
    })

    expect(
      planEncounterInitiativeAdvance({ defeatedActorIds: NONE, state, currentActorId: ACTOR_C })
    ).toEqual({
      kind: 'SAME_ROUND',
      round: 1,
      stateChecksum: checksumCanonicalJson(state),
      currentActorId: ACTOR_C,
      nextActorId: ACTOR_A
    })
  })

  it('walks the cursor and wraps the round after the last actor, keeping the order for encounter-start cadence', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS }),
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B]
    })
    const second = await advance(settled, ACTOR_C)
    expect(cursor(second.state).participants).toEqual([
      [ACTOR_A, 'ACTIVE', 1, 2],
      [ACTOR_B, 'READY', 2, 1],
      [ACTOR_C, 'ACTED', 0, 3]
    ])
    const third = await advance(second.state, ACTOR_A)
    expect(third.plan).toMatchObject({ kind: 'SAME_ROUND', nextActorId: ACTOR_B })

    expect(
      planEncounterInitiativeAdvance({
        defeatedActorIds: NONE,
        state: third.state,
        currentActorId: ACTOR_B
      })
    ).toEqual({
      kind: 'ROUND_WRAP',
      round: 1,
      nextRound: 2,
      cadence: 'ENCOUNTER_START',
      stateChecksum: checksumCanonicalJson(third.state),
      currentActorId: ACTOR_B,
      firstActorId: ACTOR_C,
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B],
      orderedSideIds: []
    })
    const wrapped = await advance(third.state, ACTOR_B)
    expect(cursor(wrapped.state)).toEqual({
      round: [1, 'COMPLETED', 3],
      participants: [
        [ACTOR_A, 'ACTED', 1, 3],
        [ACTOR_B, 'ACTED', 2, 3],
        [ACTOR_C, 'ACTED', 0, 3]
      ],
      sides: []
    })
  })

  it('leaves the next round first actor open when initiative is rolled each round', async () => {
    const state = await settle({
      state: preparingRound({ actors: ACTORS, policy: eachRoundPolicy }),
      orderedActorIds: [ACTOR_B, ACTOR_A, ACTOR_C]
    })
    const last = await advance((await advance(state, ACTOR_B)).state, ACTOR_A)

    expect(
      planEncounterInitiativeAdvance({
        defeatedActorIds: NONE,
        state: last.state,
        currentActorId: ACTOR_C
      })
    ).toEqual({
      kind: 'ROUND_WRAP',
      round: 1,
      nextRound: 2,
      cadence: 'EACH_ROUND',
      stateChecksum: checksumCanonicalJson(last.state),
      currentActorId: ACTOR_C,
      firstActorId: null,
      orderedActorIds: [ACTOR_B, ACTOR_A, ACTOR_C],
      orderedSideIds: []
    })
  })

  it('completes each side as play leaves it and wraps with the settled side order', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS, policy: sideRollPolicy }),
      orderedActorIds: [ACTOR_B, ACTOR_C, ACTOR_A],
      orderedSideIds: [SIDE_FOES, SIDE_HEROES]
    })
    const withinSide = await advance(settled, ACTOR_B)
    expect(cursor(withinSide.state).sides).toEqual([
      [SIDE_HEROES, 'READY', 1],
      [SIDE_FOES, 'ACTIVE', 0]
    ])
    const acrossSides = await advance(withinSide.state, ACTOR_C)
    expect(cursor(acrossSides.state).sides).toEqual([
      [SIDE_HEROES, 'ACTIVE', 1],
      [SIDE_FOES, 'COMPLETED', 0]
    ])

    const wrap = planEncounterInitiativeAdvance({
      defeatedActorIds: NONE,
      state: acrossSides.state,
      currentActorId: ACTOR_A
    })
    expect(wrap).toMatchObject({
      kind: 'ROUND_WRAP',
      firstActorId: ACTOR_B,
      orderedActorIds: [ACTOR_B, ACTOR_C, ACTOR_A],
      orderedSideIds: [SIDE_FOES, SIDE_HEROES]
    })
    const wrapped = await advance(acrossSides.state, ACTOR_A)
    expect(cursor(wrapped.state).sides).toEqual([
      [SIDE_HEROES, 'COMPLETED', 1],
      [SIDE_FOES, 'COMPLETED', 0]
    ])
  })

  it('refuses a preparing round, a mismatched current actor, and a stale plan', async () => {
    const preparing = preparingRound({ actors: ACTORS })
    expect(() =>
      planEncounterInitiativeAdvance({
        defeatedActorIds: NONE,
        state: preparing,
        currentActorId: ACTOR_A
      })
    ).toThrow('Only an active initiative round can advance.')
    const state = await settle({ state: preparing, orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B] })
    expect(() =>
      planEncounterInitiativeAdvance({ defeatedActorIds: NONE, state, currentActorId: ACTOR_A })
    ).toThrow('Encounter and normalized initiative current actors do not match.')

    const plan = planEncounterInitiativeAdvance({
      defeatedActorIds: NONE,
      state,
      currentActorId: ACTOR_C
    })
    const moved = (await advance(state, ACTOR_C)).state
    await expect(
      applyEncounterInitiativeAdvance({
        defeatedActorIds: NONE,
        repository: inMemoryInitiativeRepository(moved).repository,
        state: moved,
        plan
      })
    ).rejects.toThrow('Encounter and normalized initiative current actors do not match.')
    const renumbered: EncounterInitiativeRoundStateDto = {
      ...state,
      round: { ...state.round, nextTurnOrderOrdinal: 4 }
    }
    await expect(
      applyEncounterInitiativeAdvance({
        defeatedActorIds: NONE,
        repository: inMemoryInitiativeRepository(renumbered).repository,
        state: renumbered,
        plan
      })
    ).rejects.toThrow('The normalized initiative round changed before turn advancement.')
  })

  it('refuses a cursor with a gap or an actor that acted after the active one', async () => {
    const state = await settle({
      state: preparingRound({ actors: ACTORS }),
      orderedActorIds: [ACTOR_A, ACTOR_B, ACTOR_C]
    })
    const gap: EncounterInitiativeRoundStateDto = {
      ...state,
      participants: state.participants.map((participant) =>
        participant.actorId === ACTOR_C ? { ...participant, turnOrderOrdinal: 3 } : participant
      )
    }
    expect(() =>
      planEncounterInitiativeAdvance({
        defeatedActorIds: NONE,
        state: gap,
        currentActorId: ACTOR_A
      })
    ).toThrow('Active initiative state must retain one exact contiguous actor order.')
    const actedLater: EncounterInitiativeRoundStateDto = {
      ...state,
      participants: state.participants.map((participant) =>
        participant.actorId === ACTOR_C ? { ...participant, status: 'ACTED' } : participant
      )
    }
    expect(() =>
      planEncounterInitiativeAdvance({
        defeatedActorIds: NONE,
        state: actedLater,
        currentActorId: ACTOR_A
      })
    ).toThrow('Active initiative participant state is not a valid turn cursor.')
  })
})

describe('defeated actors keep their place but lose their turns (D63)', () => {
  it('skips a defeated actor, marking it as having acted', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS }),
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B]
    })
    const next = await advance(settled, ACTOR_C, new Set([ACTOR_A]))
    expect(next.plan).toMatchObject({ kind: 'SAME_ROUND', nextActorId: ACTOR_B })
    expect(cursor(next.state).participants).toEqual([
      [ACTOR_A, 'ACTED', 1, 2],
      [ACTOR_B, 'ACTIVE', 2, 2],
      [ACTOR_C, 'ACTED', 0, 3]
    ])
  })

  it('wraps the round when everyone after the current actor is defeated, opening past them', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS }),
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B]
    })
    const defeated = new Set([ACTOR_C, ACTOR_B])
    const second = await advance(settled, ACTOR_C)
    const wrap = await advance(second.state, ACTOR_A, defeated)
    expect(wrap.plan).toMatchObject({
      kind: 'ROUND_WRAP',
      firstActorId: ACTOR_A,
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B]
    })
    expect(cursor(wrap.state).participants).toEqual([
      [ACTOR_A, 'ACTED', 1, 3],
      [ACTOR_B, 'ACTED', 2, 2],
      [ACTOR_C, 'ACTED', 0, 3]
    ])
  })

  it('completes every side the skip leaves behind in side-roll initiative', async () => {
    const actors = [...ACTORS, { id: ACTOR_D, sideId: SIDE_ALLIES }]
    const settled = await settle({
      state: preparingRound({ actors, policy: sideRollPolicy }),
      orderedActorIds: [ACTOR_B, ACTOR_C, ACTOR_A, ACTOR_D],
      orderedSideIds: [SIDE_FOES, SIDE_HEROES, SIDE_ALLIES]
    })
    const skipped = await advance(settled, ACTOR_B, new Set([ACTOR_C, ACTOR_A]))
    expect(skipped.plan).toMatchObject({ kind: 'SAME_ROUND', nextActorId: ACTOR_D })
    expect(cursor(skipped.state).sides).toEqual([
      [SIDE_HEROES, 'COMPLETED', 1],
      [SIDE_FOES, 'COMPLETED', 0],
      [SIDE_ALLIES, 'ACTIVE', 2]
    ])
  })

  it('opens a freshly settled round with its first actor that can act', async () => {
    const settled = await settle({
      state: preparingRound({ actors: ACTORS, policy: eachRoundPolicy }),
      orderedActorIds: [ACTOR_B, ACTOR_A, ACTOR_C]
    })
    const staged = inMemoryInitiativeRepository(settled)
    const opened = persisted(
      await skipDefeatedOpeningTurns({
        repository: staged.repository,
        state: settled,
        defeatedActorIds: new Set([ACTOR_B])
      })
    )
    expect(cursor(opened).participants).toEqual([
      [ACTOR_A, 'ACTIVE', 1, 2],
      [ACTOR_B, 'ACTED', 0, 3],
      [ACTOR_C, 'READY', 2, 1]
    ])
    expect(firstUndefeatedActorId([ACTOR_B, ACTOR_A, ACTOR_C], new Set([ACTOR_B]))).toBe(ACTOR_A)
    // With everyone defeated the round keeps its first actor.
    const everyone = new Set([ACTOR_A, ACTOR_B, ACTOR_C])
    expect(
      await skipDefeatedOpeningTurns({
        repository: inMemoryInitiativeRepository(settled).repository,
        state: settled,
        defeatedActorIds: everyone
      })
    ).toBe(settled)
  })
})

import { describe, expect, it } from 'vitest'

import { stableActors } from '../encounterActorState.js'
import {
  readSideOrder,
  readTurnCursor,
  validateInitiativeCursor
} from '../encounterInitiativeCursor.js'
import { initiativePolicySnapshot } from '../testing/initiativePolicySnapshot.js'
import {
  ACTOR_A,
  ACTOR_B,
  ACTOR_C,
  SIDE_FOES,
  SIDE_HEROES,
  preparingRound,
  roundAt
} from './encounterInitiativeFixtures.js'

const ERRORS = { order: 'bad order', cursor: 'bad cursor' }
const ORDER = [ACTOR_A, ACTOR_B, ACTOR_C]

function withOrdinals<T extends { turnOrderOrdinal?: number | null }>(
  rows: T[],
  ordinals: number[]
) {
  return rows.map((row, index) => ({ ...row, turnOrderOrdinal: ordinals[index]! }))
}

describe('readTurnCursor', () => {
  it('derives the ACTIVE participant from a contiguous order', async () => {
    const state = await roundAt(ORDER, ACTOR_B, 'ENCOUNTER_START')
    const { participants, activeIndex } = readTurnCursor(state, ERRORS)
    expect(participants.map((p) => p.actorId)).toEqual(ORDER)
    expect(activeIndex).toBe(1)
  })

  it('pins the cursor to a given actor, or to none', async () => {
    const state = await roundAt(ORDER, ACTOR_C, 'ENCOUNTER_START')
    expect(readTurnCursor(state, ERRORS, ACTOR_C).activeIndex).toBe(2)
    expect(() => readTurnCursor(state, ERRORS, ACTOR_A)).toThrow('bad cursor')
    expect(() => readTurnCursor(state, ERRORS, null)).toThrow('bad cursor')
  })

  it('refuses a gap in the turn order', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    const gap = { ...state, participants: withOrdinals(state.participants, [0, 1, 3]) }
    expect(() => readTurnCursor(gap, ERRORS)).toThrow('bad order')
  })

  it('refuses a duplicate ordinal', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    const duplicate = { ...state, participants: withOrdinals(state.participants, [0, 1, 1]) }
    expect(() => readTurnCursor(duplicate, ERRORS)).toThrow('bad order')
  })

  it('refuses a state with no participants unless the cursor is pinned', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    const empty = { ...state, participants: [] }
    expect(() => readTurnCursor(empty, ERRORS)).toThrow('bad order')
    expect(readTurnCursor(empty, ERRORS, null).activeIndex).toBe(-1)
  })
})

describe('readSideOrder', () => {
  const sideRoll = () =>
    preparingRound({
      actors: [
        { id: ACTOR_A, sideId: SIDE_HEROES },
        { id: ACTOR_B, sideId: SIDE_FOES }
      ],
      policy: initiativePolicySnapshot({ procedure: 'SIDE_ROLL', cadence: 'ENCOUNTER_START' })
    })

  it('returns none for a non-side-roll round and refuses stray side state', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    expect(readSideOrder(state, 'bad side order')).toEqual([])
    const stray = { ...state, sides: sideRoll().sides }
    expect(() => readSideOrder(stray, 'bad side order')).toThrow(
      'Only side-roll initiative may retain side state.'
    )
  })

  it('orders contiguous sides and refuses a gap or duplicate ordinal', () => {
    const state = sideRoll()
    const ordered = readSideOrder(
      { ...state, sides: state.sides.map((s, i) => ({ ...s, sideOrderOrdinal: 1 - i })) },
      'bad side order'
    )
    expect(ordered.map((side) => side.sideOrderOrdinal)).toEqual([0, 1])
    for (const ordinals of [
      [0, 2],
      [0, 0]
    ])
      expect(() =>
        readSideOrder(
          {
            ...state,
            sides: state.sides.map((s, i) => ({ ...s, sideOrderOrdinal: ordinals[i]! }))
          },
          'bad side order'
        )
      ).toThrow('bad side order')
  })
})

describe('validateInitiativeCursor', () => {
  it('reports the shared order failure with the actor label', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    const gap = { ...state, participants: withOrdinals(state.participants, [0, 1, 3]) }
    expect(() =>
      validateInitiativeCursor({
        state: gap,
        currentActorId: ACTOR_A,
        actors: ORDER.map((id) => ({ id })),
        allowedSideIds: [SIDE_FOES]
      })
    ).toThrow('Initiative actor must retain one exact contiguous order.')
  })

  it('leaves an owned actor out of the cohort, which acts on its owner’s turn (D190a)', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    const summon = { id: crypto.randomUUID(), owner: { ownerActorId: ACTOR_A } }
    const validate = (actors: { id: string; owner?: { ownerActorId: string } }[]) =>
      validateInitiativeCursor({
        state,
        currentActorId: ACTOR_A,
        actors,
        allowedSideIds: [SIDE_FOES]
      })
    expect(() => validate([...ORDER.map((id) => ({ id })), summon])).not.toThrow()
    expect(() => validate([...ORDER.map((id) => ({ id })), { id: summon.id }])).toThrow(
      'Initiative actor cohort does not match the Encounter Run.'
    )
  })
})

describe('createStagedInitiativeRoundState', () => {
  it('stages no participant for an owned actor', () => {
    const summonId = crypto.randomUUID()
    const staged = preparingRound({
      actors: [
        { id: ACTOR_A, sideId: SIDE_HEROES },
        { id: summonId, sideId: SIDE_HEROES, owner: { ownerActorId: ACTOR_A } }
      ],
      policy: initiativePolicySnapshot({ procedure: 'SIDE_ROLL', cadence: 'ENCOUNTER_START' })
    })
    expect(staged.participants.map(({ actorId }) => actorId)).toEqual([ACTOR_A])
  })
})

describe('stableActors', () => {
  it('puts each owned actor right after its owner and keeps it out of the ACTIVE order (D190a)', async () => {
    const state = await roundAt(ORDER, ACTOR_B, 'ENCOUNTER_START')
    const summonId = crypto.randomUUID()
    const actor = (id: string, owner?: { ownerActorId: string }) => ({
      id,
      manualOrder: null,
      initiative: null,
      stableTieKey: id,
      ...(owner && { owner })
    })
    const actors = [actor(summonId, { ownerActorId: ACTOR_A }), ...ORDER.map((id) => actor(id))]
    const ordered = stableActors({ actors, round: state.round.round, initiativeRoundState: state })
    expect(ordered.map(({ id }) => id)).toEqual([ACTOR_A, summonId, ACTOR_B, ACTOR_C])
  })
})

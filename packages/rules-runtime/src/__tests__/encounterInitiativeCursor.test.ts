import { describe, expect, it } from 'vitest'

import { stableActors } from '../encounterActorState.js'
import {
  followedActorId,
  readSideOrder,
  readTurnCursor,
  rollsInitiative,
  takesInitiativeTurns,
  validateInitiativeCursor
} from '../encounterInitiativeCursor.js'
import { anchorOwnedActors } from '../encounterInitiativeStaging.js'
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

  it('expects a place for a summon authored to act right after its owner', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    const summon = {
      id: crypto.randomUUID(),
      owner: { ownerActorId: ACTOR_A, turnTiming: 'AFTER_OWNER' as const }
    }
    expect(() =>
      validateInitiativeCursor({
        state,
        currentActorId: ACTOR_A,
        actors: [...ORDER.map((id) => ({ id })), summon],
        allowedSideIds: [SIDE_FOES]
      })
    ).toThrow('Initiative actor cohort does not match the Encounter Run.')
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

describe('rollsInitiative and takesInitiativeTurns', () => {
  const owner = { ownerActorId: ACTOR_A }
  it('rolls an unowned actor and a summon authored for its own initiative, not other owned actors (D200)', () => {
    expect(rollsInitiative({})).toBe(true)
    expect(rollsInitiative({ owner })).toBe(false)
    expect(rollsInitiative({ owner: { ...owner, turnTiming: 'AFTER_OWNER' } })).toBe(false)
    expect(rollsInitiative({ owner: { ...owner, turnTiming: 'OWN_INITIATIVE' } })).toBe(true)
  })

  it('holds a place for what rolls and for a summon authored to act right after its owner', () => {
    expect(takesInitiativeTurns({})).toBe(true)
    expect(takesInitiativeTurns({ owner })).toBe(false)
    expect(takesInitiativeTurns({ owner: { ...owner, turnTiming: 'AFTER_OWNER' } })).toBe(true)
    expect(takesInitiativeTurns({ owner: { ...owner, turnTiming: 'OWN_INITIATIVE' } })).toBe(true)
  })
})

describe('followedActorId', () => {
  it('names the nearest owner in the chain that holds a place, or none', () => {
    const middle = { id: ACTOR_B, owner: { ownerActorId: ACTOR_A } }
    const summon = {
      id: ACTOR_C,
      owner: { ownerActorId: ACTOR_B, turnTiming: 'AFTER_OWNER' as const }
    }
    const actors = [{ id: ACTOR_A }, middle, summon]
    expect(followedActorId(summon, actors, (id) => id === ACTOR_A)).toBe(ACTOR_A)
    expect(followedActorId(summon, actors, (id) => id === ACTOR_B)).toBe(ACTOR_B)
    expect(followedActorId(summon, actors, () => false)).toBeNull()
  })

  it('stops at a cycle in the owner chain', () => {
    const left = { id: ACTOR_A, owner: { ownerActorId: ACTOR_B } }
    const right = { id: ACTOR_B, owner: { ownerActorId: ACTOR_A } }
    expect(followedActorId(left, [left, right], () => false)).toBeNull()
  })
})

describe('anchorOwnedActors', () => {
  const after = (ownerActorId: string) => ({ ownerActorId, turnTiming: 'AFTER_OWNER' as const })
  const summonA = '00000000-0000-4000-8000-0000000000b1'
  const summonB = '00000000-0000-4000-8000-0000000000b2'
  const ids = (state: Awaited<ReturnType<typeof roundAt>>) =>
    [...state.participants]
      .sort((left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!)
      .map(({ actorId }) => actorId)

  it('seats each follower directly behind its owner, sharing its place, for any rolled order', async () => {
    const actors = [
      ...ORDER.map((id) => ({ id, sideId: SIDE_FOES })),
      { id: summonA, sideId: SIDE_HEROES, owner: after(ACTOR_B) }
    ]
    for (const order of [ORDER, [ACTOR_C, ACTOR_B, ACTOR_A], [ACTOR_B, ACTOR_C, ACTOR_A]]) {
      const settled = anchorOwnedActors(await roundAt(order, order[0]!, 'ENCOUNTER_START'), actors)
      const expected = order.flatMap((id) => (id === ACTOR_B ? [id, summonA] : [id]))
      expect(ids(settled)).toEqual(expected)
      expect(settled.round.nextTurnOrderOrdinal).toBe(expected.length)
      expect(settled.participants.find(({ actorId }) => actorId === summonA)).toMatchObject({
        sideId: SIDE_HEROES,
        status: 'READY',
        initiativeScore: settled.participants.find(({ actorId }) => actorId === ACTOR_B)!
          .initiativeScore
      })
    }
  })

  it('seats a follower of a follower behind it, however the actors are listed', async () => {
    const actors = [
      { id: summonB, sideId: SIDE_FOES, owner: after(summonA) },
      { id: summonA, sideId: SIDE_FOES, owner: after(ACTOR_A) },
      ...ORDER.map((id) => ({ id, sideId: SIDE_FOES }))
    ]
    const settled = anchorOwnedActors(await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START'), actors)
    expect(ids(settled)).toEqual([ACTOR_A, summonA, summonB, ACTOR_B, ACTOR_C])
  })

  it('leaves the round as it is when nothing follows an owner', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    const rollers = ORDER.map((id) => ({ id, sideId: SIDE_FOES }))
    expect(anchorOwnedActors(state, rollers)).toBe(state)
    expect(
      anchorOwnedActors(state, [
        ...rollers,
        { id: summonA, sideId: SIDE_FOES, owner: { ownerActorId: ACTOR_A } }
      ])
    ).toBe(state)
  })

  it('refuses a follower whose owners hold no place', async () => {
    const state = await roundAt(ORDER, ACTOR_A, 'ENCOUNTER_START')
    expect(() =>
      anchorOwnedActors(state, [
        ...ORDER.map((id) => ({ id, sideId: SIDE_FOES })),
        { id: summonA, sideId: SIDE_FOES, owner: after(crypto.randomUUID()) }
      ])
    ).toThrow('An owned actor has no owner in the initiative order.')
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

  it('stages a participant for a summon authored for its own initiative (D200)', () => {
    const summonId = crypto.randomUUID()
    const staged = preparingRound({
      actors: [
        { id: ACTOR_A, sideId: SIDE_HEROES },
        {
          id: summonId,
          sideId: SIDE_HEROES,
          owner: { ownerActorId: ACTOR_A, turnTiming: 'OWN_INITIATIVE' }
        }
      ],
      policy: initiativePolicySnapshot({ procedure: 'SIDE_ROLL', cadence: 'ENCOUNTER_START' })
    })
    expect(staged.participants.map(({ actorId }) => actorId).sort()).toEqual(
      [ACTOR_A, summonId].sort()
    )
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

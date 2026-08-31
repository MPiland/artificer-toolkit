import { describe, expect, it, vi } from 'vitest'

import type {
  EncounterInitiativeParticipantRecord,
  EncounterInitiativeRoundStateRecord,
  EncounterInitiativeSideRecord
} from '@artificer-toolkit/db'
import type {
  UpdateEncounterInitiativeParticipantDto,
  UpdateEncounterInitiativeRoundDto,
  UpdateEncounterInitiativeSideDto
} from '@artificer-toolkit/schema/shared/initiativeState'

import {
  applyEncounterInitiativeAdvance,
  planEncounterInitiativeAdvance,
  settleEncounterInitiativeRound
} from './encounterInitiativeStateSettlement.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const actorA = '00000000-0000-4000-8000-000000000002'
const actorB = '00000000-0000-4000-8000-000000000003'
const actorC = '00000000-0000-4000-8000-000000000004'
const sideA = '00000000-0000-4000-8000-000000000005'
const sideB = '00000000-0000-4000-8000-000000000006'
const now = '2026-08-28T00:00:00.000Z'

function participant(actorId: string, sideId: string): EncounterInitiativeParticipantRecord {
  return {
    encounterId,
    round: 1,
    actorId,
    sideId,
    status: 'EVALUATED',
    initiativeScore: actorId === actorA ? 10 : 5,
    evaluation: { occurrenceId: null, resultChecksum: null },
    tie: { occurrenceId: null, resultChecksum: null },
    declaration: null,
    declarationChecksum: null,
    turnOrderOrdinal: null,
    version: 0,
    createdAt: now,
    updatedAt: now
  }
}

function side(sideId: string): EncounterInitiativeSideRecord {
  return {
    encounterId,
    round: 1,
    sideId,
    status: 'EVALUATED',
    initiativeScore: sideId === sideA ? 10 : 5,
    evaluation: { occurrenceId: null, resultChecksum: null },
    tie: { occurrenceId: null, resultChecksum: null },
    sideOrderOrdinal: null,
    version: 0,
    createdAt: now,
    updatedAt: now
  }
}

function state(procedure: 'ACTOR_ROLL' | 'SIDE_ROLL'): EncounterInitiativeRoundStateRecord {
  return {
    round: {
      encounterId,
      round: 1,
      procedure,
      cadence: 'ENCOUNTER_START',
      status: 'PREPARING',
      policySnapshotChecksum: 'a'.repeat(64),
      nextTurnOrderOrdinal: 0,
      version: 0,
      createdAt: now,
      updatedAt: now
    },
    participants: [
      participant(actorA, sideA),
      participant(actorB, sideA),
      participant(actorC, sideB)
    ],
    sides: procedure === 'SIDE_ROLL' ? [side(sideA), side(sideB)] : []
  }
}

function repository(
  procedure: 'ACTOR_ROLL' | 'SIDE_ROLL',
  cadence: 'ENCOUNTER_START' | 'EACH_ROUND' = 'ENCOUNTER_START'
) {
  const updateInitiativeParticipant = vi.fn(
    async (input: UpdateEncounterInitiativeParticipantDto) => ({
      encounterId: input.encounterId,
      round: input.round,
      actorId: input.actorId,
      sideId: input.actorId === actorC ? sideB : sideA,
      status: input.status,
      initiativeScore: input.initiativeScore,
      evaluation: input.evaluation,
      tie: input.tie,
      declaration: input.declaration,
      declarationChecksum: input.declarationChecksum,
      turnOrderOrdinal: input.turnOrderOrdinal,
      version: input.expectedVersion + 1,
      createdAt: now,
      updatedAt: now
    })
  )
  const updateInitiativeSide = vi.fn(async (input: UpdateEncounterInitiativeSideDto) => ({
    encounterId: input.encounterId,
    round: input.round,
    sideId: input.sideId,
    status: input.status,
    initiativeScore: input.initiativeScore,
    evaluation: input.evaluation,
    tie: input.tie,
    sideOrderOrdinal: input.sideOrderOrdinal,
    version: input.expectedVersion + 1,
    createdAt: now,
    updatedAt: now
  }))
  const updateInitiativeRound = vi.fn(async (input: UpdateEncounterInitiativeRoundDto) => ({
    encounterId: input.encounterId,
    round: input.round,
    procedure,
    cadence,
    policySnapshotChecksum: 'a'.repeat(64),
    status: input.status,
    nextTurnOrderOrdinal: input.nextTurnOrderOrdinal,
    version: input.expectedVersion + 1,
    createdAt: now,
    updatedAt: now
  }))
  return { updateInitiativeParticipant, updateInitiativeSide, updateInitiativeRound }
}

function activeState(input: {
  procedure: 'ACTOR_ROLL' | 'SIDE_ROLL'
  cadence?: 'ENCOUNTER_START' | 'EACH_ROUND'
  activeActorId: string
}): EncounterInitiativeRoundStateRecord {
  const base = state(input.procedure)
  const order = [actorC, actorA, actorB]
  const activeOrdinal = order.indexOf(input.activeActorId)
  return {
    round: {
      ...base.round,
      cadence: input.cadence ?? 'ENCOUNTER_START',
      status: 'ACTIVE',
      nextTurnOrderOrdinal: order.length,
      version: 1
    },
    participants: base.participants.map((value) => {
      const ordinal = order.indexOf(value.actorId)
      return {
        ...value,
        status: ordinal < activeOrdinal ? 'ACTED' : ordinal === activeOrdinal ? 'ACTIVE' : 'READY',
        turnOrderOrdinal: ordinal,
        version: 2
      }
    }),
    sides:
      input.procedure === 'SIDE_ROLL'
        ? base.sides.map((value) => ({
            ...value,
            status:
              value.sideId === sideB
                ? activeOrdinal === 0
                  ? 'ACTIVE'
                  : 'COMPLETED'
                : activeOrdinal < 1
                  ? 'READY'
                  : 'ACTIVE',
            sideOrderOrdinal: value.sideId === sideB ? 0 : 1,
            version: 2
          }))
        : []
  }
}

describe('settleEncounterInitiativeRound', () => {
  it('assigns immutable actor ordinals and activates only the first participant', async () => {
    const repo = repository('ACTOR_ROLL')
    const settled = await settleEncounterInitiativeRound({
      repository: repo,
      state: state('ACTOR_ROLL'),
      orderedActorIds: [actorC, actorA, actorB]
    })
    expect(settled.round).toMatchObject({ status: 'ACTIVE', nextTurnOrderOrdinal: 3 })
    expect(settled.participants).toMatchObject([
      { actorId: actorC, status: 'ACTIVE', turnOrderOrdinal: 0 },
      { actorId: actorA, status: 'READY', turnOrderOrdinal: 1 },
      { actorId: actorB, status: 'READY', turnOrderOrdinal: 2 }
    ])
    expect(repo.updateInitiativeParticipant).toHaveBeenCalledTimes(4)
  })

  it('settles side order and requires actors to remain in contiguous side blocks', async () => {
    const repo = repository('SIDE_ROLL')
    const settled = await settleEncounterInitiativeRound({
      repository: repo,
      state: state('SIDE_ROLL'),
      orderedSideIds: [sideB, sideA],
      orderedActorIds: [actorC, actorA, actorB]
    })
    expect(settled.sides).toMatchObject([
      { sideId: sideB, status: 'ACTIVE', sideOrderOrdinal: 0 },
      { sideId: sideA, status: 'READY', sideOrderOrdinal: 1 }
    ])
    await expect(
      settleEncounterInitiativeRound({
        repository: repository('SIDE_ROLL'),
        state: state('SIDE_ROLL'),
        orderedSideIds: [sideB, sideA],
        orderedActorIds: [actorC, actorA, actorC]
      })
    ).rejects.toThrow('exactly once')
  })

  it('rejects a non-preparing round or an incomplete order before writes', async () => {
    const repo = repository('ACTOR_ROLL')
    await expect(
      settleEncounterInitiativeRound({
        repository: repo,
        state: {
          ...state('ACTOR_ROLL'),
          round: { ...state('ACTOR_ROLL').round, status: 'ACTIVE' }
        },
        orderedActorIds: [actorA, actorB, actorC]
      })
    ).rejects.toThrow('preparing')
    await expect(
      settleEncounterInitiativeRound({
        repository: repo,
        state: state('ACTOR_ROLL'),
        orderedActorIds: [actorA, actorB]
      })
    ).rejects.toThrow('exactly once')
    expect(repo.updateInitiativeParticipant).not.toHaveBeenCalled()
  })
})

describe('Encounter initiative turn advancement', () => {
  it('seals and applies the exact next participant and side transition', async () => {
    const current = activeState({ procedure: 'SIDE_ROLL', activeActorId: actorC })
    const plan = planEncounterInitiativeAdvance({ state: current, currentActorId: actorC })
    expect(plan).toMatchObject({
      kind: 'SAME_ROUND',
      round: 1,
      currentActorId: actorC,
      nextActorId: actorA
    })
    const repo = repository('SIDE_ROLL')
    const advanced = await applyEncounterInitiativeAdvance({
      repository: repo,
      state: current,
      plan
    })
    expect(advanced.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorId: actorC, status: 'ACTED', turnOrderOrdinal: 0 }),
        expect.objectContaining({ actorId: actorA, status: 'ACTIVE', turnOrderOrdinal: 1 })
      ])
    )
    expect(advanced.sides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sideId: sideB, status: 'COMPLETED' }),
        expect.objectContaining({ sideId: sideA, status: 'ACTIVE' })
      ])
    )
    expect(repo.updateInitiativeRound).not.toHaveBeenCalled()
  })

  it('completes an each-round cursor without selecting the next round actor early', async () => {
    const current = activeState({
      procedure: 'ACTOR_ROLL',
      cadence: 'EACH_ROUND',
      activeActorId: actorB
    })
    const plan = planEncounterInitiativeAdvance({ state: current, currentActorId: actorB })
    expect(plan).toMatchObject({
      kind: 'ROUND_WRAP',
      round: 1,
      nextRound: 2,
      cadence: 'EACH_ROUND',
      currentActorId: actorB,
      firstActorId: null,
      orderedActorIds: [actorC, actorA, actorB]
    })
    const advanced = await applyEncounterInitiativeAdvance({
      repository: repository('ACTOR_ROLL', 'EACH_ROUND'),
      state: current,
      plan
    })
    expect(advanced.round.status).toBe('COMPLETED')
    expect(
      advanced.participants.find((participant) => participant.actorId === actorB)
    ).toMatchObject({
      status: 'ACTED',
      turnOrderOrdinal: 2
    })
  })

  it('rejects a sealed advance plan after normalized initiative currentness changes', async () => {
    const current = activeState({ procedure: 'ACTOR_ROLL', activeActorId: actorC })
    const plan = planEncounterInitiativeAdvance({ state: current, currentActorId: actorC })
    await expect(
      applyEncounterInitiativeAdvance({
        repository: repository('ACTOR_ROLL'),
        state: {
          ...current,
          round: { ...current.round, version: current.round.version + 1 }
        },
        plan
      })
    ).rejects.toThrow('changed')
  })
})

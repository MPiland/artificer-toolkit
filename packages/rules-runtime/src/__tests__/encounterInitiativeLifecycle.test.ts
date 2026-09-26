import { describe, expect, it } from 'vitest'
import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

import type { EncounterEvidenceMode } from '../encounterEvidenceMode.js'
import {
  resumeEncounterInitiativeLifecycle,
  startEncounterInitiativeLifecycle,
  type EncounterInitiativeLifecycleResult
} from '../encounterInitiativeLifecycle.js'
import type { InitiativeScoreBatchEntityResult } from '../encounterInitiativeScoreBatch.js'
import {
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '../encounterInitiativeStaging.js'
import { dnd5eInitiativeFactAdapter } from '../systems/dnd5e/initiativeFactAdapter.js'
import {
  ACTOR_A,
  ACTOR_B,
  ACTOR_C,
  SIDE_FOES,
  SIDE_HEROES,
  creatureSource,
  customSource,
  initiativePolicySnapshot,
  preparingRound,
  scriptedDice,
  testRulesRuntime
} from './encounterInitiativeFixtures.js'

const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f001'
const ACTORS = [
  { id: ACTOR_A, sideId: SIDE_HEROES },
  { id: ACTOR_B, sideId: SIDE_FOES },
  { id: ACTOR_C, sideId: SIDE_FOES }
]
/** Initiative modifiers +2, +0 and -1. */
const CREATURES = [
  creatureSource(ACTOR_A, 2),
  creatureSource(ACTOR_B, 0),
  creatureSource(ACTOR_C, -1)
]

type Policy = ReturnType<typeof initiativePolicySnapshot>

async function harness(input: {
  policy: Policy
  mode: EncounterEvidenceMode
  dice?: readonly number[]
  sources?: readonly InitiativeActorFactSource[]
  state?: EncounterInitiativeRoundStateDto
}) {
  const state = input.state ?? preparingRound({ actors: ACTORS, policy: input.policy })
  const staged = inMemoryInitiativeRepository(state)
  const dice = scriptedDice(input.dice ?? [])
  const runtime = await testRulesRuntime()
  const shared = {
    repository: staged.repository,
    runtime,
    gameSystemId: input.policy.snapshot.gameSystemId,
    snapshot: input.policy.snapshot,
    snapshotChecksum: input.policy.checksum,
    sources: { characterIds: [], actors: input.sources ?? CREATURES },
    adapter: dnd5eInitiativeFactAdapter,
    mode: input.mode,
    integerSource: (request: { min: number; max: number }) => dice.next(request)
  }
  return {
    dice,
    read: () => serializeStagedInitiativeRoundState(staged.read()),
    start: () =>
      startEncounterInitiativeLifecycle({
        ...shared,
        occurrenceId: OCCURRENCE_ID,
        state,
        legacyOrderedActorIds: []
      }),
    resume: (
      result: EncounterInitiativeLifecycleResult,
      requestId: string,
      value: number | { selectedEntityId: string }
    ) => {
      if (result.kind !== 'PENDING') throw new Error('Expected a pending initiative lifecycle.')
      return resumeEncounterInitiativeLifecycle({
        ...shared,
        state: staged.read(),
        pending: result.pending,
        requestId,
        value
      })
    }
  }
}

function scores(results: readonly InitiativeScoreBatchEntityResult[]) {
  return results.map(({ entity, result }) => [
    entity.id,
    result.kind === 'GRAPH_COMPLETE' ? result.execution.score : result.kind
  ])
}

function participantScores(state: ReturnType<typeof serializeStagedInitiativeRoundState>) {
  return state.participants.map((participant) => [
    participant.actorId,
    participant.status,
    participant.initiativeScore,
    participant.turnOrderOrdinal
  ])
}

/** The integer request a pending lifecycle is waiting on. */
function pendingRequest(result: EncounterInitiativeLifecycleResult) {
  if (result.kind !== 'PENDING') throw new Error('Expected a pending initiative lifecycle.')
  const continuation =
    result.pending.phase === 'PRIMARY_SCORE'
      ? result.pending.scoreBatch.continuation
      : result.pending.phase === 'TIE_RESOLUTION'
        ? result.pending.tieResolution.pendingScoreBatch.continuation
        : result.pending.orderResolution.continuation
  if (continuation.request.kind !== 'INTEGER_RANGE') throw new Error('Expected an integer request.')
  return {
    phase: result.pending.phase,
    requestId: continuation.request.requestId,
    min: continuation.request.min,
    max: continuation.request.max
  }
}

const actorRoll = initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' })

describe('initiative lifecycle with automatic dice (Automatic)', () => {
  it('scores each actor as d20 + initiative modifier and orders highest first', async () => {
    // A: 11 + 2 = 13, B: 17 + 0 = 17, C: 4 - 1 = 3
    const run = await harness({ policy: actorRoll, mode: 'AUTO_ROLL', dice: [11, 17, 4] })
    const result = await run.start()

    if (result.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(result.orderedActorIds).toEqual([ACTOR_B, ACTOR_A, ACTOR_C])
    expect(result.orderedSideIds).toEqual([])
    expect(scores(result.evidence.primaryResults)).toEqual([
      [ACTOR_A, 13],
      [ACTOR_B, 17],
      [ACTOR_C, 3]
    ])
    expect(result.evidence.tieAttempts).toEqual([])
    expect(result.evidence.orderChoices).toEqual([])
    expect(run.dice.requests).toEqual([
      { min: 1, max: 20 },
      { min: 1, max: 20 },
      { min: 1, max: 20 }
    ])
    expect(participantScores(run.read())).toEqual([
      [ACTOR_A, 'READY', 13, 1],
      [ACTOR_B, 'ACTIVE', 17, 0],
      [ACTOR_C, 'READY', 3, 2]
    ])
    expect(run.read().round).toMatchObject({ status: 'ACTIVE', nextTurnOrderOrdinal: 3 })
  })

  it('records the d20 and the modifier in each actor evidence trace', async () => {
    const run = await harness({ policy: actorRoll, mode: 'AUTO_ROLL', dice: [11, 17, 4] })
    const result = await run.start()
    if (result.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    const first = result.evidence.primaryResults[0]!.result
    if (first.kind !== 'GRAPH_COMPLETE') throw new Error('Expected a completed score.')

    expect(first.execution.execution.evidence.facts).toEqual({ 'initiative.modifier': 2 })
    expect(
      first.execution.execution.evidence.trace.map((step) => [
        step.nodeId,
        step.inputs,
        step.outputs
      ])
    ).toEqual([
      ['d20', { min: 1, max: 20 }, { value: 11 }],
      ['score', { left: 11, right: 2 }, { value: 13 }]
    ])
  })

  it('rolls the tie-breaker d20 for a tied group only and keeps the group at its initiative position', async () => {
    // A: 13 + 2 = 15 and B: 15 + 0 = 15 tie; C: 13 - 1 = 12. Tie-breaker: A 4, B 9.
    const run = await harness({ policy: actorRoll, mode: 'AUTO_ROLL', dice: [13, 15, 13, 4, 9] })
    const result = await run.start()

    if (result.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(result.orderedActorIds).toEqual([ACTOR_B, ACTOR_A, ACTOR_C])
    expect(scores(result.evidence.primaryResults)).toEqual([
      [ACTOR_A, 15],
      [ACTOR_B, 15],
      [ACTOR_C, 12]
    ])
    expect(
      result.evidence.tieAttempts.map((attempt) => [
        attempt.originalScore,
        attempt.attemptOrdinal,
        scores(attempt.results)
      ])
    ).toEqual([
      [
        15,
        1,
        [
          [ACTOR_A, 4],
          [ACTOR_B, 9]
        ]
      ]
    ])
    expect(run.dice.remaining()).toBe(0)
    const state = run.read()
    expect(
      state.participants.map((participant) => [
        participant.actorId,
        participant.turnOrderOrdinal,
        participant.tie.occurrenceId
      ])
    ).toEqual([
      [ACTOR_A, 1, OCCURRENCE_ID],
      [ACTOR_B, 0, OCCURRENCE_ID],
      [ACTOR_C, 2, null]
    ])
    expect(state.participants.find((participant) => participant.actorId === ACTOR_C)).toMatchObject(
      { initiativeScore: 12 }
    )
  })

  it('rerolls a tie again while a repeating tie-breaker has attempts left', async () => {
    const repeating = initiativePolicySnapshot({
      procedure: 'ACTOR_ROLL',
      cadence: 'ENCOUNTER_START',
      tie: { repeatOnTie: true, maximumAttempts: 3 }
    })
    // A 15 and B 15 tie; tie-breaker 7/7 ties again; second attempt A 12, B 3.
    const run = await harness({
      policy: repeating,
      mode: 'AUTO_ROLL',
      dice: [13, 15, 13, 7, 7, 12, 3]
    })
    const result = await run.start()

    if (result.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(result.orderedActorIds).toEqual([ACTOR_A, ACTOR_B, ACTOR_C])
    expect(
      result.evidence.tieAttempts.map((attempt) => [
        attempt.originalScore,
        attempt.attemptOrdinal,
        scores(attempt.results)
      ])
    ).toEqual([
      [
        15,
        1,
        [
          [ACTOR_A, 7],
          [ACTOR_B, 7]
        ]
      ],
      [
        15,
        2,
        [
          [ACTOR_A, 12],
          [ACTOR_B, 3]
        ]
      ]
    ])
  })

  it('stops rerolling after the last allowed tie-breaker and asks the GM to order the group', async () => {
    const twoAttempts = initiativePolicySnapshot({
      procedure: 'ACTOR_ROLL',
      cadence: 'ENCOUNTER_START',
      tie: { repeatOnTie: true, maximumAttempts: 2 }
    })
    // A 15 and B 15 tie; both tie-breakers tie (7/7, then 5/5).
    const run = await harness({
      policy: twoAttempts,
      mode: 'AUTO_ROLL',
      dice: [13, 15, 13, 7, 7, 5, 5]
    })
    const pending = await run.start()

    if (pending.kind !== 'PENDING' || pending.pending.phase !== 'ENTITY_ORDER')
      throw new Error('Expected a pending order choice.')
    expect(run.dice.remaining()).toBe(0)
    expect(
      pending.pending.evidence.tieAttempts.map((attempt) => [
        attempt.attemptOrdinal,
        scores(attempt.results)
      ])
    ).toEqual([
      [
        1,
        [
          [ACTOR_A, 7],
          [ACTOR_B, 7]
        ]
      ],
      [
        2,
        [
          [ACTOR_A, 5],
          [ACTOR_B, 5]
        ]
      ]
    ])
  })

  it('asks the GM to order a group whose single tie-breaker also ties', async () => {
    // A 15 and B 15 tie; the one allowed tie-breaker ties 7/7.
    const run = await harness({ policy: actorRoll, mode: 'AUTO_ROLL', dice: [13, 15, 13, 7, 7] })
    const pending = await run.start()

    expect(pendingRequest(pending)).toMatchObject({ phase: 'ENTITY_ORDER', min: 0, max: 1 })
    if (pending.kind !== 'PENDING' || pending.pending.phase !== 'ENTITY_ORDER')
      throw new Error('Expected a pending order choice.')
    expect(pending.pending.entityKind).toBe('ACTOR')
    expect(pending.pending.orderResolution.remainingCurrent).toEqual([
      { kind: 'ACTOR', id: ACTOR_A },
      { kind: 'ACTOR', id: ACTOR_B }
    ])

    const settled = await run.resume(pending, pendingRequest(pending).requestId, {
      selectedEntityId: ACTOR_B
    })
    if (settled.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(settled.orderedActorIds).toEqual([ACTOR_B, ACTOR_A, ACTOR_C])
    expect(settled.evidence.orderChoices.map((choice) => choice.selectedEntity)).toEqual([
      { kind: 'ACTOR', id: ACTOR_B }
    ])
    expect(
      participantScores(run.read()).map(([actorId, status, , ordinal]) => [
        actorId,
        status,
        ordinal
      ])
    ).toEqual([
      [ACTOR_A, 'READY', 1],
      [ACTOR_B, 'ACTIVE', 0],
      [ACTOR_C, 'READY', 2]
    ])
  })

  it('asks the GM to order everyone when an actor has no initiative facts', async () => {
    const run = await harness({
      policy: actorRoll,
      mode: 'AUTO_ROLL',
      dice: [11, 17],
      sources: [creatureSource(ACTOR_A, 2), creatureSource(ACTOR_B, 0), customSource(ACTOR_C)]
    })
    const pending = await run.start()

    expect(pendingRequest(pending)).toMatchObject({ phase: 'ENTITY_ORDER', min: 0, max: 2 })
    if (pending.kind !== 'PENDING' || pending.pending.phase !== 'ENTITY_ORDER')
      throw new Error('Expected a pending order choice.')
    expect(scores(pending.pending.evidence.primaryResults)).toEqual([
      [ACTOR_A, 13],
      [ACTOR_B, 17],
      [ACTOR_C, 'FACTS_UNAVAILABLE']
    ])
    const second = await run.resume(pending, pendingRequest(pending).requestId, {
      selectedEntityId: ACTOR_C
    })
    expect(pendingRequest(second)).toMatchObject({ phase: 'ENTITY_ORDER', min: 0, max: 1 })
    const settled = await run.resume(second, pendingRequest(second).requestId, {
      selectedEntityId: ACTOR_B
    })
    if (settled.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(settled.orderedActorIds).toEqual([ACTOR_C, ACTOR_B, ACTOR_A])
  })
})

describe('initiative lifecycle with prompted dice (Assisted)', () => {
  it('waits for each actor d20 in canonical order and settles after the last', async () => {
    const run = await harness({ policy: actorRoll, mode: 'PROMPT' })
    const first = await run.start()

    expect(pendingRequest(first)).toMatchObject({ phase: 'PRIMARY_SCORE', min: 1, max: 20 })
    expect(participantScores(run.read())).toEqual([
      [ACTOR_A, 'PENDING', null, null],
      [ACTOR_B, 'UNRESOLVED', null, null],
      [ACTOR_C, 'UNRESOLVED', null, null]
    ])
    const second = await run.resume(first, pendingRequest(first).requestId, 11)
    expect(participantScores(run.read())).toEqual([
      [ACTOR_A, 'EVALUATED', 13, null],
      [ACTOR_B, 'PENDING', null, null],
      [ACTOR_C, 'UNRESOLVED', null, null]
    ])
    const third = await run.resume(second, pendingRequest(second).requestId, 17)
    const settled = await run.resume(third, pendingRequest(third).requestId, 4)

    if (settled.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(settled.orderedActorIds).toEqual([ACTOR_B, ACTOR_A, ACTOR_C])
    expect(participantScores(run.read())).toEqual([
      [ACTOR_A, 'READY', 13, 1],
      [ACTOR_B, 'ACTIVE', 17, 0],
      [ACTOR_C, 'READY', 3, 2]
    ])
    expect(run.dice.requests).toEqual([])
  })

  it('prompts for the tie-breaker d20 of a tied group', async () => {
    const run = await harness({ policy: actorRoll, mode: 'PROMPT' })
    let result = await run.start()
    for (const value of [13, 15, 13]) {
      result = await run.resume(result, pendingRequest(result).requestId, value)
    }

    expect(pendingRequest(result)).toMatchObject({ phase: 'TIE_RESOLUTION', min: 1, max: 20 })
    result = await run.resume(result, pendingRequest(result).requestId, 2)
    result = await run.resume(result, pendingRequest(result).requestId, 18)
    if (result.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(result.orderedActorIds).toEqual([ACTOR_B, ACTOR_A, ACTOR_C])
  })

  it('refuses evidence for another request or outside the d20 range', async () => {
    const run = await harness({ policy: actorRoll, mode: 'PROMPT' })
    const first = await run.start()

    await expect(run.resume(first, 'another-request', 11)).rejects.toThrow(
      'Initiative score evidence does not match the issued request.'
    )
    await expect(run.resume(first, pendingRequest(first).requestId, 21)).rejects.toThrow(
      'Initiative score evidence is outside the issued range.'
    )
    await expect(
      run.resume(first, pendingRequest(first).requestId, { selectedEntityId: ACTOR_A })
    ).rejects.toThrow('Initiative score requires integer evidence.')
  })
})

describe('initiative lifecycle procedures and cadence', () => {
  const sideRoll = initiativePolicySnapshot({ procedure: 'SIDE_ROLL', cadence: 'EACH_ROUND' })

  it('rolls one unmodified d20 per side and asks for the order inside a side with several actors', async () => {
    // Heroes (A) 8, Foes (B, C) 14.
    const run = await harness({ policy: sideRoll, mode: 'AUTO_ROLL', dice: [8, 14] })
    const pending = await run.start()

    if (pending.kind !== 'PENDING' || pending.pending.phase !== 'SIDE_ACTOR_ORDER')
      throw new Error('Expected a pending side actor order.')
    expect(pending.pending.orderedSideIds).toEqual([SIDE_FOES, SIDE_HEROES])
    expect(scores(pending.pending.evidence.primaryResults)).toEqual([
      [SIDE_HEROES, 8],
      [SIDE_FOES, 14]
    ])
    expect(pending.pending.orderResolution.remainingCurrent).toEqual([
      { kind: 'ACTOR', id: ACTOR_B },
      { kind: 'ACTOR', id: ACTOR_C }
    ])
    expect(
      run.read().sides.map((side) => [side.sideId, side.status, side.initiativeScore])
    ).toEqual([
      [SIDE_HEROES, 'EVALUATED', 8],
      [SIDE_FOES, 'EVALUATED', 14]
    ])

    const settled = await run.resume(pending, pendingRequest(pending).requestId, {
      selectedEntityId: ACTOR_C
    })
    if (settled.kind !== 'SETTLED') throw new Error('Expected settled initiative.')
    expect(settled.orderedSideIds).toEqual([SIDE_FOES, SIDE_HEROES])
    expect(settled.orderedActorIds).toEqual([ACTOR_C, ACTOR_B, ACTOR_A])
    expect(
      run.read().sides.map((side) => [side.sideId, side.status, side.sideOrderOrdinal])
    ).toEqual([
      [SIDE_HEROES, 'READY', 1],
      [SIDE_FOES, 'ACTIVE', 0]
    ])
    expect(run.read().round).toMatchObject({ procedure: 'SIDE_ROLL', cadence: 'EACH_ROUND' })
  })

  it('settles a manual round in the given order without rules', async () => {
    const state = preparingRound({ actors: ACTORS })
    const staged = inMemoryInitiativeRepository(state)
    const result = await startEncounterInitiativeLifecycle({
      repository: staged.repository,
      runtime: null,
      occurrenceId: OCCURRENCE_ID,
      gameSystemId: actorRoll.snapshot.gameSystemId,
      state,
      snapshot: null,
      snapshotChecksum: null,
      sources: { characterIds: [], actors: [] },
      adapter: null,
      mode: 'MANUAL',
      legacyOrderedActorIds: [ACTOR_C, ACTOR_B, ACTOR_A]
    })

    expect(result).toMatchObject({
      kind: 'SETTLED',
      orderedActorIds: [ACTOR_C, ACTOR_B, ACTOR_A],
      orderedSideIds: [],
      evidence: { primaryResults: [], tieAttempts: [], orderChoices: [] }
    })
    expect(participantScores(serializeStagedInitiativeRoundState(staged.read()))).toEqual([
      [ACTOR_A, 'READY', null, 2],
      [ACTOR_B, 'READY', null, 1],
      [ACTOR_C, 'ACTIVE', null, 0]
    ])
  })

  it('refuses a round whose procedure, cadence or checksum differs from the frozen policy', async () => {
    const eachRound = initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' })
    const run = await harness({
      policy: eachRound,
      mode: 'AUTO_ROLL',
      state: preparingRound({ actors: ACTORS, policy: actorRoll })
    })

    await expect(run.start()).rejects.toThrow(
      'Normalized initiative round does not match its exact Encounter policy snapshot.'
    )
  })

  it('refuses a manual round that still carries a policy checksum', async () => {
    const state = preparingRound({ actors: ACTORS, policy: actorRoll })
    await expect(
      startEncounterInitiativeLifecycle({
        repository: inMemoryInitiativeRepository(state).repository,
        runtime: null,
        occurrenceId: OCCURRENCE_ID,
        gameSystemId: actorRoll.snapshot.gameSystemId,
        state,
        snapshot: null,
        snapshotChecksum: null,
        sources: { characterIds: [], actors: [] },
        adapter: null,
        mode: 'MANUAL',
        legacyOrderedActorIds: [ACTOR_A, ACTOR_B, ACTOR_C]
      })
    ).rejects.toThrow('Manual initiative round cannot retain a policy snapshot.')
  })

  it('refuses sources that do not match the round participants', async () => {
    const run = await harness({
      policy: actorRoll,
      mode: 'AUTO_ROLL',
      sources: [creatureSource(ACTOR_A, 2), creatureSource(ACTOR_B, 0)]
    })

    await expect(run.start()).rejects.toThrow(
      'Locked initiative sources do not match the normalized round participants.'
    )
  })
})

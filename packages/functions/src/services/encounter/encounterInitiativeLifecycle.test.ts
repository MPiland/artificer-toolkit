import { describe, expect, it, vi } from 'vitest'

import type {
  EncounterActorRecord,
  EncounterInitiativeRoundStateRecord
} from '@artificer-toolkit/db'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type {
  UpdateEncounterInitiativeParticipantDto,
  UpdateEncounterInitiativeRoundDto,
  UpdateEncounterInitiativeSideDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { InitiativeFactAdapter } from '../rules/initiativeFactAdapter.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import type { LockedEncounterInitiativeFactSources } from './encounterInitiativeFactSources.js'
import {
  resumeEncounterInitiativeLifecycle,
  startEncounterInitiativeLifecycle
} from './encounterInitiativeLifecycle.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const occurrenceId = '00000000-0000-4000-8000-000000000002'
const systemId = '00000000-0000-4000-8000-000000000003'
const policyId = '00000000-0000-4000-8000-000000000004'
const evaluationId = '00000000-0000-4000-8000-000000000005'
const tieId = '00000000-0000-4000-8000-000000000006'
const orderId = '00000000-0000-4000-8000-000000000007'
const sourceId = '00000000-0000-4000-8000-000000000008'
const actorA = '00000000-0000-4000-8000-000000000011'
const actorB = '00000000-0000-4000-8000-000000000012'
const actorC = '00000000-0000-4000-8000-000000000013'
const sideA = '00000000-0000-4000-8000-000000000021'
const sideB = '00000000-0000-4000-8000-000000000022'
const checksum = 'a'.repeat(64)
const now = '2026-08-28T00:00:00.000Z'

function graph(definitionId: string, output: string) {
  return {
    definitionId,
    contentSourceId: sourceId,
    definitionVersion: 1,
    definitionChecksum: checksum,
    contractVersion: 1,
    label: definitionId,
    document: {
      schemaVersion: 1 as const,
      id: definitionId,
      gameSystemId: systemId,
      definitionFamilyKey: 'rules-runtime-graph',
      nodes: [
        {
          id: 'resolve',
          operation: { key: 'initiative.resolve', contractVersion: 1 },
          inputs: { value: { kind: 'FACT' as const, factKey: 'initiative.value' } }
        }
      ],
      outputs: {
        [output]: { kind: 'NODE_OUTPUT' as const, nodeId: 'resolve', port: output },
        ...(output === 'score' ? { automatic: { kind: 'LITERAL' as const, value: true } } : {})
      }
    }
  }
}

function snapshot(
  procedure: 'ACTOR_ROLL' | 'ACTOR_SCORE' | 'SIDE_ROLL'
): EncounterInitiativePolicySnapshotDto {
  const evaluationGraph = graph(evaluationId, 'score')
  const tieResolver = graph(tieId, 'score')
  const orderChoiceGraph = graph(orderId, 'selection')
  return {
    schemaVersion: 1,
    gameSystemId: systemId,
    policy: {
      definitionId: policyId,
      contentSourceId: sourceId,
      definitionVersion: 1,
      definitionChecksum: checksum,
      contractVersion: 1,
      label: 'Initiative policy',
      document: {
        schemaVersion: 1,
        kind: 'INITIATIVE_POLICY',
        id: policyId,
        gameSystemId: systemId,
        procedure,
        cadence: 'ENCOUNTER_START',
        evaluationGraph: {
          definitionId: evaluationId,
          definitionVersion: 1,
          definitionChecksum: checksum,
          scoreOutput: 'score',
          automaticOutput: 'automatic',
          sortDirection: 'DESCENDING'
        },
        orderChoiceGraph: {
          definitionId: orderId,
          definitionVersion: 1,
          definitionChecksum: checksum,
          selectionOutput: 'selection',
          minimumIndexFact: 'choice.min',
          maximumIndexFact: 'choice.max'
        },
        tieResolvers: [
          {
            definitionId: tieId,
            definitionVersion: 1,
            definitionChecksum: checksum,
            scoreOutput: 'score',
            automaticOutput: 'automatic',
            sortDirection: 'DESCENDING',
            repeatOnTie: false,
            maximumAttempts: 1
          }
        ],
        defaultTieResolverDefinitionId: tieId
      }
    },
    evaluationGraph,
    tieResolver,
    orderChoiceGraph
  } as EncounterInitiativePolicySnapshotDto
}

function state(input: {
  procedure: 'MANUAL' | 'ACTOR_ROLL' | 'ACTOR_SCORE' | 'SIDE_ROLL'
  actors?: readonly { id: string; sideId: string }[]
}): EncounterInitiativeRoundStateRecord {
  const actors = input.actors ?? [
    { id: actorA, sideId: sideA },
    { id: actorB, sideId: sideB }
  ]
  return {
    round: {
      encounterId,
      round: 1,
      procedure: input.procedure,
      cadence: 'ENCOUNTER_START',
      status: 'PREPARING',
      policySnapshotChecksum: input.procedure === 'MANUAL' ? null : checksum,
      nextTurnOrderOrdinal: 0,
      version: 0,
      createdAt: now,
      updatedAt: now
    },
    participants: actors.map(({ id, sideId }) => ({
      encounterId,
      round: 1,
      actorId: id,
      sideId,
      status: 'UNRESOLVED',
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal: null,
      version: 0,
      createdAt: now,
      updatedAt: now
    })),
    sides:
      input.procedure === 'SIDE_ROLL'
        ? [...new Set(actors.map((actor) => actor.sideId))].sort().map((sideId) => ({
            encounterId,
            round: 1,
            sideId,
            status: 'UNRESOLVED',
            initiativeScore: null,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            sideOrderOrdinal: null,
            version: 0,
            createdAt: now,
            updatedAt: now
          }))
        : []
  }
}

function actor(id: string): EncounterActorRecord {
  return {
    id,
    encounterId,
    kind: 'CUSTOM',
    sourceId: null,
    sourceRevision: null,
    label: id,
    systemId,
    stableTieKey: id,
    public: true,
    currentHitPoints: 1,
    maxHitPoints: 1,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {},
    createdAt: now,
    updatedAt: now
  }
}

function sources(ids: readonly string[]): LockedEncounterInitiativeFactSources {
  return {
    characterIds: [],
    actors: ids.map((id) => ({ kind: 'CUSTOM', actor: actor(id), systemId }))
  }
}

function adapter(): InitiativeFactAdapter {
  return {
    gameSystemId: systemId,
    bindActor: (source) => ({ automatic: true, facts: { actor: source.actor.id } }),
    bindDeclaredActor: (source) => ({ automatic: true, facts: { actor: source.actor.id } }),
    bindSide: (source) => ({ automatic: true, facts: { side: source.sideId } })
  }
}

function repository(inputState: EncounterInitiativeRoundStateRecord) {
  const participantSide = new Map(
    inputState.participants.map((participant) => [participant.actorId, participant.sideId])
  )
  return {
    updateInitiativeParticipant: vi.fn(async (input: UpdateEncounterInitiativeParticipantDto) => ({
      encounterId: input.encounterId,
      round: input.round,
      actorId: input.actorId,
      sideId: participantSide.get(input.actorId)!,
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
    })),
    updateInitiativeSide: vi.fn(async (input: UpdateEncounterInitiativeSideDto) => ({
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
    })),
    updateInitiativeRound: vi.fn(async (input: UpdateEncounterInitiativeRoundDto) => ({
      ...inputState.round,
      status: input.status,
      nextTurnOrderOrdinal: input.nextTurnOrderOrdinal,
      version: input.expectedVersion + 1,
      updatedAt: now
    }))
  }
}

function completed(outputs: Record<string, number | boolean>): ServerCompletedRuleExecutionDto {
  return {
    status: 'COMPLETE',
    outputs,
    evidence: {
      source: {
        definitionId: evaluationId,
        gameSystemId: systemId,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs
    }
  }
}

function continuation(requestId: string): ServerRuleExecutionContinuationDto {
  return {
    schemaVersion: 1,
    occurrenceId,
    graph: {} as ServerRuleExecutionContinuationDto['graph'],
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: { requestId, kind: 'INTEGER_RANGE', nodeId: 'roll', ordinal: 0, min: 1, max: 20 },
    authority: 'APPLICATION_SERVICE',
    redaction: 'SERVER_ONLY',
    seal: 'b'.repeat(64)
  }
}

function runtime(
  results: readonly (
    | ServerCompletedRuleExecutionDto
    | { status: 'PAUSED'; continuation: ServerRuleExecutionContinuationDto }
  )[]
): RulesRuntimeService {
  const next = vi.fn()
  for (const result of results) next.mockResolvedValueOnce(result)
  return {
    executeResolved: vi.fn(() => next()),
    resume: vi.fn(() => next())
  } as unknown as RulesRuntimeService
}

describe('Encounter initiative lifecycle', () => {
  it('settles an explicit Manual round from the existing GM order without runtime evaluation', async () => {
    const initial = state({ procedure: 'MANUAL' })
    const runtimeService = runtime([])
    const settled = await startEncounterInitiativeLifecycle({
      repository: repository(initial),
      runtime: runtimeService,
      occurrenceId,
      gameSystemId: systemId,
      state: initial,
      snapshot: null,
      snapshotChecksum: null,
      sources: sources([actorA, actorB]),
      adapter: null,
      mode: 'MANUAL',
      legacyOrderedActorIds: [actorB, actorA]
    })
    expect(settled).toMatchObject({
      kind: 'SETTLED',
      orderedActorIds: [actorB, actorA]
    })
    expect(
      settled.state.participants.find((participant) => participant.actorId === actorB)
    ).toMatchObject({
      status: 'ACTIVE',
      turnOrderOrdinal: 0
    })
    expect(runtimeService.executeResolved).not.toHaveBeenCalled()
  })

  it('evaluates actor scores and settles the exact descending order before activation', async () => {
    const initial = state({ procedure: 'ACTOR_SCORE' })
    const runtimeService = runtime([
      completed({ score: 10, automatic: true }),
      completed({ score: 20, automatic: true })
    ])
    const settled = await startEncounterInitiativeLifecycle({
      repository: repository(initial),
      runtime: runtimeService,
      occurrenceId,
      gameSystemId: systemId,
      state: initial,
      snapshot: snapshot('ACTOR_SCORE'),
      snapshotChecksum: checksum,
      sources: sources([actorA, actorB]),
      adapter: adapter(),
      mode: 'AUTOMATIC',
      legacyOrderedActorIds: []
    })
    expect(settled).toMatchObject({
      kind: 'SETTLED',
      orderedActorIds: [actorB, actorA]
    })
    expect(
      settled.state.participants.find((participant) => participant.actorId === actorB)
    ).toMatchObject({
      status: 'ACTIVE',
      turnOrderOrdinal: 0
    })
    if (settled.kind !== 'SETTLED') throw new Error('Expected settled initiative evidence.')
    expect(settled.evidence.primaryResults).toHaveLength(2)
    expect(settled.evidence.tieAttempts).toEqual([])
    expect(runtimeService.executeResolved).toHaveBeenCalledTimes(2)
  })

  it('retains primary and tie graph evidence through final round settlement', async () => {
    const initial = state({ procedure: 'ACTOR_SCORE' })
    const runtimeService = runtime([
      completed({ score: 10, automatic: true }),
      completed({ score: 10, automatic: true }),
      completed({ score: 18, automatic: true }),
      completed({ score: 4, automatic: true })
    ])
    const settled = await startEncounterInitiativeLifecycle({
      repository: repository(initial),
      runtime: runtimeService,
      occurrenceId,
      gameSystemId: systemId,
      state: initial,
      snapshot: snapshot('ACTOR_SCORE'),
      snapshotChecksum: checksum,
      sources: sources([actorA, actorB]),
      adapter: adapter(),
      mode: 'AUTOMATIC',
      legacyOrderedActorIds: []
    })

    expect(settled).toMatchObject({
      kind: 'SETTLED',
      orderedActorIds: [actorA, actorB],
      evidence: {
        primaryResults: [{ entity: { id: actorA } }, { entity: { id: actorB } }],
        tieAttempts: [
          {
            originalScore: 10,
            attemptOrdinal: 1,
            results: [{ entity: { id: actorA } }, { entity: { id: actorB } }]
          }
        ]
      }
    })
    expect(runtimeService.executeResolved).toHaveBeenCalledTimes(4)
  })

  it('resumes Assisted score evidence and completes the remaining actor batch once', async () => {
    const initial = state({ procedure: 'ACTOR_ROLL' })
    const pending = continuation('initiative-roll')
    const runtimeService = runtime([
      { status: 'PAUSED', continuation: pending },
      completed({ score: 15, automatic: true }),
      completed({ score: 10, automatic: true })
    ])
    const repo = repository(initial)
    const started = await startEncounterInitiativeLifecycle({
      repository: repo,
      runtime: runtimeService,
      occurrenceId,
      gameSystemId: systemId,
      state: initial,
      snapshot: snapshot('ACTOR_ROLL'),
      snapshotChecksum: checksum,
      sources: sources([actorA, actorB]),
      adapter: adapter(),
      mode: 'ASSISTED',
      legacyOrderedActorIds: []
    })
    if (started.kind !== 'PENDING') throw new Error('Expected a pending initiative score.')
    await expect(
      resumeEncounterInitiativeLifecycle({
        repository: repo,
        runtime: runtimeService,
        gameSystemId: systemId,
        state: started.state,
        snapshot: snapshot('ACTOR_ROLL'),
        snapshotChecksum: checksum,
        sources: sources([actorA, actorB]),
        adapter: adapter(),
        mode: 'ASSISTED',
        pending: started.pending,
        requestId: 'initiative-roll',
        value: 12
      })
    ).resolves.toMatchObject({ kind: 'SETTLED', orderedActorIds: [actorA, actorB] })
    expect(runtimeService.resume).toHaveBeenCalledTimes(1)
    expect(runtimeService.executeResolved).toHaveBeenCalledTimes(2)
  })

  it('orders sides first and uses the pinned choice graph for exact within-side actor order', async () => {
    const initial = state({
      procedure: 'SIDE_ROLL',
      actors: [
        { id: actorA, sideId: sideA },
        { id: actorB, sideId: sideA },
        { id: actorC, sideId: sideB }
      ]
    })
    const runtimeService = runtime([
      completed({ score: 20, automatic: true }),
      completed({ score: 10, automatic: true }),
      completed({ selection: 1 })
    ])
    await expect(
      startEncounterInitiativeLifecycle({
        repository: repository(initial),
        runtime: runtimeService,
        occurrenceId,
        gameSystemId: systemId,
        state: initial,
        snapshot: snapshot('SIDE_ROLL'),
        snapshotChecksum: checksum,
        sources: sources([actorA, actorB, actorC]),
        adapter: adapter(),
        mode: 'AUTOMATIC',
        legacyOrderedActorIds: []
      })
    ).resolves.toMatchObject({
      kind: 'SETTLED',
      orderedSideIds: [sideA, sideB],
      orderedActorIds: [actorB, actorA, actorC]
    })
    expect(runtimeService.executeResolved).toHaveBeenCalledTimes(3)
  })
})

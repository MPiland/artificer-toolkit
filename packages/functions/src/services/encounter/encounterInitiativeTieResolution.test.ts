import { describe, expect, it, vi } from 'vitest'

import type { InitiativePolicyTieResolverPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { InitiativeFactBinding } from '../rules/initiativeFactAdapter.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import type { InitiativeScoreBatchEntity } from './encounterInitiativeScoreBatch.js'
import type { InitiativeScoreOrderGroup } from './encounterInitiativeOrdering.js'
import {
  resumeInitiativeTieResolution,
  startInitiativeTieResolution
} from './encounterInitiativeTieResolution.js'

const gameSystemId = '00000000-0000-4000-8000-000000000001'
const definitionId = '00000000-0000-4000-8000-000000000002'
const occurrenceId = '00000000-0000-4000-8000-000000000003'
const actorA = '00000000-0000-4000-8000-000000000004'
const actorB = '00000000-0000-4000-8000-000000000005'
const actorC = '00000000-0000-4000-8000-000000000006'
const actorD = '00000000-0000-4000-8000-000000000007'
const checksum = 'a'.repeat(64)

const graph = {
  definitionId,
  contentSourceId: '00000000-0000-4000-8000-000000000008',
  definitionVersion: 1,
  definitionChecksum: checksum,
  contractVersion: 1,
  label: 'Tie resolver',
  document: {
    schemaVersion: 1 as const,
    id: definitionId,
    gameSystemId,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'resolve',
        operation: { key: 'initiative.resolve', contractVersion: 1 },
        inputs: { score: { kind: 'FACT' as const, factKey: 'initiative.score' } }
      }
    ],
    outputs: {
      score: { kind: 'NODE_OUTPUT' as const, nodeId: 'resolve', port: 'score' },
      automatic: { kind: 'LITERAL' as const, value: true }
    }
  }
} satisfies EncounterInitiativePolicySnapshotDto['tieResolver']

function pin(
  input: Partial<InitiativePolicyTieResolverPinDto> = {}
): InitiativePolicyTieResolverPinDto {
  return {
    definitionId,
    definitionVersion: 1,
    definitionChecksum: checksum,
    scoreOutput: 'score',
    automaticOutput: 'automatic',
    sortDirection: 'DESCENDING',
    repeatOnTie: true,
    maximumAttempts: 2,
    ...input
  }
}

function binding(score: number): InitiativeFactBinding {
  return { automatic: true, facts: { score } }
}

function entity(id: string, value: InitiativeFactBinding = binding(0)): InitiativeScoreBatchEntity {
  return { kind: 'ACTOR', id, binding: value }
}

const entities = [entity(actorA), entity(actorB), entity(actorC), entity(actorD)]

function group(
  score: number,
  ids: readonly string[],
  classification: InitiativeScoreOrderGroup['classification'] = ids.length > 1 ? 'TIED' : 'SETTLED'
): InitiativeScoreOrderGroup {
  return { score, classification, members: ids.map((id) => ({ kind: 'ACTOR', id })) }
}

function complete(score: number): ServerCompletedRuleExecutionDto {
  const outputs = { score, automatic: true }
  return {
    status: 'COMPLETE',
    outputs,
    evidence: {
      source: { definitionId, gameSystemId, definitionFamilyKey: 'rules-runtime-graph', checksum },
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

function startInput(input: {
  runtime: RulesRuntimeService
  scoreGroups: readonly InitiativeScoreOrderGroup[]
  entities?: readonly InitiativeScoreBatchEntity[]
  policyPin?: InitiativePolicyTieResolverPinDto
}) {
  return {
    runtime: input.runtime,
    occurrenceId,
    gameSystemId,
    graph,
    pin: input.policyPin ?? pin(),
    procedure: 'ACTOR_ROLL' as const,
    mode: 'ASSISTED' as const,
    entities: input.entities ?? entities,
    scoreGroups: input.scoreGroups
  }
}

describe('Encounter initiative tie resolution', () => {
  it('passes settled score groups through without executing the tie graph', async () => {
    const runtimeService = runtime([])
    await expect(
      startInitiativeTieResolution(
        startInput({
          runtime: runtimeService,
          scoreGroups: [group(20, [actorA]), group(10, [actorB])],
          entities: entities.slice(0, 2)
        })
      )
    ).resolves.toEqual({
      kind: 'COMPLETE',
      completedAttempts: [],
      segments: [
        { kind: 'SETTLED', score: 20, members: [{ kind: 'ACTOR', id: actorA }] },
        { kind: 'SETTLED', score: 10, members: [{ kind: 'ACTOR', id: actorB }] }
      ]
    })
    expect(runtimeService.executeResolved).not.toHaveBeenCalled()
  })

  it('settles one tied group using only its exact canonical subgroup', async () => {
    const runtimeService = runtime([complete(18), complete(4)])
    await expect(
      startInitiativeTieResolution(
        startInput({
          runtime: runtimeService,
          scoreGroups: [group(12, [actorA, actorB])],
          entities: entities.slice(0, 2)
        })
      )
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      segments: [
        { kind: 'SETTLED', score: 18, members: [{ id: actorA }] },
        { kind: 'SETTLED', score: 4, members: [{ id: actorB }] }
      ]
    })
    expect(runtimeService.executeResolved).toHaveBeenCalledTimes(2)
    const completed = await startInitiativeTieResolution(
      startInput({
        runtime: runtime([complete(18), complete(4)]),
        scoreGroups: [group(12, [actorA, actorB])],
        entities: entities.slice(0, 2)
      })
    )
    expect(completed).toMatchObject({
      kind: 'COMPLETE',
      completedAttempts: [
        {
          originalScore: 12,
          attemptOrdinal: 1,
          results: [{ entity: { id: actorA } }, { entity: { id: actorB } }]
        }
      ],
      segments: [
        { tieResults: [{ entity: { id: actorA } }] },
        { tieResults: [{ entity: { id: actorB } }] }
      ]
    })
  })

  it('retries only the still-tied residual subgroup', async () => {
    const runtimeService = runtime([
      complete(18),
      complete(10),
      complete(10),
      complete(7),
      complete(3)
    ])
    const tieEntities = [
      entity(actorA, binding(1)),
      entity(actorB, binding(2)),
      entity(actorC, binding(3))
    ]
    await expect(
      startInitiativeTieResolution(
        startInput({
          runtime: runtimeService,
          scoreGroups: [group(12, [actorA, actorB, actorC])],
          entities: tieEntities
        })
      )
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      segments: [
        { kind: 'SETTLED', score: 18, members: [{ id: actorA }] },
        { kind: 'SETTLED', score: 7, members: [{ id: actorB }] },
        { kind: 'SETTLED', score: 3, members: [{ id: actorC }] }
      ]
    })
    expect(runtimeService.executeResolved).toHaveBeenCalledTimes(5)
    expect(runtimeService.executeResolved).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ command: expect.objectContaining({ facts: { score: 2 } }) })
    )
    expect(runtimeService.executeResolved).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ command: expect.objectContaining({ facts: { score: 3 } }) })
    )
  })

  it('falls back to order choice after the tie attempt bound', async () => {
    const runtimeService = runtime([complete(8), complete(8), complete(6), complete(6)])
    await expect(
      startInitiativeTieResolution(
        startInput({
          runtime: runtimeService,
          scoreGroups: [group(12, [actorA, actorB])],
          entities: entities.slice(0, 2)
        })
      )
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      segments: [
        { kind: 'ORDER_CHOICE_REQUIRED', score: 6, members: [{ id: actorA }, { id: actorB }] }
      ]
    })
  })

  it('falls back to order choice without executing when tie facts are unavailable', async () => {
    const runtimeService = runtime([complete(4)])
    await expect(
      startInitiativeTieResolution(
        startInput({
          runtime: runtimeService,
          scoreGroups: [group(12, [actorA, actorB])],
          entities: [entity(actorA, { automatic: false }), entity(actorB)]
        })
      )
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      segments: [
        { kind: 'ORDER_CHOICE_REQUIRED', score: 12, members: [{ id: actorA }, { id: actorB }] }
      ]
    })
    expect(runtimeService.executeResolved).toHaveBeenCalledTimes(1)
  })

  it('allows pure Manual tie graphs but converts requested evidence to order choice', async () => {
    const requested = continuation('manual-roll')
    const runtimeService = runtime([{ status: 'PAUSED', continuation: requested }, complete(4)])
    await expect(
      startInitiativeTieResolution({
        ...startInput({
          runtime: runtimeService,
          scoreGroups: [group(12, [actorA, actorB])],
          entities: entities.slice(0, 2)
        }),
        mode: 'MANUAL'
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      segments: [
        { kind: 'ORDER_CHOICE_REQUIRED', score: 12, members: [{ id: actorA }, { id: actorB }] }
      ]
    })
    expect(runtimeService.resume).not.toHaveBeenCalled()
  })

  it('pauses and resumes a tie while retaining settled prefix and later original groups', async () => {
    const pending = continuation('tie-roll')
    const runtimeService = runtime([
      { status: 'PAUSED', continuation: pending },
      complete(9),
      complete(2)
    ])
    const started = await startInitiativeTieResolution(
      startInput({
        runtime: runtimeService,
        scoreGroups: [group(30, [actorA]), group(20, [actorB, actorC]), group(10, [actorD])]
      })
    )
    expect(started).toMatchObject({
      kind: 'PENDING',
      completedSegments: [{ kind: 'SETTLED', score: 30 }],
      currentOriginalGroup: { score: 20 },
      laterOriginalGroups: [{ score: 10 }]
    })
    if (started.kind !== 'PENDING') throw new Error('Expected a tie-resolution pause.')
    await expect(
      resumeInitiativeTieResolution({
        runtime: runtimeService,
        gameSystemId,
        graph,
        pin: pin(),
        procedure: 'ACTOR_ROLL',
        mode: 'ASSISTED',
        entities,
        pending: started,
        requestId: 'tie-roll',
        value: 11
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      segments: [
        { kind: 'SETTLED', score: 30, members: [{ id: actorA }] },
        { kind: 'SETTLED', score: 9, members: [{ id: actorB }] },
        { kind: 'SETTLED', score: 2, members: [{ id: actorC }] },
        { kind: 'SETTLED', score: 10, members: [{ id: actorD }] }
      ]
    })
  })

  it('rejects a reordered pending subgroup before resuming the graph', async () => {
    const pending = continuation('tie-roll')
    const runtimeService = runtime([{ status: 'PAUSED', continuation: pending }])
    const started = await startInitiativeTieResolution(
      startInput({
        runtime: runtimeService,
        scoreGroups: [group(20, [actorA, actorB])],
        entities: entities.slice(0, 2)
      })
    )
    if (started.kind !== 'PENDING') throw new Error('Expected a tie-resolution pause.')
    const tampered = {
      ...started,
      pendingScoreBatch: {
        ...started.pendingScoreBatch,
        current: started.pendingScoreBatch.remaining[0]!,
        remaining: [started.pendingScoreBatch.current]
      }
    }
    await expect(
      resumeInitiativeTieResolution({
        runtime: runtimeService,
        gameSystemId,
        graph,
        pin: pin(),
        procedure: 'ACTOR_ROLL',
        mode: 'ASSISTED',
        entities: entities.slice(0, 2),
        pending: tampered,
        requestId: 'tie-roll',
        value: 11
      })
    ).rejects.toThrow('reordered or tampered')
    expect(runtimeService.resume).not.toHaveBeenCalled()
  })

  it('rejects a pending subgroup with a dropped identity before resuming the graph', async () => {
    const pending = continuation('tie-roll')
    const runtimeService = runtime([{ status: 'PAUSED', continuation: pending }])
    const started = await startInitiativeTieResolution(
      startInput({
        runtime: runtimeService,
        scoreGroups: [group(20, [actorA, actorB])],
        entities: entities.slice(0, 2)
      })
    )
    if (started.kind !== 'PENDING') throw new Error('Expected a tie-resolution pause.')
    await expect(
      resumeInitiativeTieResolution({
        runtime: runtimeService,
        gameSystemId,
        graph,
        pin: pin(),
        procedure: 'ACTOR_ROLL',
        mode: 'ASSISTED',
        entities: entities.slice(0, 2),
        pending: {
          ...started,
          pendingScoreBatch: { ...started.pendingScoreBatch, remaining: [] }
        },
        requestId: 'tie-roll',
        value: 11
      })
    ).rejects.toThrow('unresolved subgroup')
    expect(runtimeService.resume).not.toHaveBeenCalled()
  })
})

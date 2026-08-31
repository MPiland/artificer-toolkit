import { describe, expect, it, vi } from 'vitest'

import type { InitiativePolicyGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { InitiativeFactBinding } from '../rules/initiativeFactAdapter.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  resumeInitiativeScoreBatch,
  startInitiativeScoreBatch,
  type InitiativeScoreBatchEntity
} from './encounterInitiativeScoreBatch.js'

const gameSystemId = '00000000-0000-4000-8000-000000000001'
const definitionId = '00000000-0000-4000-8000-000000000002'
const occurrenceId = '00000000-0000-4000-8000-000000000003'
const actorOneId = '00000000-0000-4000-8000-000000000004'
const actorTwoId = '00000000-0000-4000-8000-000000000005'
const actorThreeId = '00000000-0000-4000-8000-000000000006'
const checksum = 'a'.repeat(64)

const graph = {
  definitionId,
  contentSourceId: '00000000-0000-4000-8000-000000000007',
  definitionVersion: 1,
  definitionChecksum: checksum,
  contractVersion: 1,
  label: 'Initiative score',
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
} satisfies EncounterInitiativePolicySnapshotDto['evaluationGraph']

const pin: InitiativePolicyGraphPinDto = {
  definitionId,
  definitionVersion: 1,
  definitionChecksum: checksum,
  scoreOutput: 'score',
  sortDirection: 'DESCENDING',
  automaticOutput: 'automatic'
}

const available = (score: number): InitiativeFactBinding => ({
  automatic: true,
  facts: { score }
})

function entity(
  id: string,
  binding: InitiativeFactBinding = available(0)
): InitiativeScoreBatchEntity {
  return { kind: 'ACTOR', id, binding }
}

function complete(score: number, automatic = true): ServerCompletedRuleExecutionDto {
  const outputs = { score, automatic }
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
) {
  const next = vi.fn()
  for (const result of results) next.mockResolvedValueOnce(result)
  return {
    executeResolved: vi.fn(() => next()),
    resume: vi.fn(() => next())
  } as unknown as RulesRuntimeService
}

function startInput(
  runtimeService: RulesRuntimeService,
  entities: readonly InitiativeScoreBatchEntity[]
) {
  return {
    runtime: runtimeService,
    occurrenceId,
    gameSystemId,
    graph,
    pin,
    procedure: 'ACTOR_ROLL' as const,
    phase: 'PRIMARY' as const,
    mode: 'ASSISTED' as const,
    entities
  }
}

describe('Encounter initiative score batch', () => {
  it('executes canonical entities in order and retains complete graph evidence', async () => {
    const runtimeService = runtime([complete(18), complete(4)])
    await expect(
      startInitiativeScoreBatch(
        startInput(runtimeService, [
          entity(actorOneId, available(10)),
          entity(actorTwoId, available(20))
        ])
      )
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      completed: [
        {
          entity: { id: actorOneId },
          result: { kind: 'GRAPH_COMPLETE', execution: { score: 18 } }
        },
        { entity: { id: actorTwoId }, result: { kind: 'GRAPH_COMPLETE', execution: { score: 4 } } }
      ]
    })
    expect(runtimeService.executeResolved).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        command: expect.objectContaining({ occurrenceId, facts: { score: 10 } })
      })
    )
    expect(runtimeService.executeResolved).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: expect.objectContaining({ occurrenceId, facts: { score: 20 } })
      })
    )
  })

  it('rejects duplicate entity identities before any runtime execution', async () => {
    const runtimeService = runtime([])
    await expect(
      startInitiativeScoreBatch(
        startInput(runtimeService, [entity(actorOneId), entity(actorOneId)])
      )
    ).rejects.toThrow('unique identities')
    expect(runtimeService.executeResolved).not.toHaveBeenCalled()
  })

  it('rejects noncanonical order and a cohort kind that does not match its procedure', async () => {
    const runtimeService = runtime([])
    await expect(
      startInitiativeScoreBatch(
        startInput(runtimeService, [entity(actorTwoId), entity(actorOneId)])
      )
    ).rejects.toThrow('canonical order')
    await expect(
      startInitiativeScoreBatch({
        ...startInput(runtimeService, [{ ...entity(actorOneId), kind: 'SIDE' }]),
        procedure: 'ACTOR_ROLL'
      })
    ).rejects.toThrow('does not match')
    expect(runtimeService.executeResolved).not.toHaveBeenCalled()
  })

  it('rejects a batch beyond the shared Encounter collection bound', async () => {
    const runtimeService = runtime([])
    const entities = Array.from({ length: 101 }, (_, index) =>
      entity(`00000000-0000-4000-8000-${(index + 1).toString().padStart(12, '0')}`)
    )
    await expect(startInitiativeScoreBatch(startInput(runtimeService, entities))).rejects.toThrow(
      'between 1 and 100'
    )
    expect(runtimeService.executeResolved).not.toHaveBeenCalled()
  })

  it('retains an unavailable source without invoking the runtime', async () => {
    const runtimeService = runtime([])
    await expect(
      startInitiativeScoreBatch(
        startInput(runtimeService, [entity(actorOneId, { automatic: false })])
      )
    ).resolves.toEqual({
      kind: 'COMPLETE',
      completed: [
        { entity: { kind: 'ACTOR', id: actorOneId }, result: { kind: 'FACTS_UNAVAILABLE' } }
      ]
    })
    expect(runtimeService.executeResolved).not.toHaveBeenCalled()
  })

  it('retains a completed graph result with no score when the graph disables automatic ordering', async () => {
    await expect(
      startInitiativeScoreBatch(startInput(runtime([complete(0, false)]), [entity(actorOneId)]))
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      completed: [
        { result: { kind: 'GRAPH_COMPLETE', execution: { automatic: false, score: null } } }
      ]
    })
  })

  it('pauses and resumes the current entity before deterministically progressing to later entities', async () => {
    const pending = continuation('first-roll')
    const runtimeService = runtime([
      { status: 'PAUSED', continuation: pending },
      complete(14),
      complete(7)
    ])
    const started = await startInitiativeScoreBatch(
      startInput(runtimeService, [entity(actorOneId), entity(actorTwoId)])
    )
    expect(started).toMatchObject({
      kind: 'PENDING',
      current: { id: actorOneId },
      remaining: [{ id: actorTwoId }]
    })
    if (started.kind !== 'PENDING') throw new Error('Expected an initiative pause.')
    await expect(
      resumeInitiativeScoreBatch({
        runtime: runtimeService,
        graph,
        pin,
        procedure: 'ACTOR_ROLL',
        phase: 'PRIMARY',
        mode: 'ASSISTED',
        batch: started,
        requestId: 'first-roll',
        value: 12
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      completed: [
        {
          entity: { id: actorOneId },
          result: { kind: 'GRAPH_COMPLETE', execution: { score: 14 } }
        },
        { entity: { id: actorTwoId }, result: { kind: 'GRAPH_COMPLETE', execution: { score: 7 } } }
      ]
    })
  })

  it('retains one exact current continuation across subsequent assisted pauses', async () => {
    const first = continuation('first-roll')
    const second = continuation('second-roll')
    const runtimeService = runtime([
      { status: 'PAUSED', continuation: first },
      { status: 'PAUSED', continuation: second },
      complete(10)
    ])
    const started = await startInitiativeScoreBatch(
      startInput(runtimeService, [entity(actorOneId)])
    )
    if (started.kind !== 'PENDING') throw new Error('Expected the first initiative pause.')

    const pausedAgain = await resumeInitiativeScoreBatch({
      runtime: runtimeService,
      graph,
      pin,
      procedure: 'ACTOR_ROLL',
      phase: 'PRIMARY',
      mode: 'ASSISTED',
      batch: started,
      requestId: 'first-roll',
      value: 5
    })
    expect(pausedAgain).toMatchObject({
      kind: 'PENDING',
      completed: [],
      current: { id: actorOneId },
      continuation: { request: { requestId: 'second-roll' } }
    })
    if (pausedAgain.kind !== 'PENDING') throw new Error('Expected the second initiative pause.')

    await expect(
      resumeInitiativeScoreBatch({
        runtime: runtimeService,
        graph,
        pin,
        procedure: 'ACTOR_ROLL',
        phase: 'PRIMARY',
        mode: 'ASSISTED',
        batch: pausedAgain,
        requestId: 'second-roll',
        value: 9
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      completed: [{ result: { kind: 'GRAPH_COMPLETE', execution: { score: 10 } } }]
    })
  })

  it('uses trusted automatic integer evidence and validates its issued range', async () => {
    const pending = continuation('roll')
    const runtimeService = runtime([{ status: 'PAUSED', continuation: pending }, complete(16)])
    await expect(
      startInitiativeScoreBatch({
        ...startInput(runtimeService, [entity(actorOneId)]),
        mode: 'AUTOMATIC',
        integerSource: () => 9
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      completed: [{ result: { kind: 'GRAPH_COMPLETE' } }]
    })
    expect(runtimeService.resume).toHaveBeenCalledWith(
      expect.objectContaining({ response: { requestId: 'roll', value: 9 } })
    )

    const invalidRuntime = runtime([{ status: 'PAUSED', continuation: pending }])
    await expect(
      startInitiativeScoreBatch({
        ...startInput(invalidRuntime, [entity(actorTwoId)]),
        mode: 'AUTOMATIC',
        integerSource: () => 21
      })
    ).rejects.toThrow('outside the issued range')
    expect(invalidRuntime.resume).not.toHaveBeenCalled()
  })

  it('fails closed instead of rolling when ACTOR_SCORE requests evidence', async () => {
    const runtimeService = runtime([{ status: 'PAUSED', continuation: continuation('score-roll') }])
    await expect(
      startInitiativeScoreBatch({
        ...startInput(runtimeService, [entity(actorThreeId)]),
        procedure: 'ACTOR_SCORE'
      })
    ).resolves.toEqual({
      kind: 'COMPLETE',
      completed: [
        {
          entity: { kind: 'ACTOR', id: actorThreeId },
          result: { kind: 'EVIDENCE_NOT_ALLOWED' }
        }
      ]
    })
    expect(runtimeService.resume).not.toHaveBeenCalled()
  })

  it('permits the separately pinned tie resolver to request evidence for ACTOR_SCORE', async () => {
    const pending = continuation('score-tie-roll')
    const runtimeService = runtime([{ status: 'PAUSED', continuation: pending }, complete(11)])
    const started = await startInitiativeScoreBatch({
      ...startInput(runtimeService, [entity(actorThreeId)]),
      procedure: 'ACTOR_SCORE',
      phase: 'TIE_RESOLUTION'
    })
    expect(started).toMatchObject({ kind: 'PENDING', current: { id: actorThreeId } })
    if (started.kind !== 'PENDING') throw new Error('Expected a tie-resolution pause.')
    await expect(
      resumeInitiativeScoreBatch({
        runtime: runtimeService,
        graph,
        pin,
        procedure: 'ACTOR_SCORE',
        phase: 'TIE_RESOLUTION',
        mode: 'ASSISTED',
        batch: started,
        requestId: 'score-tie-roll',
        value: 8
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      completed: [{ result: { kind: 'GRAPH_COMPLETE', execution: { score: 11 } } }]
    })
  })

  it('does not generate or expose initiative evidence in Manual mode', async () => {
    const runtimeService = runtime([
      { status: 'PAUSED', continuation: continuation('manual-roll') }
    ])
    await expect(
      startInitiativeScoreBatch({
        ...startInput(runtimeService, [entity(actorOneId)]),
        mode: 'MANUAL'
      })
    ).resolves.toEqual({
      kind: 'COMPLETE',
      completed: [
        {
          entity: { kind: 'ACTOR', id: actorOneId },
          result: { kind: 'EVIDENCE_NOT_ALLOWED' }
        }
      ]
    })
    expect(runtimeService.resume).not.toHaveBeenCalled()
  })
})

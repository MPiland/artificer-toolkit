import { describe, expect, it, vi } from 'vitest'

import type { InitiativePolicyOrderChoiceGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  resumeInitiativeOrderResolution,
  startInitiativeOrderResolution
} from './encounterInitiativeOrderResolution.js'
import type { InitiativeTieResolutionSegment } from './encounterInitiativeTieResolution.js'

const gameSystemId = '00000000-0000-4000-8000-000000000001'
const definitionId = '00000000-0000-4000-8000-000000000002'
const occurrenceId = '00000000-0000-4000-8000-000000000003'
const actorA = '00000000-0000-4000-8000-000000000004'
const actorB = '00000000-0000-4000-8000-000000000005'
const actorC = '00000000-0000-4000-8000-000000000006'
const checksum = 'a'.repeat(64)

const graph = {
  definitionId,
  contentSourceId: '00000000-0000-4000-8000-000000000007',
  definitionVersion: 1,
  definitionChecksum: checksum,
  contractVersion: 1,
  label: 'Order choice',
  document: {
    schemaVersion: 1 as const,
    id: definitionId,
    gameSystemId,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'choose',
        operation: { key: 'initiative.resolve', contractVersion: 1 },
        inputs: { minimum: { kind: 'FACT' as const, factKey: 'choice.min' } }
      }
    ],
    outputs: {
      selection: { kind: 'NODE_OUTPUT' as const, nodeId: 'choose', port: 'selection' }
    }
  }
} satisfies EncounterInitiativePolicySnapshotDto['orderChoiceGraph']

const pin: InitiativePolicyOrderChoiceGraphPinDto = {
  definitionId,
  definitionVersion: 1,
  definitionChecksum: checksum,
  selectionOutput: 'selection',
  minimumIndexFact: 'choice.min',
  maximumIndexFact: 'choice.max'
}

function complete(selection: number): ServerCompletedRuleExecutionDto {
  return {
    status: 'COMPLETE',
    outputs: { selection },
    evidence: {
      source: {
        definitionId,
        gameSystemId,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: { selection }
    }
  }
}

function continuation(requestId: string, max: number): ServerRuleExecutionContinuationDto {
  return {
    schemaVersion: 1,
    occurrenceId,
    graph: {
      source: {
        definitionId,
        gameSystemId,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum
      }
    } as ServerRuleExecutionContinuationDto['graph'],
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: {
      requestId,
      kind: 'INTEGER_RANGE',
      nodeId: 'choose',
      ordinal: 0,
      min: 0,
      max
    },
    authority: 'APPLICATION_SERVICE',
    redaction: 'SERVER_ONLY',
    seal: 'b'.repeat(64)
  }
}

function runtime(
  executions: readonly (
    | ServerCompletedRuleExecutionDto
    | { status: 'PAUSED'; continuation: ServerRuleExecutionContinuationDto }
  )[]
): RulesRuntimeService {
  const next = vi.fn()
  for (const execution of executions) next.mockResolvedValueOnce(execution)
  return {
    executeResolved: vi.fn(() => next()),
    resume: vi.fn(() => next())
  } as unknown as RulesRuntimeService
}

const entities = [actorA, actorB, actorC].map((id) => ({ kind: 'ACTOR' as const, id }))

function choice(ids: readonly string[]): InitiativeTieResolutionSegment {
  return {
    kind: 'ORDER_CHOICE_REQUIRED',
    score: 10,
    members: ids.map((id) => ({ kind: 'ACTOR', id }))
  }
}

describe('Encounter initiative order resolution', () => {
  it('passes settled segments through and repeatedly applies pure bounded selections', async () => {
    await expect(
      startInitiativeOrderResolution({
        runtime: runtime([complete(1), complete(0)]),
        occurrenceId,
        gameSystemId,
        graph,
        pin,
        entities,
        segments: [choice([actorA, actorB, actorC])]
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      orderedEntities: [
        { kind: 'ACTOR', id: actorB },
        { kind: 'ACTOR', id: actorA },
        { kind: 'ACTOR', id: actorC }
      ],
      tieResults: [],
      choices: [
        { selectedEntity: { kind: 'ACTOR', id: actorB } },
        { selectedEntity: { kind: 'ACTOR', id: actorA } }
      ]
    })
  })

  it('pauses and resumes by exact entity identity before continuing later choices', async () => {
    const first = continuation('choose-first', 2)
    const second = continuation('choose-second', 1)
    const runtimeService = runtime([
      { status: 'PAUSED', continuation: first },
      complete(2),
      { status: 'PAUSED', continuation: second },
      complete(0)
    ])
    const started = await startInitiativeOrderResolution({
      runtime: runtimeService,
      occurrenceId,
      gameSystemId,
      graph,
      pin,
      entities,
      segments: [choice([actorA, actorB, actorC])]
    })
    if (started.kind !== 'PENDING') throw new Error('Expected a pending order choice.')
    const resumed = await resumeInitiativeOrderResolution({
      runtime: runtimeService,
      gameSystemId,
      graph,
      pin,
      entities,
      pending: started,
      requestId: 'choose-first',
      selectedEntityId: actorC
    })
    expect(resumed).toMatchObject({
      kind: 'PENDING',
      selectedFromCurrent: [{ id: actorC }],
      remainingCurrent: [{ id: actorA }, { id: actorB }]
    })
    if (resumed.kind !== 'PENDING') throw new Error('Expected the second pending choice.')
    await expect(
      resumeInitiativeOrderResolution({
        runtime: runtimeService,
        gameSystemId,
        graph,
        pin,
        entities,
        pending: resumed,
        requestId: 'choose-second',
        selectedEntityId: actorA
      })
    ).resolves.toMatchObject({
      kind: 'COMPLETE',
      orderedEntities: [{ id: actorC }, { id: actorA }, { id: actorB }]
    })
  })

  it('rejects an identity outside the exact remaining choice before runtime resume', async () => {
    const pending = continuation('choose-first', 1)
    const runtimeService = runtime([{ status: 'PAUSED', continuation: pending }])
    const started = await startInitiativeOrderResolution({
      runtime: runtimeService,
      occurrenceId,
      gameSystemId,
      graph,
      pin,
      entities: entities.slice(0, 2),
      segments: [choice([actorA, actorB])]
    })
    if (started.kind !== 'PENDING') throw new Error('Expected a pending order choice.')
    await expect(
      resumeInitiativeOrderResolution({
        runtime: runtimeService,
        gameSystemId,
        graph,
        pin,
        entities: entities.slice(0, 2),
        pending: started,
        requestId: 'choose-first',
        selectedEntityId: actorC
      })
    ).rejects.toThrow('exact remaining entities')
    expect(runtimeService.resume).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'

import type { InitiativePolicyOrderChoiceGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  resumeInitiativeOrderChoice,
  startInitiativeOrderChoice
} from './encounterInitiativeOrderChoiceExecution.js'

const gameSystemId = '00000000-0000-4000-8000-000000000001'
const definitionId = '00000000-0000-4000-8000-000000000002'
const occurrenceId = '00000000-0000-4000-8000-000000000003'
const checksum = 'a'.repeat(64)

const graph = {
  definitionId,
  contentSourceId: '00000000-0000-4000-8000-000000000004',
  definitionVersion: 1,
  definitionChecksum: checksum,
  contractVersion: 1,
  label: 'Initiative order choice',
  document: {
    schemaVersion: 1 as const,
    id: definitionId,
    gameSystemId,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'choose',
        operation: { key: 'initiative.resolve', contractVersion: 1 },
        inputs: { minimum: { kind: 'FACT' as const, factKey: 'choice.minimum' } }
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
  minimumIndexFact: 'choice.minimum',
  maximumIndexFact: 'choice.maximum'
}

function complete(outputs: Record<string, number>): ServerCompletedRuleExecutionDto {
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

function continuation(requestId = 'choice-request'): ServerRuleExecutionContinuationDto {
  return {
    schemaVersion: 1,
    occurrenceId,
    graph: {
      source: { definitionId, checksum }
    } as unknown as ServerRuleExecutionContinuationDto['graph'],
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: { requestId, kind: 'INTEGER_RANGE', nodeId: 'choose', ordinal: 0, min: 0, max: 2 },
    authority: 'APPLICATION_SERVICE',
    redaction: 'SERVER_ONLY',
    seal: 'b'.repeat(64)
  }
}

function runtime(
  result:
    | ServerCompletedRuleExecutionDto
    | { status: 'PAUSED'; continuation: ServerRuleExecutionContinuationDto }
) {
  return {
    executeResolved: vi.fn().mockResolvedValue(result),
    resume: vi.fn().mockResolvedValue(result)
  } as unknown as RulesRuntimeService
}

const base = {
  occurrenceId,
  gameSystemId,
  graph,
  pin,
  minimumIndex: 0,
  maximumIndex: 2
}

describe('Encounter initiative order-choice execution', () => {
  it('supplies exact bounds and returns the named integer selection', async () => {
    const service = runtime(complete({ selection: 1 }))
    await expect(startInitiativeOrderChoice({ runtime: service, ...base })).resolves.toMatchObject({
      kind: 'COMPLETE',
      selection: 1
    })
    expect(service.executeResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          facts: { 'choice.minimum': 0, 'choice.maximum': 2 }
        })
      })
    )
  })

  it('retains one exact bounded pause and resumes it', async () => {
    const paused = runtime({ status: 'PAUSED', continuation: continuation() })
    await expect(startInitiativeOrderChoice({ runtime: paused, ...base })).resolves.toMatchObject({
      kind: 'PENDING'
    })
    const settled = runtime(complete({ selection: 2 }))
    await expect(
      resumeInitiativeOrderChoice({
        runtime: settled,
        continuation: continuation(),
        requestId: 'choice-request',
        value: 2,
        pin,
        minimumIndex: 0,
        maximumIndex: 2
      })
    ).resolves.toMatchObject({ kind: 'COMPLETE', selection: 2 })
  })

  it('rejects forged bounds, request identity, output, and a second pause', async () => {
    const service = runtime(complete({ selection: 4 }))
    await expect(startInitiativeOrderChoice({ runtime: service, ...base })).rejects.toThrow(
      'within the issued range'
    )
    await expect(
      resumeInitiativeOrderChoice({
        runtime: runtime(complete({ selection: 1 })),
        continuation: continuation(),
        requestId: 'wrong',
        value: 1,
        pin,
        minimumIndex: 0,
        maximumIndex: 2
      })
    ).rejects.toThrow('does not match')
    await expect(
      resumeInitiativeOrderChoice({
        runtime: runtime({ status: 'PAUSED', continuation: continuation('next') }),
        continuation: continuation(),
        requestId: 'choice-request',
        value: 1,
        pin,
        minimumIndex: 0,
        maximumIndex: 2
      })
    ).rejects.toThrow('additional pause')
  })

  it('rejects incompatible graph pins and invalid request ranges before runtime calls', async () => {
    const service = runtime(complete({ selection: 1 }))
    await expect(
      startInitiativeOrderChoice({
        runtime: service,
        ...base,
        pin: { ...pin, definitionVersion: 2 }
      })
    ).rejects.toThrow('exact policy pin')
    await expect(
      resumeInitiativeOrderChoice({
        runtime: service,
        continuation: { ...continuation(), request: { ...continuation().request, max: 3 } },
        requestId: 'choice-request',
        value: 1,
        pin,
        minimumIndex: 0,
        maximumIndex: 2
      })
    ).rejects.toThrow('exact bounded range')
    expect(service.executeResolved).not.toHaveBeenCalled()
  })
})

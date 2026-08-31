import { describe, expect, it, vi } from 'vitest'

import type { InitiativePolicyGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  compareInitiativeScores,
  initiativePublishedGraph,
  resumeInitiativeScoreGraph,
  startInitiativeScoreGraph
} from './encounterInitiativeGraphExecution.js'

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

function complete(outputs: Record<string, boolean | number>): ServerCompletedRuleExecutionDto {
  return {
    status: 'COMPLETE',
    outputs,
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
      outputs
    }
  }
}

function runtime(result: Awaited<ReturnType<RulesRuntimeService['executeResolved']>>) {
  return {
    executeResolved: vi.fn().mockResolvedValue(result),
    resume: vi.fn().mockResolvedValue(result)
  } as unknown as RulesRuntimeService
}

describe('Encounter initiative graph execution', () => {
  it('reconstructs the exact published envelope from the frozen Encounter snapshot', () => {
    expect(initiativePublishedGraph({ gameSystemId, graph })).toMatchObject({
      id: definitionId,
      gameSystemId,
      checksum,
      definition: graph.document
    })
  })

  it('extracts an automatic numeric score through the exact named outputs', async () => {
    const result = await startInitiativeScoreGraph({
      runtime: runtime(complete({ score: 17, automatic: true })),
      occurrenceId,
      gameSystemId,
      graph,
      pin,
      facts: { modifier: 4 }
    })
    expect(result).toMatchObject({
      kind: 'COMPLETE',
      result: { automatic: true, score: 17, sortDirection: 'DESCENDING' }
    })
  })

  it('does not expose a placeholder score when automatic ordering is unavailable', async () => {
    const result = await startInitiativeScoreGraph({
      runtime: runtime(complete({ score: 0, automatic: false })),
      occurrenceId,
      gameSystemId,
      graph,
      pin,
      facts: {}
    })
    expect(result).toMatchObject({
      kind: 'COMPLETE',
      result: { automatic: false, score: null }
    })
  })

  it('retains a paused exact graph and resumes its named result', async () => {
    const continuation = {
      schemaVersion: 1 as const,
      occurrenceId,
      graph: {} as ServerRuleExecutionContinuationDto['graph'],
      facts: {},
      nextNodeIndex: 0,
      nodeOutputs: {},
      trace: [],
      request: {
        requestId: 'initiative-roll',
        kind: 'INTEGER_RANGE' as const,
        nodeId: 'roll',
        ordinal: 0,
        min: 1,
        max: 20
      },
      authority: 'APPLICATION_SERVICE' as const,
      redaction: 'SERVER_ONLY' as const,
      seal: 'b'.repeat(64)
    } satisfies ServerRuleExecutionContinuationDto
    const pendingRuntime = runtime({ status: 'PAUSED', continuation })
    await expect(
      startInitiativeScoreGraph({
        runtime: pendingRuntime,
        occurrenceId,
        gameSystemId,
        graph,
        pin,
        facts: {}
      })
    ).resolves.toEqual({ kind: 'PENDING', continuation })

    const settledRuntime = runtime(complete({ score: 12, automatic: true }))
    await expect(
      resumeInitiativeScoreGraph({
        runtime: settledRuntime,
        continuation,
        requestId: 'initiative-roll',
        value: 8,
        pin
      })
    ).resolves.toMatchObject({ kind: 'COMPLETE', result: { score: 12 } })
  })

  it('orders scores only under one explicit policy direction', () => {
    const high = {
      automatic: true as const,
      score: 18,
      sortDirection: 'DESCENDING' as const,
      execution: complete({})
    }
    const low = {
      automatic: true as const,
      score: 4,
      sortDirection: 'DESCENDING' as const,
      execution: complete({})
    }
    expect(compareInitiativeScores(high, low)).toBeLessThan(0)
    expect(
      compareInitiativeScores(
        { ...low, sortDirection: 'ASCENDING' },
        { ...high, sortDirection: 'ASCENDING' }
      )
    ).toBeLessThan(0)
  })
})

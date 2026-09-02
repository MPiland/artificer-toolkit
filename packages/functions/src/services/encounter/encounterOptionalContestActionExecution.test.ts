import { describe, expect, it, vi } from 'vitest'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { createDnd5eOptionalCombatContestGraph } from '../rules/systems/dnd5e/optionalCombatContestGraph.js'
import { executeEncounterOptionalContestAction } from './encounterOptionalContestActionExecution.js'

const graph = createDnd5eOptionalCombatContestGraph({
  definitionId: '00000000-0000-4000-8000-0000000000f6',
  definitionVersion: 1,
  definitionChecksum: 'a'.repeat(64),
  moduleKey: 'd20.action.disarm',
  moduleContractVersion: 1
})

const initiator = {
  actorId: '00000000-0000-4000-8000-0000000000a1',
  requestNodeId: 'initiator_d20' as const,
  rollMode: 'NORMAL' as const,
  contributors: [],
  contributorChecksum: 'e'.repeat(64),
  modifier: 4
}
const defender = {
  actorId: '00000000-0000-4000-8000-0000000000a2',
  requestNodeId: 'target_d20' as const,
  rollMode: 'NORMAL' as const,
  contributors: [],
  contributorChecksum: 'e'.repeat(64),
  modifier: 2
}
const occurrenceId = '00000000-0000-4000-8000-0000000000c1'

function pending(nodeId: 'initiator_d20' | 'target_d20', requestId: string) {
  return {
    status: 'PAUSED' as const,
    continuation: {
      occurrenceId,
      request: { kind: 'INTEGER_RANGE' as const, nodeId, requestId, min: 1, max: 20 }
    }
  }
}

function runtime(): RulesRuntimeService {
  return {
    execute: vi.fn(),
    executeFrozen: vi.fn(),
    executeResolved: vi.fn().mockResolvedValue(pending('initiator_d20', 'request-a')),
    resume: vi
      .fn()
      .mockResolvedValueOnce(pending('target_d20', 'request-b'))
      .mockResolvedValueOnce({
        status: 'COMPLETE',
        outputs: {
          initiatorNaturalD20: 16,
          initiatorTotal: 20,
          targetNaturalD20: 11,
          targetTotal: 13
        }
      })
  } as unknown as RulesRuntimeService
}

describe('executeEncounterOptionalContestAction', () => {
  it('automatically resolves both bounded requests in graph order', async () => {
    const service = runtime()
    const result = await executeEncounterOptionalContestAction({
      runtime: service,
      graph,
      occurrenceId,
      automationMode: 'AUTOMATIC',
      initiator,
      defender,
      rollD20: vi.fn().mockReturnValueOnce(16).mockReturnValueOnce(11)
    })
    expect(result).toMatchObject({
      kind: 'COMPLETE',
      initiator: { total: 20, rawFaces: [16] },
      defender: { total: 13, rawFaces: [11] }
    })
    expect(service.resume).toHaveBeenCalledTimes(2)
  })

  it('pauses assisted execution and resumes exactly the issued request', async () => {
    const service = runtime()
    const first = await executeEncounterOptionalContestAction({
      runtime: service,
      graph,
      occurrenceId,
      automationMode: 'ASSISTED',
      initiator,
      defender
    })
    expect(first).toMatchObject({ kind: 'PENDING', participant: 'INITIATOR' })
    if (first.kind !== 'PENDING') throw new Error('Expected pending contest.')
    const second = await executeEncounterOptionalContestAction({
      runtime: service,
      graph,
      occurrenceId,
      automationMode: 'ASSISTED',
      initiator,
      defender,
      continuation: first.continuation,
      resolution: { kind: 'ENTER_DICE', requestId: 'request-a', rawFaces: [16] },
      priorRolls: new Map([['INITIATOR', [16]]])
    })
    expect(second).toMatchObject({ kind: 'PENDING', participant: 'DEFENDER' })
  })
})

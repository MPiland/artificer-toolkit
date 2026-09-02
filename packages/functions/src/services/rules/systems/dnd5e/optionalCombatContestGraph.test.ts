import { describe, expect, it } from 'vitest'

import {
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  executeRuleGraph,
  resumeRuleGraph,
  type GameSystemRuleCapabilityContract
} from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  createDnd5eOptionalCombatContestGraph,
  dnd5eOptionalCombatContestCapabilityContribution,
  DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY,
  DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY,
  type Dnd5eOptionalCombatContestPolicyPin
} from './optionalCombatContestGraph.js'

const PIN: Dnd5eOptionalCombatContestPolicyPin = {
  definitionId: '00000000-0000-4000-8000-0000000000f6',
  definitionVersion: 1,
  definitionChecksum: 'a'.repeat(64),
  moduleKey: 'd20.action.disarm',
  moduleContractVersion: 1
}

function capability(): GameSystemRuleCapabilityContract {
  return {
    gameSystemId: DND5E_SYSTEM_ID,
    contractVersion: 1,
    authoredRootKinds: [],
    ...dnd5eOptionalCombatContestCapabilityContribution
  }
}

function compiled(pin = PIN) {
  const graph = createDnd5eOptionalCombatContestGraph(pin)
  const result = compileRuleGraph({
    definition: graph.published.definition,
    sourceChecksum: graph.published.checksum,
    capability: capability(),
    operations: createRuleOperationRegistry(coreRuleOperations)
  })
  if (!result.ok)
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join('\n'))
  return { graph, compiled: result.value }
}

describe('D&D optional-combat contest graph', () => {
  it('issues initiator then target d20 requests and totals both server-supplied modifiers', () => {
    const result = compiled()
    const started = executeRuleGraph({
      graph: result.compiled,
      occurrenceId: '00000000-0000-4000-8000-0000000000c1',
      facts: {
        [DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY]: 5,
        [DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY]: 2
      },
      operations: createRuleOperationRegistry(coreRuleOperations)
    })
    expect(started).toMatchObject({
      status: 'PAUSED',
      continuation: {
        request: { kind: 'INTEGER_RANGE', nodeId: 'initiator_d20', ordinal: 0, min: 1, max: 20 }
      }
    })
    if (started.status !== 'PAUSED') throw new Error('Expected an evidence request.')

    const targetPending = resumeRuleGraph({
      continuation: started.continuation,
      response: { requestId: started.continuation.request.requestId, value: 14 },
      operations: createRuleOperationRegistry(coreRuleOperations)
    })
    expect(targetPending).toMatchObject({
      status: 'PAUSED',
      continuation: {
        request: { kind: 'INTEGER_RANGE', nodeId: 'target_d20', ordinal: 2, min: 1, max: 20 }
      }
    })
    if (targetPending.status !== 'PAUSED') throw new Error('Expected a target evidence request.')

    const completed = resumeRuleGraph({
      continuation: targetPending.continuation,
      response: { requestId: targetPending.continuation.request.requestId, value: 11 },
      operations: createRuleOperationRegistry(coreRuleOperations)
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      outputs: {
        initiatorNaturalD20: 14,
        initiatorTotal: 19,
        targetNaturalD20: 11,
        targetTotal: 13
      }
    })
  })

  it('retains deterministic pin identity and changes it for a different exact pin', () => {
    const first = createDnd5eOptionalCombatContestGraph(PIN)
    const second = createDnd5eOptionalCombatContestGraph(PIN)
    const revised = createDnd5eOptionalCombatContestGraph({ ...PIN, definitionVersion: 2 })
    expect(second).toEqual(first)
    expect(revised.identityChecksum).not.toBe(first.identityChecksum)
    expect(revised.pin).toEqual({ ...PIN, definitionVersion: 2 })
  })

  it.each([
    [{ ...PIN, definitionId: 'invalid' }],
    [{ ...PIN, definitionChecksum: 'A'.repeat(64) }],
    [{ ...PIN, definitionVersion: 0 }],
    [{ ...PIN, moduleKey: 'Invalid key' }],
    [{ ...PIN, moduleContractVersion: 0 }]
  ])('rejects an invalid exact policy pin', (pin) => {
    expect(() => createDnd5eOptionalCombatContestGraph(pin)).toThrow()
  })
})

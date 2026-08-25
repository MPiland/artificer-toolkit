import { describe, expect, it } from 'vitest'

import {
  addNumbersRuleOperation,
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  executeRuleGraph,
  resumeRuleGraph,
  type GameSystemCapabilityContract,
  type RuleGraphDefinition
} from '../domains/rules/index.js'

const SYSTEM_ID = '11111111-1111-4111-8111-111111111111'
const DEFINITION_ID = '22222222-2222-4222-8222-222222222222'
const CHECKSUM = 'a'.repeat(64)
const OCCURRENCE_ID = '44444444-4444-4444-8444-444444444444'

const capability: GameSystemCapabilityContract = {
  gameSystemId: SYSTEM_ID,
  contractVersion: 1,
  authoredRootKinds: ['action'],
  definitionFamilyKeys: ['test-resolution'],
  factContracts: [
    { key: 'actor.base', valueKind: 'NUMBER' },
    { key: 'test.threshold', valueKind: 'NUMBER' },
    { key: 'private.unused', valueKind: 'BOOLEAN' }
  ],
  operationContracts: coreRuleOperations.map(({ key, contractVersion }) => ({
    key,
    contractVersion
  }))
}

function evidenceDefinition(): RuleGraphDefinition {
  return {
    ...thresholdDefinition(),
    nodes: [
      thresholdDefinition().nodes[0]!,
      {
        id: 'roll',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'with_first_roll',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'total', port: 'value' },
          right: { kind: 'NODE_OUTPUT', nodeId: 'roll', port: 'value' }
        }
      },
      {
        id: 'second_roll',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 6 } }
      },
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'with_first_roll', port: 'value' },
          right: { kind: 'NODE_OUTPUT', nodeId: 'second_roll', port: 'value' }
        }
      }
    ],
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
  }
}

function thresholdDefinition(): RuleGraphDefinition {
  return {
    schemaVersion: 1,
    id: DEFINITION_ID,
    gameSystemId: SYSTEM_ID,
    definitionFamilyKey: 'test-resolution',
    nodes: [
      {
        id: 'total',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'FACT', factKey: 'actor.base' },
          right: { kind: 'LITERAL', value: 2 }
        }
      },
      {
        id: 'threshold',
        operation: { key: 'number.compare-threshold', contractVersion: 1 },
        inputs: {
          value: { kind: 'NODE_OUTPUT', nodeId: 'total', port: 'value' },
          threshold: { kind: 'FACT', factKey: 'test.threshold' }
        }
      }
    ],
    outputs: {
      passed: { kind: 'NODE_OUTPUT', nodeId: 'threshold', port: 'passed' },
      margin: { kind: 'NODE_OUTPUT', nodeId: 'threshold', port: 'margin' }
    }
  }
}

describe('shared rules runtime', () => {
  it('compiles and executes a neutral threshold graph from runtime facts', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const compiled = compileRuleGraph({
      definition: thresholdDefinition(),
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })

    expect(compiled.ok).toBe(true)
    if (!compiled.ok) throw new Error('Expected rule graph compilation to succeed.')

    const result = executeRuleGraph({
      graph: compiled.value,
      occurrenceId: OCCURRENCE_ID,
      facts: { 'actor.base': 12, 'test.threshold': 13, 'private.unused': true },
      operations
    })

    expect(result.status).toBe('COMPLETE')
    if (result.status !== 'COMPLETE') throw new Error('Expected a completed rule execution.')

    expect(result.outputs).toEqual({ passed: true, margin: 1 })
    expect(result.evidence).toEqual({
      source: {
        definitionId: DEFINITION_ID,
        gameSystemId: SYSTEM_ID,
        definitionFamilyKey: 'test-resolution',
        checksum: CHECKSUM
      },
      capabilityContractVersion: 1,
      facts: { 'actor.base': 12, 'test.threshold': 13 },
      trace: [
        {
          nodeId: 'total',
          operation: { key: 'number.add', contractVersion: 1 },
          inputs: { left: 12, right: 2 },
          outputs: { value: 14 }
        },
        {
          nodeId: 'threshold',
          operation: { key: 'number.compare-threshold', contractVersion: 1 },
          inputs: { value: 14, threshold: 13 },
          outputs: { passed: true, margin: 1 }
        }
      ],
      outputs: { passed: true, margin: 1 }
    })
  })

  it('rejects an operation not declared by the Game System', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const compiled = compileRuleGraph({
      definition: thresholdDefinition(),
      sourceChecksum: CHECKSUM,
      capability: {
        ...capability,
        operationContracts: [{ key: 'number.add', contractVersion: 1 }]
      },
      operations
    })

    expect(compiled).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'RULE_OPERATION_NOT_SUPPORTED' })
      ])
    })
  })

  it('rejects malformed code-owned evidence operation descriptors at registry admission', () => {
    expect(() =>
      createRuleOperationRegistry([
        ...coreRuleOperations,
        {
          key: 'test.invalid-evidence',
          contractVersion: 1,
          inputs: { min: 'TEXT', max: 'NUMBER' },
          outputs: { value: 'NUMBER' },
          executionKind: 'EVIDENCE',
          evidence: {
            kind: 'INTEGER_RANGE',
            minInput: 'min',
            maxInput: 'max',
            valueOutput: 'value'
          }
        }
      ])
    ).toThrow(/must bind numeric minimum, maximum, and value ports/)
  })

  it('rejects cycles, unknown ports, and mismatched value kinds at compilation', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const definition = thresholdDefinition()
    const compiled = compileRuleGraph({
      definition: {
        ...definition,
        nodes: [
          {
            ...definition.nodes[0]!,
            inputs: {
              left: { kind: 'NODE_OUTPUT', nodeId: 'threshold', port: 'missing' },
              right: { kind: 'LITERAL', value: 'not-a-number' }
            }
          },
          definition.nodes[1]!
        ]
      },
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })

    expect(compiled).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'RULE_GRAPH_CYCLE' }),
        expect.objectContaining({ code: 'RULE_UNKNOWN_OUTPUT_PORT' }),
        expect.objectContaining({ code: 'RULE_PORT_TYPE_MISMATCH' })
      ])
    })
  })

  it('enforces graph bounds in the shared compiler without relying on transport parsing', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const definition = thresholdDefinition()
    const compiled = compileRuleGraph({
      definition: {
        ...definition,
        nodes: [
          {
            ...definition.nodes[0]!,
            inputs: Object.fromEntries(
              Array.from({ length: 17 }, (_, index) => [
                `input${index}`,
                { kind: 'LITERAL' as const, value: index }
              ])
            )
          },
          definition.nodes[1]!
        ]
      },
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })

    expect(compiled).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'RULE_NODE_INPUT_BOUNDS' })
      ])
    })
  })

  it('binds live facts at execution instead of publishing actor-specific results', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const compiled = compileRuleGraph({
      definition: thresholdDefinition(),
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })
    if (!compiled.ok) throw new Error('Expected rule graph compilation to succeed.')

    const result = executeRuleGraph({
      graph: compiled.value,
      occurrenceId: OCCURRENCE_ID,
      facts: { 'actor.base': 8, 'test.threshold': 13 },
      operations
    })
    expect(result.status).toBe('COMPLETE')
    if (result.status !== 'COMPLETE') throw new Error('Expected a completed rule execution.')
    expect(result.outputs).toEqual({ passed: false, margin: -3 })
  })

  it('pauses sequential evidence requests and never re-executes completed pure nodes', async () => {
    let additionExecutions = 0
    const countedAdd = {
      ...addNumbersRuleOperation,
      execute(inputs: Parameters<typeof addNumbersRuleOperation.execute>[0]) {
        additionExecutions += 1
        return addNumbersRuleOperation.execute(inputs)
      }
    }
    const operations = createRuleOperationRegistry(
      coreRuleOperations.map((operation) =>
        operation.key === addNumbersRuleOperation.key ? countedAdd : operation
      )
    )
    const compiled = compileRuleGraph({
      definition: evidenceDefinition(),
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })
    if (!compiled.ok) throw new Error('Expected rule graph compilation to succeed.')

    const first = executeRuleGraph({
      graph: compiled.value,
      occurrenceId: OCCURRENCE_ID,
      facts: { 'actor.base': 12, 'test.threshold': 13 },
      operations
    })
    expect(first.status).toBe('PAUSED')
    if (first.status !== 'PAUSED') throw new Error('Expected a paused rule execution.')
    expect(first.continuation.request).toMatchObject({ nodeId: 'roll', min: 1, max: 20 })
    expect(first.continuation.trace.map((entry) => entry.nodeId)).toEqual(['total'])
    expect(additionExecutions).toBe(1)

    const second = resumeRuleGraph({
      continuation: first.continuation,
      response: { requestId: first.continuation.request.requestId, value: 14 },
      operations
    })
    expect(second.status).toBe('PAUSED')
    if (second.status !== 'PAUSED') throw new Error('Expected a second paused rule execution.')
    expect(second.continuation.request).toMatchObject({ nodeId: 'second_roll', min: 1, max: 6 })
    expect(second.continuation.request.requestId).not.toBe(first.continuation.request.requestId)
    expect(second.continuation.trace.map((entry) => entry.nodeId)).toEqual([
      'total',
      'roll',
      'with_first_roll'
    ])
    expect(additionExecutions).toBe(2)

    const complete = resumeRuleGraph({
      continuation: second.continuation,
      response: { requestId: second.continuation.request.requestId, value: 4 },
      operations
    })
    expect(complete.status).toBe('COMPLETE')
    if (complete.status !== 'COMPLETE') throw new Error('Expected a completed rule execution.')
    expect(complete.outputs).toEqual({ value: 32 })
    expect(complete.evidence.trace.map((entry) => entry.nodeId)).toEqual([
      'total',
      'roll',
      'with_first_roll',
      'second_roll',
      'result'
    ])
    expect(additionExecutions).toBe(3)
  })
})

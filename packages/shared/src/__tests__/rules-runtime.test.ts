import { describe, expect, it } from 'vitest'

import {
  addNumbersRuleOperation,
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  executeRuleGraph,
  resumeRuleGraph,
  type GameSystemRuleCapabilityContract,
  type RuleGraphDefinition
} from '../domains/rules/index.js'

const SYSTEM_ID = '11111111-1111-4111-8111-111111111111'
const SEEDED_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const DEFINITION_ID = '22222222-2222-4222-8222-222222222222'
const CHECKSUM = 'a'.repeat(64)
const OCCURRENCE_ID = '44444444-4444-4444-8444-444444444444'

const capability: GameSystemRuleCapabilityContract = {
  gameSystemId: SYSTEM_ID,
  contractVersion: 1,
  authoredRootKinds: ['action'],
  contentKinds: [],
  definitionFamilyKeys: ['test-resolution'],
  factContracts: [
    { key: 'actor.base', valueKind: 'NUMBER' },
    { key: 'test.threshold', valueKind: 'NUMBER' },
    { key: 'private.unused', valueKind: 'BOOLEAN' },
    { key: 'test.extra-die', valueKind: 'BOOLEAN' },
    { key: 'test.keep', valueKind: 'TEXT' }
  ],
  operationContracts: coreRuleOperations.map(({ key, contractVersion }) => ({
    key,
    contractVersion
  }))
}

function evidenceDefinition(): RuleGraphDefinition {
  return {
    ...thresholdDefinition(),
    sourceEntryBindings: [
      {
        sourceEntryId: '55555555-5555-4555-8555-555555555555',
        nodeId: 'result'
      }
    ],
    nodes: [
      thresholdDefinition().nodes[0]!,
      {
        id: 'roll',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
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
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 6 }
        }
      },
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: {
            kind: 'NODE_OUTPUT',
            nodeId: 'with_first_roll',
            port: 'value'
          },
          right: { kind: 'NODE_OUTPUT', nodeId: 'second_roll', port: 'value' }
        }
      }
    ],
    outputs: {
      value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' }
    }
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

function boundedChoiceDefinition(): RuleGraphDefinition {
  return {
    schemaVersion: 1,
    id: DEFINITION_ID,
    gameSystemId: SYSTEM_ID,
    definitionFamilyKey: 'test-resolution',
    nodes: [
      {
        id: 'choice',
        operation: {
          key: 'evidence.bounded-choice-index',
          contractVersion: 1
        },
        inputs: {
          minIndex: { kind: 'LITERAL', value: 0 },
          maxIndex: { kind: 'LITERAL', value: 2 }
        }
      }
    ],
    outputs: {
      selectedIndex: {
        kind: 'NODE_OUTPUT',
        nodeId: 'choice',
        port: 'selectedIndex'
      }
    }
  }
}

describe('shared rules runtime', () => {
  it('records an exact bounded application-owned choice without carrying option identity', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const compiled = compileRuleGraph({
      definition: boundedChoiceDefinition(),
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) throw new Error('Expected bounded-choice graph compilation to succeed.')

    const paused = executeRuleGraph({
      graph: compiled.value,
      occurrenceId: OCCURRENCE_ID,
      facts: {},
      operations
    })
    expect(paused).toMatchObject({
      status: 'PAUSED',
      continuation: {
        request: {
          kind: 'INTEGER_RANGE',
          min: 0,
          max: 2
        }
      }
    })
    if (paused.status !== 'PAUSED') throw new Error('Expected a paused bounded-choice execution.')

    const completed = resumeRuleGraph({
      continuation: paused.continuation,
      response: {
        requestId: paused.continuation.request.requestId,
        value: 2
      },
      operations
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      outputs: { selectedIndex: 2 },
      evidence: {
        trace: [
          {
            operation: {
              key: 'evidence.bounded-choice-index',
              contractVersion: 1
            },
            evidence: { kind: 'INTEGER_RANGE', value: 2 }
          }
        ]
      }
    })
  })

  it('accepts deterministic PostgreSQL UUID identities for seeded Game Systems', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const compiled = compileRuleGraph({
      definition: { ...thresholdDefinition(), gameSystemId: SEEDED_SYSTEM_ID },
      sourceChecksum: CHECKSUM,
      capability: { ...capability, gameSystemId: SEEDED_SYSTEM_ID },
      operations
    })

    expect(compiled.ok).toBe(true)
  })

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

  it('executes a typed proposal node once and retains its exact trace entry', () => {
    let executions = 0
    const proposal = {
      key: 'test.proposal',
      contractVersion: 1,
      inputs: { value: 'NUMBER' as const },
      outputs: { proposed: 'NUMBER' as const },
      executionKind: 'PROPOSAL' as const,
      execute(inputs: Readonly<Record<string, boolean | number | string>>) {
        executions += 1
        return { proposed: (inputs.value as number) + 1 }
      }
    }
    const operations = createRuleOperationRegistry([...coreRuleOperations, proposal])
    const compiled = compileRuleGraph({
      definition: {
        ...thresholdDefinition(),
        nodes: [
          {
            id: 'proposal',
            operation: { key: 'test.proposal', contractVersion: 1 },
            inputs: { value: { kind: 'FACT', factKey: 'actor.base' } }
          }
        ],
        outputs: {
          proposed: {
            kind: 'NODE_OUTPUT',
            nodeId: 'proposal',
            port: 'proposed'
          }
        }
      },
      sourceChecksum: CHECKSUM,
      capability: {
        ...capability,
        operationContracts: [
          ...capability.operationContracts,
          { key: 'test.proposal', contractVersion: 1 }
        ]
      },
      operations
    })
    if (!compiled.ok) throw new Error('Expected proposal graph compilation to succeed.')

    const result = executeRuleGraph({
      graph: compiled.value,
      occurrenceId: OCCURRENCE_ID,
      facts: { 'actor.base': 12 },
      operations
    })
    expect(result).toMatchObject({
      status: 'COMPLETE',
      outputs: { proposed: 13 },
      evidence: {
        trace: [
          {
            nodeId: 'proposal',
            operation: { key: 'test.proposal', contractVersion: 1 },
            inputs: { value: 12 },
            outputs: { proposed: 13 }
          }
        ]
      }
    })
    expect(executions).toBe(1)
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
              left: {
                kind: 'NODE_OUTPUT',
                nodeId: 'threshold',
                port: 'missing'
              },
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

  it('rejects ambiguous and missing authored source-entry bindings', () => {
    const operations = createRuleOperationRegistry(coreRuleOperations)
    const definition = thresholdDefinition()
    const ambiguous = compileRuleGraph({
      definition: {
        ...definition,
        sourceEntryBindings: [
          {
            sourceEntryId: '55555555-5555-4555-8555-555555555555',
            nodeId: 'total'
          },
          {
            sourceEntryId: '55555555-5555-4555-8555-555555555555',
            nodeId: 'threshold'
          }
        ]
      },
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })
    const missing = compileRuleGraph({
      definition: {
        ...definition,
        sourceEntryBindings: [
          {
            sourceEntryId: '55555555-5555-4555-8555-555555555555',
            nodeId: 'missing'
          }
        ]
      },
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })
    const malformed = compileRuleGraph({
      definition: {
        ...definition,
        sourceEntryBindings: [{ sourceEntryId: 'not-a-uuid', nodeId: 'total' }]
      },
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })
    const sharedNode = compileRuleGraph({
      definition: {
        ...definition,
        sourceEntryBindings: [
          {
            sourceEntryId: '55555555-5555-4555-8555-555555555555',
            nodeId: 'total'
          },
          {
            sourceEntryId: '66666666-6666-4666-8666-666666666666',
            nodeId: 'total'
          }
        ]
      },
      sourceChecksum: CHECKSUM,
      capability,
      operations
    })

    expect(ambiguous).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: 'RULE_DUPLICATE_SOURCE_ENTRY_BINDING'
        })
      ])
    })
    expect(missing).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'RULE_SOURCE_ENTRY_NODE_MISSING' })
      ])
    })
    expect(malformed).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'RULE_INVALID_SOURCE_ENTRY_ID' })
      ])
    })
    expect(sharedNode).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: 'RULE_DUPLICATE_SOURCE_ENTRY_BINDING'
        })
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
    expect(first.continuation.request).toMatchObject({
      nodeId: 'roll',
      min: 1,
      max: 20
    })
    expect(first.continuation.trace.map((entry) => entry.nodeId)).toEqual(['total'])
    expect(first.continuation.graph.sourceEntryBindings).toEqual([
      {
        sourceEntryId: '55555555-5555-4555-8555-555555555555',
        nodeId: 'result'
      }
    ])
    expect(additionExecutions).toBe(1)

    const second = resumeRuleGraph({
      continuation: first.continuation,
      response: { requestId: first.continuation.request.requestId, value: 14 },
      operations
    })
    expect(second.status).toBe('PAUSED')
    if (second.status !== 'PAUSED') throw new Error('Expected a second paused rule execution.')
    expect(second.continuation.request).toMatchObject({
      nodeId: 'second_roll',
      min: 1,
      max: 6
    })
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
    expect(complete.evidence.sourceEntryBindings).toEqual([
      {
        sourceEntryId: '55555555-5555-4555-8555-555555555555',
        nodeId: 'result'
      }
    ])
    expect(additionExecutions).toBe(3)
  })
})

/** Two faces, the second optional, one kept: the shape of a test whose roll mode keeps one of two. */
function keptD20Definition(): RuleGraphDefinition {
  return {
    schemaVersion: 1,
    id: DEFINITION_ID,
    gameSystemId: SYSTEM_ID,
    definitionFamilyKey: 'test-resolution',
    nodes: [
      {
        id: 'first',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'second',
        operation: { key: 'evidence.optional-integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 },
          enabled: { kind: 'FACT', factKey: 'test.extra-die' }
        }
      },
      {
        id: 'kept',
        operation: { key: 'number.keep-one-of-two', contractVersion: 1 },
        inputs: {
          first: { kind: 'NODE_OUTPUT', nodeId: 'first', port: 'value' },
          second: { kind: 'NODE_OUTPUT', nodeId: 'second', port: 'value' },
          keep: { kind: 'FACT', factKey: 'test.keep' }
        }
      }
    ],
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'kept', port: 'value' } }
  }
}

describe('optional evidence and keep-one-of-two operations', () => {
  const operations = createRuleOperationRegistry(coreRuleOperations)
  const compiled = compileRuleGraph({
    definition: keptD20Definition(),
    sourceChecksum: CHECKSUM,
    capability,
    operations
  })
  if (!compiled.ok) throw new Error('Expected the kept d20 graph to compile.')
  const graph = compiled.value

  /** Runs the graph, answering each pause with the next face; returns outputs and the dice asked. */
  function run(facts: { extraDie: boolean; keep: string }, faces: readonly number[]) {
    const remaining = [...faces]
    let result = executeRuleGraph({
      graph,
      occurrenceId: OCCURRENCE_ID,
      facts: { 'test.extra-die': facts.extraDie, 'test.keep': facts.keep },
      operations
    })
    const asked: string[] = []
    while (result.status === 'PAUSED') {
      asked.push(result.continuation.request.nodeId)
      const value = remaining.shift()
      if (value === undefined) throw new Error('The graph asked for more dice than were supplied.')
      result = resumeRuleGraph({
        continuation: result.continuation,
        response: { requestId: result.continuation.request.requestId, value },
        operations
      })
    }
    return { result, asked, unused: remaining }
  }

  it('asks for one die and keeps it when the extra die is not enabled', () => {
    const { result, asked, unused } = run({ extraDie: false, keep: 'FIRST' }, [13])
    expect(asked).toEqual(['first'])
    expect(unused).toEqual([])
    if (result.status !== 'COMPLETE') throw new Error('Expected a completed execution.')
    expect(result.outputs).toEqual({ value: 13 })
    const skipped = result.evidence.trace.find((entry) => entry.nodeId === 'second')
    expect(skipped?.evidence).toBeUndefined()
  })

  it('asks for both dice and keeps the higher', () => {
    const { result, asked } = run({ extraDie: true, keep: 'HIGHER' }, [4, 17])
    expect(asked).toEqual(['first', 'second'])
    if (result.status !== 'COMPLETE') throw new Error('Expected a completed execution.')
    expect(result.outputs).toEqual({ value: 17 })
    expect(
      result.evidence.trace.filter((entry) => entry.evidence).map((e) => e.evidence?.value)
    ).toEqual([4, 17])
  })

  it('asks for both dice and keeps the lower', () => {
    const { result } = run({ extraDie: true, keep: 'LOWER' }, [17, 4])
    if (result.status !== 'COMPLETE') throw new Error('Expected a completed execution.')
    expect(result.outputs).toEqual({ value: 4 })
  })

  it('refuses a keep the operation does not know', () => {
    expect(() => run({ extraDie: true, keep: 'SIDEWAYS' }, [4, 17])).toThrow(
      /"keep" must be FIRST, HIGHER or LOWER/
    )
  })

  it('rejects an optional evidence contract whose enabling port is not boolean', () => {
    expect(() =>
      createRuleOperationRegistry([
        ...coreRuleOperations,
        {
          key: 'test.invalid-optional-evidence',
          contractVersion: 1,
          inputs: { min: 'NUMBER', max: 'NUMBER', enabled: 'NUMBER' },
          outputs: { value: 'NUMBER' },
          executionKind: 'EVIDENCE',
          evidence: {
            kind: 'INTEGER_RANGE',
            minInput: 'min',
            maxInput: 'max',
            valueOutput: 'value',
            enabledInput: 'enabled'
          }
        }
      ])
    ).toThrow(/enabling port/)
  })
})

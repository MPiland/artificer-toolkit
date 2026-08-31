import { describe, expect, it } from 'vitest'

import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { CompiledRuleGraph, RuleGraphDefinition } from '@artificer-toolkit/shared/rules'

import {
  createRulesRuntimeService,
  RuleDefinitionCompilationError,
  RuleRuntimeConfigurationError,
  RuleRuntimeSourceIntegrityError,
  type PublishedRuleDefinitionSource
} from './rulesRuntimeService.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const SYSTEM_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_SYSTEM_ID = '33333333-3333-4333-8333-333333333333'
const DEFINITION_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_DEFINITION_ID = '55555555-5555-4555-8555-555555555555'
const CONTINUATION_INTEGRITY_KEY = new TextEncoder().encode('rules-runtime-continuation-test-key')

const capability = {
  gameSystemId: SYSTEM_ID,
  contractVersion: 1,
  authoredRootKinds: ['action'],
  definitionFamilyKeys: ['test-resolution'],
  factContracts: [
    { key: 'actor.base', valueKind: 'NUMBER' },
    { key: 'test.threshold', valueKind: 'NUMBER' }
  ],
  operationContracts: [
    { key: 'number.add', contractVersion: 1 },
    { key: 'number.compare-threshold', contractVersion: 1 },
    { key: 'evidence.integer-range', contractVersion: 1 }
  ]
} as const

const otherCapability = {
  gameSystemId: OTHER_SYSTEM_ID,
  contractVersion: 1,
  authoredRootKinds: ['ability'],
  definitionFamilyKeys: ['other-resolution'],
  factContracts: [{ key: 'other.base', valueKind: 'NUMBER' }],
  operationContracts: [{ key: 'number.add', contractVersion: 1 }]
} as const

function definition(gameSystemId = SYSTEM_ID) {
  return {
    schemaVersion: 1,
    id: DEFINITION_ID,
    gameSystemId,
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
      passed: { kind: 'NODE_OUTPUT', nodeId: 'threshold', port: 'passed' }
    }
  } as const
}

function evidenceDefinition() {
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
        id: 'roll',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'total', port: 'value' },
          right: { kind: 'NODE_OUTPUT', nodeId: 'roll', port: 'value' }
        }
      }
    ],
    outputs: {
      value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' }
    }
  } as const
}

function otherDefinition() {
  return {
    schemaVersion: 1,
    id: OTHER_DEFINITION_ID,
    gameSystemId: OTHER_SYSTEM_ID,
    definitionFamilyKey: 'other-resolution',
    nodes: [
      {
        id: 'total',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'FACT', factKey: 'other.base' },
          right: { kind: 'LITERAL', value: 2 }
        }
      }
    ],
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'total', port: 'value' } }
  } as const
}

function command(input?: { definitionId?: string; facts?: Record<string, number> }) {
  return {
    definitionId: input?.definitionId ?? DEFINITION_ID,
    occurrenceId: '44444444-4444-4444-8444-444444444444',
    facts: input?.facts ?? { 'actor.base': 12, 'test.threshold': 13 }
  }
}

function source(
  publishedDefinition: RuleGraphDefinition = definition(),
  checksum = checksumRuleDocument(publishedDefinition)
): PublishedRuleDefinitionSource {
  return {
    async requireCurrent(definitionId) {
      if (definitionId !== publishedDefinition.id) throw new Error('Definition not found.')
      return {
        id: publishedDefinition.id,
        gameSystemId: publishedDefinition.gameSystemId,
        definitionFamilyKey: publishedDefinition.definitionFamilyKey,
        checksum,
        definition: publishedDefinition
      }
    }
  }
}

describe('rules runtime service', () => {
  it('resolves the current published definition and returns frozen execution evidence', async () => {
    const publishedDefinition = definition()
    const checksum = checksumRuleDocument(publishedDefinition)
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(publishedDefinition, checksum)
    })

    await expect(service.execute(command())).resolves.toMatchObject({
      status: 'COMPLETE',
      outputs: { passed: true },
      evidence: {
        source: {
          definitionId: DEFINITION_ID,
          gameSystemId: SYSTEM_ID,
          definitionFamilyKey: 'test-resolution',
          checksum
        },
        capabilityContractVersion: 1,
        facts: { 'actor.base': 12, 'test.threshold': 13 }
      }
    })
  })

  it('executes an exact resolved source without reading the definition repository', async () => {
    let reads = 0
    const publishedDefinition = definition()
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: {
        async requireCurrent() {
          reads += 1
          throw new Error('Resolved-source execution must not read definitions.')
        }
      }
    })
    const published = serverPublishedRuleDefinitionDtoSchema.parse({
      id: DEFINITION_ID,
      gameSystemId: SYSTEM_ID,
      definitionFamilyKey: 'test-resolution',
      checksum: checksumRuleDocument(publishedDefinition),
      definition: publishedDefinition
    })
    await expect(service.executeResolved({ command: command(), published })).resolves.toMatchObject(
      {
        status: 'COMPLETE',
        outputs: { passed: true }
      }
    )
    expect(reads).toBe(0)
    await expect(
      service.executeResolved({
        command: command(),
        published: { ...published, checksum: 'a'.repeat(64) }
      })
    ).rejects.toThrow(RuleRuntimeSourceIntegrityError)
    await expect(
      service.executeResolved({
        command: command({ definitionId: OTHER_DEFINITION_ID }),
        published
      })
    ).rejects.toThrow(RuleRuntimeSourceIntegrityError)
    await expect(
      service.executeResolved({
        command: command(),
        published: { ...published, gameSystemId: OTHER_SYSTEM_ID }
      })
    ).rejects.toThrow(RuleRuntimeSourceIntegrityError)
  })

  it('executes one exact frozen graph without source lookup or recompilation', async () => {
    let reads = 0
    const publishedDefinition = definition()
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: {
        async requireCurrent() {
          reads += 1
          throw new Error('Frozen graph execution must not read definitions.')
        }
      }
    })
    const published = serverPublishedRuleDefinitionDtoSchema.parse({
      id: DEFINITION_ID,
      gameSystemId: SYSTEM_ID,
      definitionFamilyKey: 'test-resolution',
      checksum: checksumRuleDocument(publishedDefinition),
      definition: publishedDefinition
    })
    const compiled = await service.executeResolvedWithGraph?.({
      command: command(),
      published
    })
    if (!compiled) throw new Error('Expected resolved graph support.')
    await expect(
      service.executeFrozen({
        graph: compiled.graph,
        occurrenceId: command().occurrenceId,
        facts: command().facts
      })
    ).resolves.toMatchObject({
      result: { status: 'COMPLETE', outputs: { passed: true } },
      graph: { source: { definitionId: DEFINITION_ID } }
    })
    expect(reads).toBe(0)
  })

  it('rejects every schema-valid frozen graph that the generic compiler would not admit', async () => {
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: {
        async requireCurrent() {
          throw new Error('Frozen graph execution must not read definitions.')
        }
      }
    })
    const publishedDefinition = definition()
    const published = serverPublishedRuleDefinitionDtoSchema.parse({
      id: DEFINITION_ID,
      gameSystemId: SYSTEM_ID,
      definitionFamilyKey: 'test-resolution',
      checksum: checksumRuleDocument(publishedDefinition),
      definition: publishedDefinition
    })
    const compiled = await service.executeResolvedWithGraph?.({
      command: command(),
      published
    })
    if (!compiled) throw new Error('Expected resolved graph support.')
    const [total, threshold] = compiled.graph.nodes
    if (!total || !threshold) throw new Error('Expected two compiled nodes.')
    const variants: readonly CompiledRuleGraph[] = [
      {
        ...compiled.graph,
        nodes: [
          {
            ...total,
            inputs: { ...total.inputs, unexpected: { kind: 'LITERAL' as const, value: 1 } }
          },
          threshold
        ]
      },
      {
        ...compiled.graph,
        nodes: [{ ...total, inputs: { right: total.inputs.right } }, threshold]
      },
      { ...compiled.graph, nodes: [total, { ...threshold, id: total.id }] },
      {
        ...compiled.graph,
        nodes: [
          {
            ...total,
            inputs: {
              ...total.inputs,
              left: { kind: 'NODE_OUTPUT', nodeId: total.id, port: 'missing' }
            }
          },
          threshold
        ]
      },
      {
        ...compiled.graph,
        nodes: [
          {
            ...total,
            inputs: {
              ...total.inputs,
              left: { kind: 'NODE_OUTPUT', nodeId: threshold.id, port: 'passed' }
            }
          },
          threshold
        ]
      },
      { ...compiled.graph, nodes: [threshold, total] },
      {
        ...compiled.graph,
        nodes: [{ ...total, operation: { ...total.operation, contractVersion: 2 } }, threshold]
      }
    ]
    for (const graph of variants) {
      await expect(
        service.executeFrozen({
          graph,
          occurrenceId: command().occurrenceId,
          facts: command().facts
        })
      ).rejects.toThrow(RuleRuntimeSourceIntegrityError)
    }
  })

  it('fails closed when the current definition has no registered System capability', async () => {
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(definition(OTHER_SYSTEM_ID))
    })
    await expect(service.execute(command())).rejects.toThrow(RuleRuntimeConfigurationError)
  })

  it('isolates each published definition to its exact Game System rule capability', async () => {
    const first = createRulesRuntimeService({
      capabilities: [capability, otherCapability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(definition())
    })
    await expect(first.execute(command())).resolves.toMatchObject({
      status: 'COMPLETE',
      outputs: { passed: true }
    })

    const second = createRulesRuntimeService({
      capabilities: [capability, otherCapability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(otherDefinition())
    })
    await expect(
      second.execute(
        command({
          definitionId: OTHER_DEFINITION_ID,
          facts: { 'other.base': 7 }
        })
      )
    ).resolves.toMatchObject({ status: 'COMPLETE', outputs: { value: 9 } })
  })

  it('rejects duplicate Game System capability registration after UUID normalization', () => {
    expect(() =>
      createRulesRuntimeService({
        capabilities: [{ ...capability, gameSystemId: SYSTEM_ID.toUpperCase() }, capability],
        continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
        definitions: source()
      })
    ).toThrow(RuleRuntimeConfigurationError)
  })

  it('rejects cross-System family, fact, and operation leakage', async () => {
    const leakedDefinition = {
      ...otherDefinition(),
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
            value: { kind: 'LITERAL', value: 12 },
            threshold: { kind: 'LITERAL', value: 10 }
          }
        }
      ],
      outputs: {
        value: { kind: 'NODE_OUTPUT', nodeId: 'total', port: 'value' }
      }
    } as const
    const service = createRulesRuntimeService({
      capabilities: [capability, otherCapability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(leakedDefinition)
    })

    await expect(
      service.execute(
        command({
          definitionId: OTHER_DEFINITION_ID,
          facts: { 'actor.base': 12 }
        })
      )
    ).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: 'RULE_DEFINITION_FAMILY_NOT_SUPPORTED'
        }),
        expect.objectContaining({ code: 'RULE_UNKNOWN_FACT' }),
        expect.objectContaining({ code: 'RULE_OPERATION_NOT_SUPPORTED' })
      ])
    })
  })

  it('fails closed when the registered System does not authorize an operation', async () => {
    const service = createRulesRuntimeService({
      capabilities: [
        {
          ...capability,
          operationContracts: [{ key: 'number.add', contractVersion: 1 }]
        }
      ],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source()
    })
    await expect(service.execute(command())).rejects.toThrow(RuleDefinitionCompilationError)
  })

  it('rejects a persisted checksum that does not match the current published definition', async () => {
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(definition(), 'a'.repeat(64))
    })
    await expect(service.execute(command())).rejects.toThrow(RuleRuntimeSourceIntegrityError)
  })

  it('seals a pause, resumes without rereading the published definition, and rejects tampering', async () => {
    let reads = 0
    const published = evidenceDefinition()
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: {
        async requireCurrent() {
          reads += 1
          return {
            id: DEFINITION_ID,
            gameSystemId: SYSTEM_ID,
            definitionFamilyKey: 'test-resolution',
            checksum: checksumRuleDocument(published),
            definition: published
          }
        }
      }
    })
    const started = await service.execute({
      definitionId: DEFINITION_ID,
      occurrenceId: '44444444-4444-4444-8444-444444444444',
      facts: { 'actor.base': 12, 'test.threshold': 13 }
    })
    expect(started.status).toBe('PAUSED')
    if (started.status !== 'PAUSED') throw new Error('Expected a paused rule execution.')
    expect(reads).toBe(1)
    await expect(
      service.resume({
        continuation: {
          ...started.continuation,
          request: { ...started.continuation.request, max: 99 }
        },
        response: {
          requestId: started.continuation.request.requestId,
          value: 14
        }
      })
    ).rejects.toThrow(RuleRuntimeSourceIntegrityError)
    const { seal: _seal, ...unsealed } = started.continuation
    const forged = {
      ...unsealed,
      request: { ...unsealed.request, max: 99 },
      seal: checksumRuleDocument({
        ...unsealed,
        request: { ...unsealed.request, max: 99 }
      })
    }
    await expect(
      service.resume({
        continuation: forged,
        response: { requestId: forged.request.requestId, value: 14 }
      })
    ).rejects.toThrow(RuleRuntimeSourceIntegrityError)
    const completed = await service.resume({
      continuation: started.continuation,
      response: {
        requestId: started.continuation.request.requestId,
        value: 14
      }
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      outputs: { value: 28 }
    })
    expect(reads).toBe(1)
  })

  it('rejects wrong evidence response IDs and values before resume', async () => {
    const published = evidenceDefinition()
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(published)
    })
    const started = await service.execute({
      definitionId: DEFINITION_ID,
      occurrenceId: '44444444-4444-4444-8444-444444444444',
      facts: { 'actor.base': 12, 'test.threshold': 13 }
    })
    if (started.status !== 'PAUSED') throw new Error('Expected a paused rule execution.')
    await expect(
      service.resume({
        continuation: started.continuation,
        response: { requestId: 'wrong', value: 14 }
      })
    ).rejects.toThrow()
    await expect(
      service.resume({
        continuation: started.continuation,
        response: {
          requestId: started.continuation.request.requestId,
          value: 20.5
        }
      })
    ).rejects.toThrow()
    await expect(
      service.resume({
        continuation: started.continuation,
        response: {
          requestId: started.continuation.request.requestId,
          value: 21,
          extra: true
        }
      })
    ).rejects.toThrow()
    await expect(
      service.resume({
        continuation: started.continuation,
        response: {
          requestId: started.continuation.request.requestId,
          value: 14
        },
        extra: true
      })
    ).rejects.toThrow()
  })
})

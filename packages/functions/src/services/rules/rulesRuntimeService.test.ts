import { describe, expect, it } from 'vitest'

import {
  createRulesRuntimeService,
  RuleDefinitionCompilationError,
  RuleRuntimeConfigurationError,
  RuleRuntimeSourceIntegrityError,
  type PublishedRuleDefinitionSource
} from './rulesRuntimeService.js'
import { checksumRuleDocument } from './ruleChecksum.js'

const SYSTEM_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_SYSTEM_ID = '33333333-3333-4333-8333-333333333333'
const DEFINITION_ID = '22222222-2222-4222-8222-222222222222'
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
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
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
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
  } as const
}

function command() {
  return {
    definitionId: DEFINITION_ID,
    occurrenceId: '44444444-4444-4444-8444-444444444444',
    facts: { 'actor.base': 12, 'test.threshold': 13 }
  }
}

function source(
  publishedDefinition:
    | ReturnType<typeof definition>
    | ReturnType<typeof evidenceDefinition> = definition(),
  checksum = checksumRuleDocument(publishedDefinition)
): PublishedRuleDefinitionSource {
  return {
    async requireCurrent(definitionId) {
      if (definitionId !== DEFINITION_ID) throw new Error('Definition not found.')
      return {
        id: DEFINITION_ID,
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

  it('fails closed when the current definition has no registered System capability', async () => {
    const service = createRulesRuntimeService({
      capabilities: [capability],
      continuationIntegrityKey: CONTINUATION_INTEGRITY_KEY,
      definitions: source(definition(OTHER_SYSTEM_ID))
    })
    await expect(service.execute(command())).rejects.toThrow(RuleRuntimeConfigurationError)
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
        response: { requestId: started.continuation.request.requestId, value: 14 }
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
      response: { requestId: started.continuation.request.requestId, value: 14 }
    })
    expect(completed).toMatchObject({ status: 'COMPLETE', outputs: { value: 28 } })
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
        response: { requestId: started.continuation.request.requestId, value: 20.5 }
      })
    ).rejects.toThrow()
    await expect(
      service.resume({
        continuation: started.continuation,
        response: { requestId: started.continuation.request.requestId, value: 21, extra: true }
      })
    ).rejects.toThrow()
    await expect(
      service.resume({
        continuation: started.continuation,
        response: { requestId: started.continuation.request.requestId, value: 14 },
        extra: true
      })
    ).rejects.toThrow()
  })
})

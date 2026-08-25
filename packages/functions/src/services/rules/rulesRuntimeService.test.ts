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
    { key: 'number.compare-threshold', contractVersion: 1 }
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

function command() {
  return {
    definitionId: DEFINITION_ID,
    facts: { 'actor.base': 12, 'test.threshold': 13 }
  }
}

function source(
  publishedDefinition = definition(),
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
      definitions: source()
    })
    await expect(service.execute(command())).rejects.toThrow(RuleDefinitionCompilationError)
  })

  it('rejects a persisted checksum that does not match the current published definition', async () => {
    const service = createRulesRuntimeService({
      capabilities: [capability],
      definitions: source(definition(), 'a'.repeat(64))
    })
    await expect(service.execute(command())).rejects.toThrow(RuleRuntimeSourceIntegrityError)
  })
})

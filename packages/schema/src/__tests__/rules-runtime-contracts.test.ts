import { describe, expect, it } from 'vitest'

import * as publicRulesRuntime from '../api/rulesRuntime.js'
import {
  serverPublishedRuleDefinitionDtoSchema,
  serverRuleExecutionInputDtoSchema
} from '../shared/rulesExecution.js'

const SYSTEM_ID = '11111111-1111-4111-8111-111111111111'
const DEFINITION_ID = '22222222-2222-4222-8222-222222222222'
const { gameSystemCapabilityDtoSchema, ruleGraphDefinitionDtoSchema } = publicRulesRuntime

const definition = {
  schemaVersion: 1,
  id: DEFINITION_ID,
  gameSystemId: SYSTEM_ID,
  definitionFamilyKey: 'test-resolution',
  nodes: [
    {
      id: 'threshold',
      operation: { key: 'number.compare-threshold', contractVersion: 1 },
      inputs: {
        value: { kind: 'FACT', factKey: 'actor.value' },
        threshold: { kind: 'LITERAL', value: 10 }
      }
    }
  ],
  outputs: {
    passed: { kind: 'NODE_OUTPUT', nodeId: 'threshold', port: 'passed' }
  }
} as const

describe('rules runtime contracts', () => {
  it('accepts a bounded UUID-backed definition and System capability', () => {
    expect(
      gameSystemCapabilityDtoSchema.parse({
        gameSystemId: SYSTEM_ID,
        contractVersion: 1,
        authoredRootKinds: ['action'],
        definitionFamilyKeys: ['test-resolution'],
        factContracts: [{ key: 'actor.value', valueKind: 'NUMBER' }],
        operationContracts: [{ key: 'number.compare-threshold', contractVersion: 1 }]
      })
    ).toMatchObject({ gameSystemId: SYSTEM_ID })
    expect(ruleGraphDefinitionDtoSchema.parse(definition)).toEqual(definition)
  })

  it('rejects invalid identities, arbitrary operation keys, and unbounded graph inputs', () => {
    expect(() =>
      ruleGraphDefinitionDtoSchema.parse({
        ...definition,
        id: 'threshold-rule',
        nodes: [
          {
            ...definition.nodes[0],
            operation: { key: 'user script', contractVersion: 1 },
            inputs: Object.fromEntries(
              Array.from({ length: 17 }, (_, index) => [
                `input${index}`,
                { kind: 'LITERAL', value: index }
              ])
            )
          }
        ]
      })
    ).toThrow()
  })

  it('accepts runtime facts separately from the published definition', () => {
    expect(
      serverRuleExecutionInputDtoSchema.parse({
        definitionId: DEFINITION_ID,
        facts: { 'actor.value': 12 }
      }).facts
    ).toEqual({ 'actor.value': 12 })
  })

  it('keeps the published source envelope distinct from a runtime invocation', () => {
    expect(
      serverPublishedRuleDefinitionDtoSchema.parse({
        id: DEFINITION_ID,
        gameSystemId: SYSTEM_ID,
        definitionFamilyKey: 'test-resolution',
        checksum: 'a'.repeat(64),
        definition
      })
    ).toMatchObject({ id: DEFINITION_ID, definition })
    expect(publicRulesRuntime).not.toHaveProperty('serverCompletedRuleExecutionDtoSchema')
  })
})

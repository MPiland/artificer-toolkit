import { describe, expect, it } from 'vitest'

import {
  ruleEvaluationDtoSchema,
  rulePackDocumentDtoSchema,
  type RulePackDocumentDto
} from '@artificer-toolkit/schema/api/rules'

import { checksumRuleDocument } from './ruleChecksum.js'
import { assertRulePackConformance, RuleConformanceError } from './ruleConformance.js'
import { RuleDocumentValidationError, validateRulePackDocument } from './ruleDocumentValidation.js'
import { evaluateZenRuleModel } from './zenRuleEngine.js'

const fixtureId = '91488688-a841-4cbc-8a0c-9014efee7b37'

function chargeDecisionGraph(nodeType = 'decisionTableNode') {
  return {
    contentType: 'application/vnd.gorules.decision',
    edges: [
      { id: 'edge-1', type: 'edge', sourceId: 'input', targetId: 'charges' },
      { id: 'edge-2', type: 'edge', sourceId: 'charges', targetId: 'output' }
    ],
    nodes: [
      { id: 'input', name: 'Request', type: 'inputNode', position: { x: 0, y: 0 } },
      {
        id: 'charges',
        name: 'Charge eligibility',
        type: nodeType,
        position: { x: 200, y: 0 },
        content: {
          hitPolicy: 'first',
          inputs: [
            {
              id: 'remaining',
              name: 'Remaining charges',
              type: 'expression',
              field: 'remainingCharges'
            }
          ],
          outputs: [
            {
              id: 'allowed',
              name: 'Allowed',
              type: 'expression',
              field: 'eligibility.allowed'
            },
            {
              id: 'reason',
              name: 'Reason',
              type: 'expression',
              field: 'eligibility.reasonCode'
            },
            { id: 'rolls', name: 'Rolls', type: 'expression', field: 'rollRequests' },
            { id: 'outcomes', name: 'Outcomes', type: 'expression', field: 'outcomes' }
          ],
          rules: [
            {
              _id: 'available',
              remaining: '> 0',
              allowed: 'true',
              reason: '"ALLOWED"',
              rolls: '[]',
              outcomes: '[]'
            },
            {
              _id: 'empty',
              remaining: '',
              allowed: 'false',
              reason: '"NO_CHARGES"',
              rolls: '[]',
              outcomes: '[]'
            }
          ]
        }
      },
      { id: 'output', name: 'Response', type: 'outputNode', position: { x: 400, y: 0 } }
    ]
  }
}

function document(expectedAllowed = false): RulePackDocumentDto {
  return rulePackDocumentDtoSchema.parse({
    schemaVersion: 1,
    models: { 'charge-eligibility': chargeDecisionGraph() },
    fixtures: [
      {
        id: fixtureId,
        label: 'Insufficient feature charges',
        modelKey: 'charge-eligibility',
        input: { remainingCharges: 0 },
        expected: {
          eligibility: { allowed: expectedAllowed, reasonCode: 'NO_CHARGES' },
          rollRequests: [],
          outcomes: []
        }
      }
    ]
  })
}

describe('Zen rule adapter', () => {
  it('evaluates a bounded decision model with trace evidence', async () => {
    const result = await evaluateZenRuleModel({
      document: document(),
      modelKey: 'charge-eligibility',
      context: { remainingCharges: 1 },
      trace: true
    })

    expect(ruleEvaluationDtoSchema.parse(result.result)).toEqual({
      eligibility: { allowed: true, reasonCode: 'ALLOWED' },
      rollRequests: [],
      outcomes: []
    })
    expect(result.trace).not.toBeNull()
  })

  it('rejects executable function nodes before Zen sees them', () => {
    const unsafe = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: { unsafe: chargeDecisionGraph('functionNode') },
      fixtures: []
    })

    expect(() => validateRulePackDocument(unsafe)).toThrow(RuleDocumentValidationError)
  })

  it('hashes equivalent JSON independently of object key order', () => {
    expect(checksumRuleDocument({ a: 1, b: { c: 2 } })).toBe(
      checksumRuleDocument({ b: { c: 2 }, a: 1 })
    )
  })

  it('uses locale-independent code-point order for immutable checksums', () => {
    expect(checksumRuleDocument({ Z: 1, a: 2, _: 3 })).toBe(
      '14f90836f639d14343eb8b8995a382f642bf53e53483c439cc6693aa573cab32'
    )
  })

  it('rejects decision nodes that reference a missing model', () => {
    const graph = chargeDecisionGraph()
    const unsafe = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: {
        entry: {
          ...graph,
          nodes: [
            ...graph.nodes,
            {
              id: 'nested',
              name: 'Nested decision',
              type: 'decisionNode',
              position: { x: 100, y: 0 },
              content: { key: 'missing' }
            }
          ]
        }
      },
      fixtures: []
    })

    expect(() => validateRulePackDocument(unsafe)).toThrow(/missing model/)
  })

  it('requires fixture output to match before activation', async () => {
    await expect(assertRulePackConformance(document())).resolves.toBeUndefined()
    await expect(assertRulePackConformance(document(true))).rejects.toBeInstanceOf(
      RuleConformanceError
    )
  })
})

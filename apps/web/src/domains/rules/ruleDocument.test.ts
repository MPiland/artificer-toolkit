import { describe, expect, it } from 'vitest'

import {
  addRuleModel,
  createDefaultRuleDocument,
  parseRuleDocument,
  removeRuleModel,
  renameRuleModel
} from './ruleDocument'

describe('Rule Studio document helpers', () => {
  it('creates a connected input/output model', () => {
    expect(createDefaultRuleDocument().models.main).toMatchObject({
      nodes: [{ type: 'inputNode' }, { type: 'outputNode' }],
      edges: [{ sourceId: 'input', targetId: 'output' }]
    })
  })

  it('keeps fixture references aligned when a model is renamed', () => {
    const document = addRuleModel(createDefaultRuleDocument(), 'attack')
    const renamed = renameRuleModel(
      {
        ...document,
        fixtures: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            label: 'Attack fixture',
            modelKey: 'attack',
            input: {},
            expected: {}
          }
        ]
      },
      'attack',
      'melee-attack'
    )

    expect(renamed.models).toHaveProperty('melee-attack')
    expect(renamed.fixtures[0]?.modelKey).toBe('melee-attack')
  })

  it('removes fixtures owned by a removed model', () => {
    const document = addRuleModel(createDefaultRuleDocument(), 'attack')
    const removed = removeRuleModel(
      {
        ...document,
        fixtures: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            label: 'Attack fixture',
            modelKey: 'attack',
            input: {},
            expected: {}
          }
        ]
      },
      'attack'
    )

    expect(removed.fixtures).toEqual([])
    expect(removed.models).not.toHaveProperty('attack')
  })

  it('rejects imported documents with invalid model keys', () => {
    expect(() =>
      parseRuleDocument(JSON.stringify({ schemaVersion: 1, models: { Invalid: {} }, fixtures: [] }))
    ).toThrow()
  })
})

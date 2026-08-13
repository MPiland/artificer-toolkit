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
    document.models.main = {
      ...document.models.main,
      nodes: [
        ...(document.models.main as { nodes: unknown[] }).nodes,
        {
          id: 'attack-decision',
          type: 'decisionNode',
          name: 'Attack',
          position: { x: 180, y: 120 },
          content: { key: 'attack' }
        }
      ]
    }
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
    expect(renamed.models.main).toMatchObject({
      nodes: expect.arrayContaining([expect.objectContaining({ content: { key: 'melee-attack' } })])
    })
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

  it('does not remove a model while another model references it', () => {
    const document = addRuleModel(createDefaultRuleDocument(), 'attack')
    document.models.main = {
      ...document.models.main,
      nodes: [
        ...(document.models.main as { nodes: unknown[] }).nodes,
        {
          id: 'attack-decision',
          type: 'decisionNode',
          name: 'Attack',
          position: { x: 180, y: 120 },
          content: { key: 'attack' }
        }
      ]
    }

    expect(() => removeRuleModel(document, 'attack')).toThrow(
      'Model "attack" is referenced by model "main".'
    )
  })

  it('rejects imported documents with invalid model keys', () => {
    expect(() =>
      parseRuleDocument(JSON.stringify({ schemaVersion: 1, models: { Invalid: {} }, fixtures: [] }))
    ).toThrow()
  })
})

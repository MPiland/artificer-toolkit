import { describe, expect, it } from 'vitest'
import type { RulePackDocumentDto } from '#app/lib/api'

import {
  addRuleModel,
  createDefaultRuleDocument,
  getVisibleRuleFixtures,
  getVisibleRuleModelKeys,
  isReservedRuleModelKey,
  mergeImportedRuleDocument,
  parseRuleDocument,
  removeRuleModel,
  renameRuleModel
} from './ruleDocument'

function addModelReference(document: RulePackDocumentDto, modelKey: string) {
  const model = document.models.main
  if (!model || typeof model !== 'object' || Array.isArray(model) || !Array.isArray(model.nodes)) {
    throw new Error('Expected the default main graph model.')
  }
  document.models.main = {
    ...model,
    nodes: [
      ...model.nodes,
      {
        id: `${modelKey}-decision`,
        type: 'decisionNode',
        name: modelKey,
        position: { x: 180, y: 120 },
        content: { key: modelKey }
      }
    ]
  }
}

describe('Rule Studio document helpers', () => {
  it('creates a connected input/output model', () => {
    expect(createDefaultRuleDocument().models.main).toMatchObject({
      nodes: [{ type: 'inputNode' }, { type: 'outputNode' }],
      edges: [{ sourceId: 'input', targetId: 'output' }]
    })
  })

  it('keeps fixture references aligned when a model is renamed', () => {
    const document = addRuleModel(createDefaultRuleDocument(), 'attack')
    addModelReference(document, 'attack')
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

  it('hides the reserved model and fixtures from Rule Studio selectors', () => {
    const base = createDefaultRuleDocument()
    const document: RulePackDocumentDto = {
      ...base,
      models: {
        ...base.models,
        'character-grant-fold': base.models.main,
        'character-action-resolve': base.models.main,
        'encounter-actor-policy': base.models.main
      },
      fixtures: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          label: 'Reserved fixture',
          modelKey: 'character-grant-fold',
          input: { actorId: 1 },
          expected: {}
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          label: 'Reserved action fixture',
          modelKey: 'character-action-resolve',
          input: {},
          expected: {}
        },
        {
          id: '00000000-0000-4000-8000-000000000004',
          label: 'Reserved Encounter actor fixture',
          modelKey: 'encounter-actor-policy',
          input: {},
          expected: {}
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          label: 'Main fixture',
          modelKey: 'main',
          input: {},
          expected: {}
        }
      ]
    }

    expect(getVisibleRuleModelKeys(document)).not.toContain('character-grant-fold')
    expect(getVisibleRuleModelKeys(document)).not.toContain('character-action-resolve')
    expect(getVisibleRuleModelKeys(document)).not.toContain('encounter-actor-policy')
    expect(getVisibleRuleFixtures(document).map((fixture) => fixture.id)).toEqual([
      '00000000-0000-4000-8000-000000000002'
    ])
  })

  it('preserves reserved model payloads during add, rename, remove, and parse operations', () => {
    const reservedModel = createDefaultRuleDocument().models.main
    const reservedFixtureId = '11111111-1111-4111-8111-111111111111'
    const reservedFixture = {
      id: reservedFixtureId,
      label: 'Reserved fixture',
      modelKey: 'character-grant-fold',
      input: { subjectId: 99 },
      expected: {}
    }
    const combatFixtureId = '11111111-1111-4111-8111-111111111112'
    const removableFixtureId = '11111111-1111-4111-8111-111111111113'
    const document = {
      ...createDefaultRuleDocument(),
      models: {
        ...createDefaultRuleDocument().models,
        'character-grant-fold': reservedModel
      },
      fixtures: [
        reservedFixture,
        {
          id: combatFixtureId,
          label: 'Combat fixture',
          modelKey: 'attack',
          input: { source: 1 },
          expected: {}
        }
      ]
    }
    const addAttack = addRuleModel(document, 'attack')
    const renamed = renameRuleModel(addAttack, 'attack', 'battle-attack')
    const parseRoundTrip = parseRuleDocument(JSON.stringify(renamed))
    const removed = removeRuleModel(
      {
        ...renamed,
        fixtures: [
          ...renamed.fixtures,
          {
            id: removableFixtureId,
            label: 'Removable fixture',
            modelKey: 'battle-attack',
            input: { subjectId: 2 },
            expected: {}
          }
        ]
      },
      'battle-attack'
    )
    const reparsed = parseRuleDocument(JSON.stringify(removed))

    expect(parseRoundTrip.models['character-grant-fold']).toEqual(
      removed.models['character-grant-fold']
    )
    expect(parseRoundTrip.fixtures.find((fixture) => fixture.id === reservedFixtureId)).toEqual(
      reparsed.fixtures.find((fixture) => fixture.id === reservedFixtureId)
    )
    expect(parseRoundTrip.fixtures.find((fixture) => fixture.id === reservedFixtureId)).toEqual(
      reservedFixture
    )
    expect(renamed.fixtures.find((fixture) => fixture.id === combatFixtureId)?.modelKey).toBe(
      'battle-attack'
    )
    expect(removed.fixtures.find((fixture) => fixture.id === combatFixtureId)).toBeUndefined()
    expect(reparsed.models['character-grant-fold']).toEqual(reservedModel)
    expect(isReservedRuleModelKey('character-grant-fold')).toBe(true)
  })

  it('replaces visible content while preserving current reserved import content', () => {
    const currentBase = createDefaultRuleDocument()
    const reservedModel = currentBase.models.main
    const reservedFixture = {
      id: '11111111-1111-4111-8111-111111111121',
      label: 'Reserved fixture',
      modelKey: 'character-grant-fold',
      input: { subjectId: 99 },
      expected: {}
    }
    const reservedActionFixture = {
      id: '11111111-1111-4111-8111-111111111123',
      label: 'Reserved action fixture',
      modelKey: 'character-action-resolve',
      input: {},
      expected: []
    }
    const current: RulePackDocumentDto = {
      ...currentBase,
      models: {
        ...currentBase.models,
        'character-grant-fold': reservedModel,
        'character-action-resolve': reservedModel
      },
      fixtures: [reservedFixture, reservedActionFixture]
    }
    const importedBase = createDefaultRuleDocument()
    const imported: RulePackDocumentDto = {
      ...importedBase,
      models: { replacement: importedBase.models.main },
      fixtures: [
        {
          id: '11111111-1111-4111-8111-111111111122',
          label: 'Replacement fixture',
          modelKey: 'replacement',
          input: {},
          expected: {}
        }
      ]
    }

    const merged = mergeImportedRuleDocument(current, imported)

    expect(Object.keys(merged.models)).toEqual([
      'replacement',
      'character-grant-fold',
      'character-action-resolve'
    ])
    expect(merged.models).not.toHaveProperty('main')
    expect(merged.models['character-grant-fold']).toBe(reservedModel)
    expect(merged.models['character-action-resolve']).toBe(reservedModel)
    expect(merged.fixtures).toEqual([reservedFixture, reservedActionFixture, imported.fixtures[0]])
  })

  it('prevents adding a reserved model key', () => {
    const document = createDefaultRuleDocument()
    expect(() => addRuleModel(document, 'character-grant-fold')).toThrow('reserved')
    expect(() => addRuleModel(document, 'character-action-resolve')).toThrow('reserved')
    expect(() => addRuleModel(document, 'encounter-actor-policy')).toThrow('reserved')
  })

  it('prevents renaming to or from the reserved model key', () => {
    const base = createDefaultRuleDocument()
    const document = {
      ...base,
      models: {
        ...base.models,
        attack: base.models.main
      }
    }
    expect(() => renameRuleModel(document, 'main', 'character-grant-fold')).toThrow('reserved')
    const fromReserved = {
      ...document,
      models: {
        ...document.models,
        'character-grant-fold': base.models.main,
        attack: base.models.main
      }
    }
    expect(() => renameRuleModel(fromReserved, 'character-grant-fold', 'attack')).toThrow(
      'reserved'
    )
  })

  it('prevents removing the reserved model', () => {
    const base = createDefaultRuleDocument()
    const document = {
      ...base,
      models: {
        ...base.models,
        'character-grant-fold': base.models.main
      }
    }
    expect(() => removeRuleModel(document, 'character-grant-fold')).toThrow('reserved')
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
    addModelReference(document, 'attack')

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

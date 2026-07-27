import { describe, expect, it } from 'vitest'
import { buildNodeMap } from '../utils/nodeDefinition.js'
import { clearValuesAtPaths, evaluateConditionIf, resolveIdRef } from '../utils/nodeRuntime.js'

describe('node runtime shared helpers', () => {
  it('evaluates local, parent, and ancestor conditions', () => {
    const scope = {
      values: { category: 'WEAPON', tags: ['FINESSE'] },
      parentValues: { selectionKind: 'CHOSEN' },
      ancestors: [{ source: 'CLASS' }]
    }

    expect(
      evaluateConditionIf(
        { kind: 'PREDICATE', from: 'LOCAL', path: ['category'], op: '=', value: 'WEAPON' },
        scope
      )
    ).toBe(true)
    expect(
      evaluateConditionIf(
        {
          kind: 'PREDICATE',
          from: 'PARENT',
          path: ['selectionKind'],
          op: '=',
          value: 'CHOSEN'
        },
        scope
      )
    ).toBe(true)
    expect(
      evaluateConditionIf(
        {
          kind: 'PREDICATE',
          from: 'ANCESTOR',
          up: 1,
          path: ['source'],
          op: '=',
          value: 'CLASS'
        },
        scope
      )
    ).toBe(true)
    expect(
      evaluateConditionIf(
        {
          kind: 'PREDICATE',
          from: 'LOCAL',
          path: ['tags'],
          op: 'contains',
          value: ['FINESSE']
        },
        scope
      )
    ).toBe(true)
  })

  it('evaluates discriminated boolean condition expressions', () => {
    const predicate = {
      kind: 'PREDICATE',
      from: 'LOCAL',
      path: ['category'],
      op: '=',
      value: 'WEAPON'
    } as const

    expect(
      evaluateConditionIf(
        {
          kind: 'AND',
          expressions: [predicate, { kind: 'NOT', expression: { kind: 'OR', expressions: [] } }]
        },
        { values: { category: 'WEAPON' } }
      )
    ).toBe(true)
  })

  it('rejects legacy property-presence condition expressions', () => {
    expect(() =>
      evaluateConditionIf(
        // @ts-expect-error Legacy condition expressions are intentionally unsupported.
        { and: [] },
        { values: {} }
      )
    ).toThrow('Unknown condition expression kind')
  })

  it('clears hidden values without mutating the original draft', () => {
    const draft = {
      category: 'CURRENCY',
      equipmentIds: ['longsword'],
      currencies: [{ currencyId: 'gp', amount: 10 }]
    }

    const result = clearValuesAtPaths(draft, [['equipmentIds'], ['currencies', 0, 'amount']])

    expect(result).toEqual({
      values: {
        category: 'CURRENCY',
        currencies: [{ currencyId: 'gp' }]
      },
      clearedPaths: [['equipmentIds'], ['currencies', 0, 'amount']]
    })
    expect(draft.equipmentIds).toEqual(['longsword'])
    expect(draft.currencies[0]?.amount).toBe(10)
  })

  it('resolves id refs against scoped runtime values', () => {
    expect(
      resolveIdRef(
        { from: 'LOCAL', path: ['equipmentIds'] },
        { values: { equipmentIds: ['longsword'] } }
      )
    ).toEqual(['longsword'])
  })

  it('treats ALL or a missing authoring mode as an unrestricted scope', () => {
    type ScopedDraft = {
      authoringModeKind?: 'ALL' | 'SELECTED'
      ids?: string[]
      sentinel?: string
    }
    const nodeMap = buildNodeMap<ScopedDraft>().define(
      'scope-regression',
      ({ map, nodes, cond }) => {
        map.set(
          'sentinel',
          nodes.text(['sentinel'], 'Sentinel', {
            showIf: cond.local().scope(['ids']).allOrMissing
          })
        )
      }
    )
    const showIf = nodeMap.nodes.sentinel.showIf

    expect(showIf).toBeDefined()
    expect(evaluateConditionIf(showIf!, { values: {} })).toBe(true)
    expect(evaluateConditionIf(showIf!, { values: { authoringModeKind: 'ALL' } })).toBe(true)
    expect(
      evaluateConditionIf(showIf!, { values: { authoringModeKind: 'SELECTED', ids: ['one'] } })
    ).toBe(false)
  })
})

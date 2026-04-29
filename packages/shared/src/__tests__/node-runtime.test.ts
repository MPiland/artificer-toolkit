import { describe, expect, it } from 'vitest'
import { clearValuesAtPaths, evaluateConditionIf, resolveIdRef } from '../utils/nodeRuntime.js'

describe('node runtime shared helpers', () => {
  it('evaluates local, parent, and ancestor conditions', () => {
    const scope = {
      values: { category: 'WEAPON', tags: ['FINESSE'] },
      parentValues: { selectionKind: 'CHOSEN' },
      ancestors: [{ source: 'CLASS' }]
    }

    expect(evaluateConditionIf({ from: 'LOCAL', path: ['category'], op: '=', value: 'WEAPON' }, scope)).toBe(true)
    expect(evaluateConditionIf({ from: 'PARENT', path: ['selectionKind'], op: '=', value: 'CHOSEN' }, scope)).toBe(true)
    expect(evaluateConditionIf({ from: 'ANCESTOR', up: 1, path: ['source'], op: '=', value: 'CLASS' }, scope)).toBe(true)
    expect(evaluateConditionIf({ from: 'LOCAL', path: ['tags'], op: 'contains', value: ['FINESSE'] }, scope)).toBe(true)
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
    expect(resolveIdRef(
      { from: 'LOCAL', path: ['equipmentIds'] },
      { values: { equipmentIds: ['longsword'] } }
    )).toEqual(['longsword'])
  })
})

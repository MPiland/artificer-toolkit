import { describe, expect, it } from 'vitest'

import { selectScalingRow } from '../scalingRowSelection.js'

const row = (level: number | null, order: number, label: string) => ({ level, order, label })

describe('selectScalingRow', () => {
  const rows = [row(1, 0, 'one'), row(5, 1, 'five'), row(3, 2, 'three'), row(11, 3, 'eleven')]

  it.each([
    [1, 'one'],
    [2, 'one'],
    [3, 'three'],
    [4, 'three'],
    [5, 'five'],
    [10, 'five'],
    [11, 'eleven'],
    [20, 'eleven']
  ])('selects the highest row at or below level %i', (level, label) => {
    expect(selectScalingRow(rows, level)?.label).toBe(label)
  })

  it('returns null when every row sits above the bound level', () => {
    expect(selectScalingRow(rows, 0)).toBeNull()
  })

  it('returns null for no rows', () => {
    expect(selectScalingRow([], 5)).toBeNull()
  })

  it('breaks a tie on level by the lowest order', () => {
    expect(selectScalingRow([row(3, 4, 'late'), row(3, 1, 'early')], 3)?.label).toBe('early')
  })

  it('skips rows without a numeric level', () => {
    expect(selectScalingRow([row(null, 0, 'unleveled'), row(2, 1, 'two')], 4)?.label).toBe('two')
  })
})

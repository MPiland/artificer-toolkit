import { describe, expect, it } from 'vitest'
import {
  getCollectionItemIdentity,
  moveAndRenumberCollectionRows,
  renumberCollectionRows
} from './collectionOrdering'

describe('authoring collection ordering', () => {
  it('requires a stable identity for manually ordered rows', () => {
    expect(() =>
      getCollectionItemIdentity(
        { label: 'Missing identity' },
        0,
        { mode: 'manual', identityPath: ['id'] }
      )
    ).toThrow('Manual collection row 1 is missing stable identity field "id".')
  })

  it('moves a row and renumbers the declared order field', () => {
    const rows = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 }
    ]

    expect(moveAndRenumberCollectionRows(rows, 2, 0, ['order'])).toEqual([
      { id: 'c', order: 1 },
      { id: 'a', order: 2 },
      { id: 'b', order: 3 }
    ])
    expect(rows).toEqual([
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 }
    ])
  })

  it('preserves row values when order is resolver-derived', () => {
    const rows = [{ id: 'a', order: 8 }, { id: 'b', order: 3 }]

    expect(renumberCollectionRows(rows, undefined)).toEqual(rows)
    expect(getCollectionItemIdentity(rows[0], 0, { mode: 'derived' })).toBe('a')
  })
})

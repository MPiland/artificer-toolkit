import { describe, expect, it } from 'vitest'

import { rangeDtoSchema } from '../shared/range.js'

/** A Lance's reach (D217): disadvantage within its close range, so the close range sits inside the normal one. */
const reach = { id: 'range', rangeKind: 'DISTANCE', amount: 10, unit: 'FEET' }

describe('a DISTANCE range’s close range', () => {
  it('accepts a close range inside the normal range', () => {
    expect(rangeDtoSchema.safeParse({ ...reach, closeAmount: 5 }).success).toBe(true)
  })

  it.each([10, 15])(
    'rejects a close range of %i ft, which leaves no range without disadvantage',
    (closeAmount) => {
      expect(rangeDtoSchema.safeParse({ ...reach, closeAmount }).success).toBe(false)
    }
  )
})

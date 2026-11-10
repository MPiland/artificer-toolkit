import { describe, expect, it } from 'vitest'

import { resourcePoolSpend } from '../character/resourcePoolSpend.js'

/** QUALITY-12.1: a Sheet command and an Encounter action spend a pool by this one rule (D11). */
describe('a Resource pool spend', () => {
  it('takes the whole cost from a pool that covers it', () => {
    expect(resourcePoolSpend({ used: 1, remaining: 3 }, 2, false)).toEqual({
      spent: 2,
      afterUsed: 3,
      afterRemaining: 1
    })
    expect(resourcePoolSpend({ used: 1, remaining: 3 }, 3, true)).toEqual({
      spent: 3,
      afterUsed: 4,
      afterRemaining: 0
    })
  })

  it('refuses a cost the pool cannot cover', () => {
    expect(resourcePoolSpend({ used: 3, remaining: 1 }, 2, false)).toBeNull()
    expect(resourcePoolSpend({ used: 4, remaining: 0 }, 1, false)).toBeNull()
  })

  it('takes only what remains when the shortfall is overridden', () => {
    expect(resourcePoolSpend({ used: 3, remaining: 1 }, 2, true)).toEqual({
      spent: 1,
      afterUsed: 4,
      afterRemaining: 0
    })
    expect(resourcePoolSpend({ used: 4, remaining: 0 }, 1, true)).toEqual({
      spent: 0,
      afterUsed: 4,
      afterRemaining: 0
    })
  })
})

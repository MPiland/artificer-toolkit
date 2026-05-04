import { describe, expect, it } from 'vitest'

import { characterSheetCommandInputDtoSchema } from '../api/characters.js'

describe('character sheet command contracts', () => {
  it('rejects fractional currency adjustments', () => {
    expect(characterSheetCommandInputDtoSchema.safeParse({
      type: 'ADJUST_CURRENCY',
      expectedVersion: 1,
      currencyId: 'currency-1',
      amount: 0.5
    }).success).toBe(false)
  })

  it('accepts integer currency adjustments', () => {
    expect(characterSheetCommandInputDtoSchema.safeParse({
      type: 'ADJUST_CURRENCY',
      expectedVersion: 1,
      currencyId: 'currency-1',
      amount: -5
    }).success).toBe(true)
  })
})

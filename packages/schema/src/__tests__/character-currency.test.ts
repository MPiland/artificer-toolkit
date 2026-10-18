import { describe, expect, it } from 'vitest'

import { characterCurrencyAmountDtoSchema } from '../shared/characterCurrency.js'

const campaignCurrencySystemId = '00000000-0000-4000-8000-000000000001'

describe('Character currency holdings', () => {
  it('names the kind of every holding', () => {
    expect(
      characterCurrencyAmountDtoSchema.safeParse({ currencyId: 'gp', kind: 'RULESET', amount: 4 })
        .success
    ).toBe(true)
    expect(
      characterCurrencyAmountDtoSchema.safeParse({
        currencyId: 'crown',
        kind: 'CAMPAIGN',
        campaignCurrencySystemId,
        amount: 4
      }).success
    ).toBe(true)
    expect(
      characterCurrencyAmountDtoSchema.safeParse({ currencyId: 'gp', amount: 4 }).success
    ).toBe(false)
    expect(
      characterCurrencyAmountDtoSchema.safeParse({
        currencyId: 'crown',
        campaignCurrencySystemId,
        amount: 4
      }).success
    ).toBe(false)
  })
})

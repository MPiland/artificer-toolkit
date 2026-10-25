import { createCurrencyGroup, selectCurrency, setCurrencyAmount } from './manualCurrency'

describe('manual currency groups', () => {
  it('starts with one ruleset currency that has no Currency chosen', () => {
    expect(createCurrencyGroup().currencies).toEqual([
      { kind: 'RULESET', currencyId: '', amount: 0 }
    ])
  })

  it('selects a Currency and keeps the entered amount', () => {
    const group = setCurrencyAmount(createCurrencyGroup(), 7)

    expect(selectCurrency(group, 'gold').currencies).toEqual([
      { kind: 'RULESET', currencyId: 'gold', amount: 7 }
    ])
  })

  it('ignores a cleared select instead of writing an empty Currency id', () => {
    const group = selectCurrency(createCurrencyGroup(), 'gold')

    expect(selectCurrency(group, null)).toBe(group)
  })

  it('sets the amount without changing the chosen Currency', () => {
    const group = selectCurrency(createCurrencyGroup(), 'gold')

    expect(setCurrencyAmount(group, 12).currencies).toEqual([
      { kind: 'RULESET', currencyId: 'gold', amount: 12 }
    ])
  })
})

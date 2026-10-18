import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'
import { srdSystemRecord } from './vocabulary.js'

const { equipment } = srdBaselineContent.subjects

describe('SRD equipment prices', () => {
  it.each([
    { label: 'Club', amount: 1, currency: 'Silver Piece' },
    { label: 'Candle', amount: 1, currency: 'Copper Piece' },
    { label: 'Longsword', amount: 15, currency: 'Gold Piece' }
  ])('prices the $label in $currency', ({ label, amount, currency }) => {
    const item = equipment.find((entry) => entry.label === label)
    if (!item || item.category === 'VARIANT' || !item.cost)
      throw new Error(`Expected a priced SRD ${label}.`)
    expect(item.cost.amount).toBe(amount)
    expect(srdSystemRecord.currencies.find(({ id }) => id === item.cost?.currencyId)?.label).toBe(
      currency
    )
  })
})

import type { CharacterSheet } from './CharacterSheet.types'

export function getInventoryCurrencyTotals(sheet: CharacterSheet) {
  const totals = new Map<string, number>()
  for (const currency of sheet.inventory.currencies) {
    totals.set(currency.currencyId, (totals.get(currency.currencyId) ?? 0) + currency.amount)
  }

  return sheet.reference.currencyOptions.map((currency) => ({
    id: currency.id,
    label: currency.label,
    amount: totals.get(currency.id) ?? 0
  }))
}

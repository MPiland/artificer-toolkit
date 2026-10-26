import type { CharacterFormValues } from '../../core/characterBuilder.types'

type CurrencyGroup = CharacterFormValues['state']['currency'][number]

export function createCurrencyGroup(): CurrencyGroup {
  return {
    id: crypto.randomUUID(),
    currencies: [{ kind: 'RULESET', currencyId: '', amount: 0 }]
  }
}

/** A cleared select is not a Currency: keep the group as it was instead of writing an empty id. */
export function selectCurrency(group: CurrencyGroup, currencyId: string | null): CurrencyGroup {
  if (!currencyId) return group
  return {
    ...group,
    currencies: [{ kind: 'RULESET', currencyId, amount: group.currencies[0]?.amount ?? 0 }]
  }
}

export function setCurrencyAmount(group: CurrencyGroup, amount: number): CurrencyGroup {
  const [first] = group.currencies
  return {
    ...group,
    currencies: [{ ...(first ?? { kind: 'RULESET', currencyId: '' }), amount }]
  }
}

import type { CharacterSheetInventoryDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import type { CharacterCurrencyIdentityDto } from '@artificer-toolkit/schema/shared/characterCurrency'
import {
  characterCurrencyIdentity,
  createCharacterCurrencyIdentityKey,
  currencyOptionIdentity
} from '@artificer-toolkit/schema/shared/characterCurrency'

function currencyOptionsByKey(sheet: CharacterSheetInventoryDto) {
  return new Map(
    sheet.reference.currencyOptions.map((option) => {
      const identity = currencyOptionIdentity(option)
      return [
        createCharacterCurrencyIdentityKey(identity),
        { identity, label: option.label }
      ] as const
    })
  )
}

export function getInventoryCurrencyRows(
  sheet: CharacterSheetInventoryDto,
  currencies = sheet.inventory.currencies
) {
  const rows = new Map<
    string,
    {
      id: string
      label: string
      amount: string
      containerId?: string
      identity: CharacterCurrencyIdentityDto
    }
  >()
  const options = currencyOptionsByKey(sheet)
  for (const currency of currencies) {
    const identity = characterCurrencyIdentity(currency)
    const identityKey = createCharacterCurrencyIdentityKey(identity)
    const key = JSON.stringify([identityKey, currency.containerId ?? null])
    const existing = rows.get(key)
    rows.set(key, {
      id: key,
      label: options.get(identityKey)?.label ?? currency.label ?? currency.currencyId,
      amount: (BigInt(existing?.amount ?? '0') + BigInt(currency.amount)).toString(),
      containerId: currency.containerId,
      identity
    })
  }
  return [...rows.values()]
}

export function getInventoryCurrencyTotals(sheet: CharacterSheetInventoryDto) {
  const totals = new Map<
    string,
    { identity: CharacterCurrencyIdentityDto; label: string; amount: bigint }
  >()
  const options = currencyOptionsByKey(sheet)
  for (const option of options.values()) {
    totals.set(createCharacterCurrencyIdentityKey(option.identity), {
      identity: option.identity,
      label: option.label,
      amount: 0n
    })
  }
  for (const currency of sheet.inventory.currencies) {
    const identity = characterCurrencyIdentity(currency)
    const key = createCharacterCurrencyIdentityKey(identity)
    const existing = totals.get(key)
    totals.set(key, {
      identity,
      label: existing?.label ?? currency.label ?? currency.currencyId,
      amount: (existing?.amount ?? 0n) + BigInt(currency.amount)
    })
  }

  return [...totals.entries()].map(([id, total]) => ({
    id,
    label: total.label,
    amount: total.amount.toString(),
    identity: total.identity
  }))
}

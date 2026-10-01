import type { CharacterSheetInventoryDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import type {
  CampaignDetailDto,
  CampaignContentMaturityDto
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CharacterSheetCurrencyOptionDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  CurrencySystemDto,
  InventoryDto,
  InventoryOwnerRefDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { resolveCharacterCurrencyIdentity } from '@artificer-toolkit/schema/shared/characterCurrency'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'

type VehicleOption = { id: string; label: string | null }
type InventoryCurrency = InventoryDto['currencies'][number]
type InventoryMembership = Pick<
  CampaignDetailDto['memberships'][number],
  'assignedCharacter' | 'userId'
>
type InventoryCampaign = Pick<CampaignDetailDto, 'role'> & {
  memberships: ReadonlyArray<InventoryMembership>
}

export type InventoryCurrencyRow = Omit<InventoryCurrency, 'amount'> & { amount: string }

export function parseOwner(value: string, campaignId: string): InventoryOwnerRefDto {
  if (value === 'PARTY') return { kind: 'CAMPAIGN', campaignId }
  if (value.startsWith('VEHICLE:'))
    return { kind: 'VEHICLE', vehicleId: value.slice('VEHICLE:'.length) }
  return { kind: 'CHARACTER', characterId: value.slice('CHARACTER:'.length) }
}

export function getAuthorizedSourceOwners(
  campaign: InventoryCampaign,
  currentUserId: string,
  vehicles: ReadonlyArray<VehicleOption>
) {
  const memberships =
    campaign.role === 'OWNER'
      ? campaign.memberships
      : campaign.memberships.filter((member) => member.userId === currentUserId)
  return [
    { value: 'PARTY', label: 'Party inventory' },
    ...memberships.flatMap((member) =>
      member.assignedCharacter
        ? [
            {
              value: `CHARACTER:${member.assignedCharacter.id}`,
              label: member.assignedCharacter.label
            }
          ]
        : []
    ),
    ...vehicles.map((vehicle) => ({
      value: `VEHICLE:${vehicle.id}`,
      label: vehicle.label ?? 'Campaign Vehicle'
    }))
  ]
}

export function getTransferDestinationOwners(
  campaign: InventoryCampaign,
  vehicles: ReadonlyArray<VehicleOption>
) {
  return [
    { value: 'PARTY', label: 'Party inventory' },
    ...campaign.memberships.flatMap((member) =>
      member.assignedCharacter
        ? [
            {
              value: `CHARACTER:${member.assignedCharacter.id}`,
              label: member.assignedCharacter.label
            }
          ]
        : []
    ),
    ...vehicles.map((vehicle) => ({
      value: `VEHICLE:${vehicle.id}`,
      label: vehicle.label ?? 'Campaign Vehicle'
    }))
  ]
}

export function inventoryCurrencyKey(
  currency: Pick<InventoryCurrency, 'kind' | 'campaignCurrencySystemId' | 'denominationId'>
): string {
  return JSON.stringify([
    currency.kind ?? null,
    currency.campaignCurrencySystemId ?? null,
    currency.denominationId
  ])
}

export function aggregateInventoryCurrencies(
  currencies: ReadonlyArray<InventoryCurrency>
): InventoryCurrencyRow[] {
  const rows = new Map<string, InventoryCurrencyRow>()
  for (const currency of currencies) {
    const key = JSON.stringify([inventoryCurrencyKey(currency), currency.containerId ?? null])
    const existing = rows.get(key)
    rows.set(key, {
      ...currency,
      amount: (BigInt(existing?.amount ?? '0') + BigInt(currency.amount)).toString()
    })
  }
  return [...rows.values()]
}

export function getCurrentCurrencyOptions(
  system: SystemAuthoredDto | null | undefined,
  currencySystems: ReadonlyArray<CurrencySystemDto>,
  maturity: CampaignContentMaturityDto
): InventoryDto['currencies'] {
  return [
    ...(system?.currencies.map((currency) => ({
      kind: 'RULESET' as const,
      denominationId: currency.id,
      label: presentCampaignPlainText(currency.label, maturity),
      abbreviation: presentCampaignPlainText(currency.short ?? currency.code, maturity),
      amount: 0,
      containerId: null
    })) ?? []),
    ...currencySystems.flatMap((system) =>
      system.denominations.map((denomination) => ({
        kind: 'CAMPAIGN' as const,
        campaignCurrencySystemId: system.id,
        denominationId: denomination.id,
        label: denomination.label,
        abbreviation: denomination.abbreviation,
        amount: 0,
        containerId: null
      }))
    )
  ]
}

function currentCurrencyReferences(
  options: ReadonlyArray<InventoryCurrency>
): CharacterSheetCurrencyOptionDto[] {
  return options.map((option) => ({
    id: option.denominationId,
    label: option.label,
    kind: option.kind,
    ...(option.kind === 'CAMPAIGN' && option.campaignCurrencySystemId
      ? { campaignCurrencySystemId: option.campaignCurrencySystemId }
      : {})
  }))
}

export function getCharacterInventoryCurrencies(
  currencies: CharacterSheetResponseDto['inventory']['currencies'],
  currencyOptions: ReadonlyArray<InventoryCurrency>
): { currencies?: InventoryDto['currencies']; error?: string } {
  const optionByKey = new Map(
    currencyOptions.map((option) => [inventoryCurrencyKey(option), option])
  )
  try {
    const inventoryCurrencies: InventoryDto['currencies'] = []
    for (const currency of currencies) {
      const identity = resolveCharacterCurrencyIdentity(
        currency,
        currentCurrencyReferences(currencyOptions),
        'PRESERVE'
      )
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.currencyId)
      )
        return {
          error: `Character inventory contains legacy non-UUID currency "${identity.currencyId}".`
        }
      const option = optionByKey.get(
        JSON.stringify([
          identity.kind ?? null,
          identity.campaignCurrencySystemId ?? null,
          identity.currencyId
        ])
      )
      inventoryCurrencies.push({
        kind: identity.kind,
        ...(identity.kind === 'CAMPAIGN'
          ? { campaignCurrencySystemId: identity.campaignCurrencySystemId }
          : {}),
        denominationId: identity.currencyId,
        label: option?.label ?? currency.label,
        abbreviation: option?.abbreviation ?? currency.label,
        amount: currency.amount,
        containerId: currency.containerId ?? null
      })
    }
    return { currencies: inventoryCurrencies }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Character inventory currency could not be resolved.'
    }
  }
}

export function getCharacterInventory(
  sheet: CharacterSheetInventoryDto,
  owner: InventoryOwnerRefDto,
  currencyOptions: ReadonlyArray<InventoryCurrency>
): { inventory?: InventoryDto; error?: string } {
  const currencyInventory = getCharacterInventoryCurrencies(
    sheet.inventory.currencies,
    currencyOptions
  )
  if (!currencyInventory.currencies) return { error: currencyInventory.error }
  return {
    inventory: {
      owner,
      version: sheet.meta.streamVersion,
      items: sheet.inventory.items.map((item) => ({
        id: item.id,
        label: item.label,
        quantity: item.quantity,
        containerId: item.containerId ?? null,
        isContainer: Boolean(item.capacity)
      })),
      currencies: currencyInventory.currencies
    }
  }
}

import type {
  CharacterBuilderChoiceOptionDto
} from '@artificer-toolkit/schema/api/characters'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared'
import type { CharacterStartingEquipmentDecision } from '../characterBuilder.utils'

export type StartingEquipmentGroup = StartingEquipmentDto['sets'][number]['groups'][number]
export type StartingEquipmentOption = StartingEquipmentGroup['options'][number]
export type StartingEquipmentItem = StartingEquipmentOption['items'][number]
export type ChosenStartingEquipmentItem = StartingEquipmentItem & {
  startingEquipmentKind: 'EQUIPMENT'
  selectionKind: 'CHOSEN'
  count: number
}

type StartingEquipmentSelection = NonNullable<
  NonNullable<CharacterStartingEquipmentDecision['groups']>[number]['selections']
>[number]

export function setStartingEquipmentGroupOption(
  decision: CharacterStartingEquipmentDecision,
  groupId: string,
  optionId: string
): CharacterStartingEquipmentDecision {
  const groups = decision.groups ?? []
  const hasGroup = groups.some((group) => group.groupId === groupId)
  const nextGroup = {
    groupId,
    optionId,
    selections: []
  }

  return {
    ...decision,
    groups: hasGroup
      ? groups.map((group) => group.groupId === groupId ? nextGroup : group)
      : [...groups, nextGroup]
  }
}

export function setStartingEquipmentSelections(
  decision: CharacterStartingEquipmentDecision,
  groupId: string,
  selectionKey: string,
  equipmentIds: readonly string[]
): CharacterStartingEquipmentDecision {
  const groups = decision.groups ?? []

  return {
    ...decision,
    groups: groups.map((group) => {
      if (group.groupId !== groupId) return group

      const selections = [
        ...(group.selections ?? []).filter((selection) => selection.selectionKey !== selectionKey),
        ...toQuantitySelections(selectionKey, equipmentIds)
      ]

      return {
        ...group,
        selections
      }
    })
  }
}

export function getStartingEquipmentSelections(
  decision: CharacterStartingEquipmentDecision,
  groupId: string,
  selectionKey: string
): string[] {
  return decision.groups
    ?.find((group) => group.groupId === groupId)
    ?.selections
    ?.filter((selection) => selection.selectionKey === selectionKey)
    .flatMap((selection) => expandSelectionQuantity(selection)) ?? []
}

export function getStartingEquipmentItemOptions(
  item: ChosenStartingEquipmentItem,
  equipmentOptions: CharacterBuilderChoiceOptionDto[]
) {
  const allowedIds = 'equipmentIds' in item ? new Set(item.equipmentIds) : null

  return equipmentOptions
    .filter((option) => isEquipmentOptionAllowedForStartingItem(item, option, allowedIds))
    .map((option) => ({
      value: option.id,
      label: option.label,
      disabled: option.disabled
    }))
}

export function formatStartingEquipmentOption(
  option: StartingEquipmentOption,
  equipmentOptions: CharacterBuilderChoiceOptionDto[],
  currencyOptions: CharacterBuilderChoiceOptionDto[]
): string {
  return option.items
    .map((item) => formatStartingEquipmentItem(item, equipmentOptions, currencyOptions))
    .join(' + ') || `Option ${option.order}`
}

export function isStartingEquipmentDecision(value: unknown): value is CharacterStartingEquipmentDecision {
  return Boolean(
    value
    && typeof value === 'object'
    && 'source' in value
    && 'tookGold' in value
  )
}

export function isChosenStartingEquipmentItem(item: StartingEquipmentItem): item is ChosenStartingEquipmentItem {
  return item.startingEquipmentKind === 'EQUIPMENT'
    && 'selectionKind' in item
    && item.selectionKind === 'CHOSEN'
    && 'count' in item
}

function toQuantitySelections(
  selectionKey: string,
  equipmentIds: readonly string[]
): StartingEquipmentSelection[] {
  const quantities = new Map<string, number>()
  const orderedEquipmentIds: string[] = []

  for (const equipmentId of equipmentIds) {
    const normalizedEquipmentId = equipmentId.trim()
    if (!normalizedEquipmentId) continue

    if (!quantities.has(normalizedEquipmentId)) {
      orderedEquipmentIds.push(normalizedEquipmentId)
    }

    quantities.set(normalizedEquipmentId, (quantities.get(normalizedEquipmentId) ?? 0) + 1)
  }

  return orderedEquipmentIds.map((equipmentId) => ({
    selectionKey,
    equipmentId,
    quantity: quantities.get(equipmentId) ?? 1
  }))
}

function expandSelectionQuantity(selection: StartingEquipmentSelection): string[] {
  const quantity = Number.isFinite(selection.quantity)
    ? Math.max(0, Math.trunc(selection.quantity))
    : 0

  return Array.from({ length: quantity }, () => selection.equipmentId)
}

function isEquipmentOptionAllowedForStartingItem(
  item: ChosenStartingEquipmentItem,
  option: CharacterBuilderChoiceOptionDto,
  allowedIds: ReadonlySet<string> | null
): boolean {
  if (allowedIds && !allowedIds.has(option.id)) return false
  if (item.category && option.category !== item.category) return false

  const requiredProperties = item.properties ?? []
  if (requiredProperties.length === 0) return true

  const optionProperties = new Set(option.properties ?? [])
  return requiredProperties.every((property) => optionProperties.has(property))
}

function formatStartingEquipmentItem(
  item: StartingEquipmentItem,
  equipmentOptions: CharacterBuilderChoiceOptionDto[],
  currencyOptions: CharacterBuilderChoiceOptionDto[]
): string {
  if (item.startingEquipmentKind === 'CURRENCY') {
    return item.currencies
      .map((currency) => `${currency.amount} ${findOptionLabel(currencyOptions, currency.currencyId)}`)
      .join(', ')
  }

  const amount = item.selectionKind === 'CHOSEN' ? `choose ${item.count}` : `${item.quantity}`
  const target = 'equipmentIds' in item
    ? item.equipmentIds.map((equipmentId) => findOptionLabel(equipmentOptions, equipmentId)).join(' or ')
    : 'matching equipment'

  return `${amount} ${target}`
}

function findOptionLabel(options: CharacterBuilderChoiceOptionDto[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id
}

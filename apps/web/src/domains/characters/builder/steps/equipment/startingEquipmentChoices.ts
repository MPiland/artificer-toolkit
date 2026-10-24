import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderStartingEquipmentViewDto
} from '@artificer-toolkit/schema/api/characters'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterStartingEquipmentDecision } from '../../core/characterBuilder.types'

export const STARTING_EQUIPMENT_MODE = {
  EQUIPMENT: 'EQUIPMENT',
  GOLD: 'GOLD'
} as const

export type StartingEquipmentGroup = StartingEquipmentDto['sets'][number]['groups'][number]
type StartingEquipmentOption = StartingEquipmentGroup['options'][number]
type StartingEquipmentItem = StartingEquipmentOption['items'][number]
type StartingEquipmentMode = keyof typeof STARTING_EQUIPMENT_MODE
export type StartingGold = NonNullable<CharacterBuilderStartingEquipmentViewDto['startingGold']>
export type ChosenStartingEquipmentItem = StartingEquipmentItem & {
  startingEquipmentKind: 'EQUIPMENT'
  selectionKind: 'CHOSEN'
  count: number
}

type StartingEquipmentSelection = NonNullable<
  NonNullable<CharacterStartingEquipmentDecision['groups']>[number]['selections']
>[number]

const categoryLabels: Record<string, string> = {
  ADVENTURING_GEAR: 'gear',
  ARMOR: 'armor',
  TOOL: 'tool',
  WEAPON: 'weapon'
}

const propertyLabels: Record<string, string> = {
  MARTIAL: 'martial',
  MELEE: 'melee',
  RANGED: 'ranged',
  SIMPLE: 'simple'
}

export function setStartingEquipmentMode(
  decision: CharacterStartingEquipmentDecision,
  source: CharacterBuilderStartingEquipmentViewDto['source'],
  mode: StartingEquipmentMode,
  startingGold: StartingGold | null | undefined
): CharacterStartingEquipmentDecision {
  const nextSource = getStartingEquipmentSource(source)

  if (mode === STARTING_EQUIPMENT_MODE.GOLD && startingGold) {
    return {
      ...decision,
      source: nextSource,
      tookGold: true,
      groups: decision.groups,
      gold: decision.gold ?? createStartingGoldSelection(startingGold, 0)
    }
  }

  return {
    ...decision,
    source: nextSource,
    tookGold: false,
    groups: decision.groups ?? [],
    gold: undefined
  }
}

export function setStartingEquipmentGoldTotal(
  decision: CharacterStartingEquipmentDecision,
  source: CharacterBuilderStartingEquipmentViewDto['source'],
  startingGold: StartingGold,
  totalGold: number
): CharacterStartingEquipmentDecision {
  const nextDecision = setStartingEquipmentMode(
    decision,
    source,
    STARTING_EQUIPMENT_MODE.GOLD,
    startingGold
  )

  return {
    ...nextDecision,
    gold: createStartingGoldSelection(startingGold, totalGold)
  }
}

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
      ? groups.map((group) => (group.groupId === groupId ? nextGroup : group))
      : [...groups, nextGroup]
  }
}

export function ensureDefaultStartingEquipmentGroupOptions(
  decision: CharacterStartingEquipmentDecision,
  startingEquipment: CharacterBuilderStartingEquipmentViewDto['startingEquipment']
): CharacterStartingEquipmentDecision {
  const groups = decision.groups ?? []
  let nextGroups = groups

  for (const group of startingEquipment.sets.flatMap((set) => set.groups)) {
    if (group.options.length !== 1) continue

    const option = group.options[0]
    const existing = nextGroups.find((selection) => selection.groupId === group.id)
    if (existing?.optionId === option.id) continue

    const nextSelection = {
      groupId: group.id,
      optionId: option.id,
      selections: []
    }

    nextGroups = existing
      ? nextGroups.map((selection) => (selection.groupId === group.id ? nextSelection : selection))
      : [...nextGroups, nextSelection]
  }

  return nextGroups === groups
    ? decision
    : {
        ...decision,
        groups: nextGroups
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
  return (
    decision.groups
      ?.find((group) => group.groupId === groupId)
      ?.selections?.filter((selection) => selection.selectionKey === selectionKey)
      .flatMap((selection) => expandSelectionQuantity(selection)) ?? []
  )
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
  return (
    formatStartingEquipmentItems(option.items, equipmentOptions, currencyOptions) ||
    `Option ${option.order}`
  )
}

export function formatStartingEquipmentItems(
  items: StartingEquipmentItem[],
  equipmentOptions: CharacterBuilderChoiceOptionDto[],
  currencyOptions: CharacterBuilderChoiceOptionDto[]
): string {
  return formatNaturalList(
    items.map((item) => formatStartingEquipmentItem(item, equipmentOptions, currencyOptions))
  )
}

export function formatStartingEquipmentItem(
  item: StartingEquipmentItem,
  equipmentOptions: CharacterBuilderChoiceOptionDto[],
  currencyOptions: CharacterBuilderChoiceOptionDto[]
): string {
  if (item.startingEquipmentKind === 'CURRENCY') {
    return item.currencies
      .map(
        (currency) => `${currency.amount} ${findOptionLabel(currencyOptions, currency.currencyId)}`
      )
      .join(', ')
  }

  const target = formatStartingEquipmentTarget(item, equipmentOptions)
  return item.selectionKind === 'CHOSEN'
    ? `Choose ${item.count} ${target}`
    : formatQuantity(item.quantity, target)
}

export function formatStartingGoldOption(
  startingGold: StartingGold,
  currencyOptions: CharacterBuilderChoiceOptionDto[]
): string {
  const currencyLabel = findOptionLabel(currencyOptions, startingGold.currencyId)
  return `${startingGold.dieConfig} x ${startingGold.multiplier} ${currencyLabel}`
}

export function isStartingEquipmentDecision(
  value: unknown
): value is CharacterStartingEquipmentDecision {
  return Boolean(value && typeof value === 'object' && 'source' in value && 'tookGold' in value)
}

export function isChosenStartingEquipmentItem(
  item: StartingEquipmentItem
): item is ChosenStartingEquipmentItem {
  return (
    item.startingEquipmentKind === 'EQUIPMENT' &&
    'selectionKind' in item &&
    item.selectionKind === 'CHOSEN' &&
    'count' in item
  )
}

function createStartingGoldSelection(
  startingGold: StartingGold,
  totalGold: number
): NonNullable<CharacterStartingEquipmentDecision['gold']> {
  return {
    goldOption: startingGold.dieConfig,
    totalGold: Math.max(0, Math.trunc(totalGold))
  }
}

function getStartingEquipmentSource(
  source: CharacterBuilderStartingEquipmentViewDto['source']
): CharacterStartingEquipmentDecision['source'] {
  return source === 'CLASS'
    ? CharacterStartingEquipmentSource.CLASS
    : CharacterStartingEquipmentSource.BACKGROUND
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

function findOptionLabel(options: CharacterBuilderChoiceOptionDto[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id
}

function formatStartingEquipmentTarget(
  item: StartingEquipmentItem,
  equipmentOptions: CharacterBuilderChoiceOptionDto[]
): string {
  if ('equipmentIds' in item) {
    return item.equipmentIds
      .map((equipmentId) => findOptionLabel(equipmentOptions, equipmentId))
      .join(' or ')
  }

  const propertyText = ('properties' in item ? (item.properties ?? []) : [])
    .map((property) => propertyLabels[property] ?? formatEnumLabel(property).toLowerCase())
    .join(' ')
  const category = 'category' in item ? item.category : undefined
  const categoryText = category
    ? (categoryLabels[category] ?? formatEnumLabel(category).toLowerCase())
    : 'equipment'

  return [propertyText, categoryText].filter(Boolean).join(' ')
}

function formatQuantity(quantity: number, target: string): string {
  return quantity === 1 ? target : `${quantity} ${pluralizeLastWord(target)}`
}

function formatNaturalList(values: string[]): string {
  if (values.length < 2) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} and ${values[1]}`

  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

function pluralizeLastWord(value: string): string {
  const match = value.match(/^(.*?)([^\s]+)$/)
  if (!match) return value

  const [, prefix, word] = match
  const lowerWord = word.toLowerCase()
  if (/[^s]s$/.test(lowerWord)) return value
  let plural = `${word}s`

  if (/(s|x|z|ch|sh)$/.test(lowerWord)) {
    plural = `${word}es`
  } else if (/[^aeiou]y$/.test(lowerWord)) {
    plural = `${word.slice(0, -1)}ies`
  }

  return `${prefix}${plural}`
}

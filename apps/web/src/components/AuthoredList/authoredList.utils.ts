import type { AuthoredListAttributeColumn, AuthoredListItem } from './AuthoredList.types'

const accentColumnWidth = 32
const nameColumnWidth = 360
const defaultAttributeColumnWidth = 160
const statusColumnWidth = 124
const badgeColumnWidth = 240
const sourceColumnWidth = 132
const actionColumnWidth = 132

export function sortAuthoredListItems(items: AuthoredListItem[], sort: string) {
  const compare = compareAuthoredListItems(sort)
  const sortedItems = [...items].sort(compare)
  const itemIds = new Set(items.map((item) => item.id))
  const childItems = new Map<string, AuthoredListItem[]>()
  const topLevelItems: AuthoredListItem[] = []

  for (const item of sortedItems) {
    const parentId = item.hierarchy?.parentId

    if (parentId && itemIds.has(parentId)) {
      const siblings = childItems.get(parentId) ?? []
      siblings.push(item)
      childItems.set(parentId, siblings)
      continue
    }

    topLevelItems.push(item)
  }

  const emitted = new Set<string>()
  const appendWithDescendants = (item: AuthoredListItem): AuthoredListItem[] => {
    if (emitted.has(item.id)) return []
    emitted.add(item.id)

    return [item, ...(childItems.get(item.id) ?? []).sort(compare).flatMap(appendWithDescendants)]
  }

  return [
    ...topLevelItems.flatMap(appendWithDescendants),
    ...sortedItems.filter((item) => !emitted.has(item.id)).flatMap(appendWithDescendants)
  ]
}

export function hasAuthoredListAccent(
  item: AuthoredListItem
): item is AuthoredListItem & { accentColor: string; accentLabel: string } {
  return Boolean(item.accentColor && item.accentLabel)
}

export function hasAuthoredListStatus(
  item: AuthoredListItem
): item is AuthoredListItem & { statusLabel: string } {
  return Boolean(item.statusLabel)
}

export function hasAuthoredListBadges(
  item: AuthoredListItem
): item is AuthoredListItem & { badges: string[] } {
  return Boolean(item.badges?.length)
}

export function getAuthoredListColumnWidths(
  attributeColumns: AuthoredListAttributeColumn[],
  options: {
    hasAccentColumn: boolean
    hasStatusColumn: boolean
    hasBadgeColumn: boolean
  }
) {
  return [
    ...(options.hasAccentColumn ? [accentColumnWidth] : []),
    nameColumnWidth,
    ...attributeColumns.map((column) => column.width ?? defaultAttributeColumnWidth),
    ...(options.hasStatusColumn ? [statusColumnWidth] : []),
    ...(options.hasBadgeColumn ? [badgeColumnWidth] : []),
    sourceColumnWidth,
    actionColumnWidth
  ]
}

export function getAuthoredListSourceLabel(item: AuthoredListItem) {
  return item.sourceKind === 'master' ? 'SRD' : item.sourceLabel
}

function compareAuthoredListItems(sort: string) {
  return (left: AuthoredListItem, right: AuthoredListItem) => {
    const leftValue = left.sortValues?.[sort]
    const rightValue = right.sortValues?.[sort]

    if (typeof leftValue === 'number' || typeof rightValue === 'number') {
      return Number(leftValue ?? 0) - Number(rightValue ?? 0) || left.name.localeCompare(right.name)
    }

    return String(leftValue ?? left.name).localeCompare(String(rightValue ?? right.name))
  }
}

import type { CharacterSheet } from './CharacterSheet.types'

export type SheetInventoryItem = CharacterSheet['inventory']['items'][number]

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function formatInventoryItemSummary(item: SheetInventoryItem): string {
  const facts = [
    `Qty ${item.quantity}`,
    item.category ? formatLabel(item.category) : undefined,
    item.weight ? `${formatNumber(item.weight.amount)} ${formatLabel(item.weight.unit)}` : undefined,
    item.cost ? `${formatNumber(item.cost.amount)} ${item.costLabel ?? 'currency'}` : undefined,
    item.armorClass ? `AC ${item.armorClass}` : undefined,
    item.equipped ? 'Equipped' : undefined,
    item.attuned ? 'Attuned' : undefined
  ].filter((fact): fact is string => Boolean(fact))

  return facts.join(' - ')
}

export function formatInventoryItemProperties(item: SheetInventoryItem): string | null {
  if (!item.properties?.length) return null
  return item.properties.map(formatLabel).join(', ')
}

import type { CharacterSheetTabId } from './CharacterSheet.types'

export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

export function isCharacterSheetTabId(value: string | null): value is CharacterSheetTabId {
  return value === 'overview'
    || value === 'actions'
    || value === 'resources'
    || value === 'spells'
    || value === 'inventory'
    || value === 'reference'
    || value === 'notes'
    || value === 'history'
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value || 0)
}

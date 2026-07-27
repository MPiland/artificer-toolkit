import type { CharacterSheetMobilePageId, CharacterSheetTabId } from './CharacterSheet.types'

export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

export function isCharacterSheetTabId(value: string | null): value is CharacterSheetTabId {
  return (
    value === 'overview' ||
    value === 'actions' ||
    value === 'spells' ||
    value === 'inventory' ||
    value === 'reference' ||
    value === 'notes'
  )
}

export function isCharacterSheetMobilePageId(
  value: string | null
): value is CharacterSheetMobilePageId {
  return (
    value === 'overview' ||
    value === 'actions' ||
    value === 'spells' ||
    value === 'equipment' ||
    value === 'features' ||
    value === 'notes' ||
    value === 'skills' ||
    value === 'proficiencies'
  )
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value || 0)
}

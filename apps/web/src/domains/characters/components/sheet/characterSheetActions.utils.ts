import type { CharacterSheet } from './CharacterSheet.types'
import type { CharacterSheetMechanic } from './characterSheetMechanics.utils'

type SheetAction = CharacterSheet['actions']['items'][number]
type SheetInventoryItem = CharacterSheet['inventory']['items'][number]
type SheetResource = CharacterSheet['resources']['items'][number]

export type CharacterSheetPlayableAction = {
  id: string
  label: string
  kind: 'ACTION' | 'BONUS_ACTION' | 'REACTION' | 'ATTACK' | 'LIMITED_USE'
  sourceLabel?: string
  detail?: string
  description?: string
  mechanics?: CharacterSheetMechanic[]
  rollable: boolean
}

export const CHARACTER_SHEET_ACTION_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'ATTACK', label: 'Attack' },
  { id: 'ACTION', label: 'Action' },
  { id: 'BONUS_ACTION', label: 'Bonus Action' },
  { id: 'REACTION', label: 'Reaction' },
  { id: 'LIMITED_USE', label: 'Limited Use' }
] as const

export type CharacterSheetActionFilter = typeof CHARACTER_SHEET_ACTION_FILTERS[number]['id']

export function getPlayableActions(sheet: CharacterSheet): CharacterSheetPlayableAction[] {
  const weaponActions = sheet.inventory.items
    .filter(isWeaponItem)
    .map(toWeaponAction)
  const explicitActions = sheet.actions.items
    .filter(isPlayableSheetAction)
    .map(toPlayableSheetAction)
  const resourceActions = sheet.resources.items.map(toResourceAction)

  return [...weaponActions, ...explicitActions, ...resourceActions]
}

export function filterPlayableActions(
  actions: readonly CharacterSheetPlayableAction[],
  filter: CharacterSheetActionFilter
): CharacterSheetPlayableAction[] {
  return filter === 'ALL' ? [...actions] : actions.filter((action) => action.kind === filter)
}

export function getFeatureSummaryItems(sheet: CharacterSheet, limit: number) {
  return sheet.reference.features.slice(0, limit)
}

export function formatPlayableActionKind(kind: CharacterSheetPlayableAction['kind']) {
  return kind.replace(/_/g, ' ').toLowerCase()
}

function isPlayableSheetAction(action: SheetAction) {
  return Boolean(action.mechanic) || action.kind !== 'OTHER' || action.rollable === true
}

function toPlayableSheetAction(action: SheetAction): CharacterSheetPlayableAction {
  return {
    id: action.id,
    label: action.label,
    kind: action.mechanic?.attackBonus == null
      ? action.kind === 'OTHER' ? 'ACTION' : action.kind
      : 'ATTACK',
    sourceLabel: action.sourceLabel,
    description: action.description,
    mechanics: action.mechanic ? [action.mechanic] : undefined,
    rollable: action.rollable === true
  }
}

function isWeaponItem(item: SheetInventoryItem) {
  return item.category === 'WEAPON'
}

function toWeaponAction(item: SheetInventoryItem): CharacterSheetPlayableAction {
  return {
    id: `weapon:${item.id}`,
    label: item.customName ?? item.label,
    kind: 'ATTACK',
    sourceLabel: item.equipped ? 'Equipped weapon' : 'Weapon',
    detail: item.properties?.length ? item.properties.join(', ') : undefined,
    description: item.description ?? undefined,
    rollable: false
  }
}

function toResourceAction(resource: SheetResource): CharacterSheetPlayableAction {
  return {
    id: `resource:${resource.id}`,
    label: resource.label,
    kind: 'LIMITED_USE',
    sourceLabel: resource.sourceLabel,
    detail: `${resource.remaining} / ${resource.max} uses`,
    description: resource.description,
    rollable: false
  }
}

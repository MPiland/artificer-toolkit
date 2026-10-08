export const CHARACTER_SHEET_SPELL_ACTION_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTION', label: 'Action' },
  { id: 'BONUS_ACTION', label: 'Bonus Action' },
  { id: 'REACTION', label: 'Reaction' },
  { id: 'FREE', label: 'Free' }
] as const

export type CharacterSheetSpellActionFilter =
  (typeof CHARACTER_SHEET_SPELL_ACTION_FILTERS)[number]['id']

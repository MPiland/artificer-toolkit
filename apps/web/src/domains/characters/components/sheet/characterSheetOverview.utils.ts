import type { CharacterSheet } from './CharacterSheet.types'

export function getAbilityShortLabel(ability: string): string {
  switch (ability) {
    case 'STRENGTH':
      return 'STR'
    case 'DEXTERITY':
      return 'DEX'
    case 'CONSTITUTION':
      return 'CON'
    case 'INTELLIGENCE':
      return 'INT'
    case 'WISDOM':
      return 'WIS'
    case 'CHARISMA':
      return 'CHA'
    default:
      return ability.slice(0, 3)
  }
}

export function formatHitDiceSummary(hitDice: CharacterSheet['overview']['hitDice']): string {
  if (!hitDice.length) return 'None'

  return hitDice
    .map((die) => `${die.remaining}/${die.total}d${die.die}`)
    .join(', ')
}

export function formatProficiencyLevel(proficiency: string): string {
  switch (proficiency) {
    case 'DOUBLE':
      return 'Expertise'
    case 'FULL':
      return 'Prof'
    case 'HALF':
      return 'Half'
    default:
      return 'None'
  }
}

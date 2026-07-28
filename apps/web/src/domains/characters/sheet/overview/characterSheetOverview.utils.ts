import type { CharacterSheet } from '../core/CharacterSheet.types'

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

  return hitDice.map((die) => `${die.remaining}/${die.total}d${die.die}`).join(', ')
}

export function formatProficiencyLevel(
  proficiency: CharacterSheet['overview']['skills'][number]['proficiency']
): string {
  switch (proficiency) {
    case 'DOUBLE':
      return 'Expertise'
    case 'FULL':
      return 'Proficient'
    case 'HALF':
      return 'Half proficiency'
    default:
      return 'Not proficient'
  }
}

export function formatProficiencySummaryLabel(
  proficiency: CharacterSheet['reference']['proficiencies'][number]
): string {
  if (proficiency.kind === 'ARMOR') {
    return proficiency.label.replace(/\s+Armor$/i, '')
  }

  if (proficiency.kind === 'WEAPON') {
    return proficiency.label.replace(/\s+Weapons?$/i, '')
  }

  return proficiency.label
}

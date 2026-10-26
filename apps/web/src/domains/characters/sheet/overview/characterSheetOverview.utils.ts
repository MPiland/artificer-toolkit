import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'

export function formatHitDiceSummary(
  hitDice: CharacterSheetCommonDto['overview']['hitDice']
): string {
  if (!hitDice.length) return 'None'

  return hitDice.map((die) => `${die.remaining}/${die.total}d${die.die}`).join(', ')
}

export function formatProficiencyLevel(
  proficiency: CharacterSheetCommonDto['overview']['skills'][number]['proficiency']
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
  proficiency: CharacterSheetCommonDto['reference']['proficiencies'][number]
): string {
  if (proficiency.kind === 'ARMOR') {
    return proficiency.label.replace(/\s+Armor$/i, '')
  }

  if (proficiency.kind === 'WEAPON') {
    return proficiency.label.replace(/\s+Weapons?$/i, '')
  }

  return proficiency.label
}

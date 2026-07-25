import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'

export function characterSheetAdjustmentMatchesPanelTarget(
  adjustment: CharacterSheetAdjustment,
  target: CharacterSheetPanelTargetDto
): boolean {
  switch (target.kind) {
    case 'ABILITY':
      return adjustment.family === 'ABILITY' && adjustment.ability === target.ability
    case 'SAVING_THROW':
      return adjustment.family === 'SAVING_THROW' && adjustment.ability === target.ability
    case 'SKILL':
      return adjustment.family === 'SKILL' && adjustment.skillId === target.skillId
    case 'SKILLS':
      return adjustment.family === 'SKILL'
    case 'SENSES':
      return adjustment.family === 'PASSIVE' || adjustment.family === 'SENSE'
    case 'MOVEMENT':
      return adjustment.family === 'MOVEMENT'
    case 'DEFENSES':
      return adjustment.family === 'DEFENSE'
    case 'PROFICIENCIES':
      return adjustment.family === 'PROFICIENCY'
  }
}

export function getCharacterSheetPanelAdjustmentIds(
  adjustments: readonly CharacterSheetAdjustment[],
  target: CharacterSheetPanelTargetDto
): Array<{ id: string; family: CharacterSheetAdjustment['family'] }> {
  return adjustments
    .filter((adjustment) => characterSheetAdjustmentMatchesPanelTarget(adjustment, target))
    .map((adjustment) => ({ id: adjustment.id, family: adjustment.family }))
}

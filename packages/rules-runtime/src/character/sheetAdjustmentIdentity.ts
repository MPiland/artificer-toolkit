import type { CharacterSheetAdjustmentCommandDto } from '@artificer-toolkit/schema/api/characterSheet'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'

export function sameCharacterSheetAdjustmentSlot(
  adjustment: CharacterSheetAdjustment,
  input: CharacterSheetAdjustment | CharacterSheetAdjustmentCommandDto
): boolean {
  if (adjustment.family !== input.family) return false
  switch (input.family) {
    case 'ABILITY':
      return (
        adjustment.family === 'ABILITY' &&
        input.family === 'ABILITY' &&
        adjustment.ability === input.ability &&
        adjustment.field === input.field
      )
    case 'SAVING_THROW':
      return (
        adjustment.family === 'SAVING_THROW' &&
        input.family === 'SAVING_THROW' &&
        adjustment.ability === input.ability &&
        adjustment.field === input.field
      )
    case 'SKILL':
      return (
        adjustment.family === 'SKILL' &&
        input.family === 'SKILL' &&
        adjustment.skillId === input.skillId &&
        adjustment.field === input.field
      )
    case 'PASSIVE':
      return (
        adjustment.family === 'PASSIVE' &&
        input.family === 'PASSIVE' &&
        adjustment.skillId === input.skillId
      )
    case 'SENSE':
      return (
        adjustment.family === 'SENSE' &&
        input.family === 'SENSE' &&
        adjustment.senseId === input.senseId
      )
    case 'MOVEMENT':
      return (
        adjustment.family === 'MOVEMENT' &&
        input.family === 'MOVEMENT' &&
        adjustment.speedId === input.speedId
      )
    case 'HIT_POINTS':
      return (
        adjustment.family === 'HIT_POINTS' &&
        input.family === 'HIT_POINTS' &&
        adjustment.field === input.field
      )
    case 'SPELL':
      return (
        adjustment.family === 'SPELL' &&
        input.family === 'SPELL' &&
        adjustment.source.spellId === input.source?.spellId &&
        adjustment.source.sourceKind === input.source?.sourceKind &&
        adjustment.source.sourceInstanceId === input.source?.sourceInstanceId &&
        adjustment.field === input.field
      )
    case 'ITEM':
      return (
        adjustment.family === 'ITEM' &&
        input.family === 'ITEM' &&
        adjustment.itemInstanceId === input.itemInstanceId &&
        adjustment.field === input.field
      )
    case 'COMPANION':
      return (
        adjustment.family === 'COMPANION' &&
        input.family === 'COMPANION' &&
        adjustment.companionInstanceId === input.companionInstanceId &&
        adjustment.field === input.field
      )
    case 'DEFENSE':
      return (
        adjustment.family === 'DEFENSE' &&
        input.family === 'DEFENSE' &&
        adjustment.defenseKind === input.defenseKind &&
        adjustment.damageTypeId === input.damageTypeId
      )
    case 'PROFICIENCY':
      return (
        adjustment.family === 'PROFICIENCY' &&
        input.family === 'PROFICIENCY' &&
        adjustment.proficiencyKind === input.proficiencyKind &&
        adjustment.targetId === input.targetId
      )
  }
}

export function getCharacterSheetAdjustmentSlotKey(
  adjustment: CharacterSheetAdjustment | CharacterSheetAdjustmentCommandDto
): string {
  switch (adjustment.family) {
    case 'ABILITY':
    case 'SAVING_THROW':
      return JSON.stringify([adjustment.family, adjustment.ability, adjustment.field])
    case 'SKILL':
      return JSON.stringify([adjustment.family, adjustment.skillId, adjustment.field])
    case 'PASSIVE':
      return JSON.stringify([adjustment.family, adjustment.skillId])
    case 'SENSE':
      return JSON.stringify([adjustment.family, adjustment.senseId])
    case 'MOVEMENT':
      return JSON.stringify([adjustment.family, adjustment.speedId])
    case 'HIT_POINTS':
      return JSON.stringify([adjustment.family, adjustment.field])
    case 'SPELL':
      return JSON.stringify([
        adjustment.family,
        adjustment.source.spellId,
        adjustment.source.sourceKind,
        adjustment.source.sourceInstanceId,
        adjustment.field
      ])
    case 'ITEM':
      return JSON.stringify([adjustment.family, adjustment.itemInstanceId, adjustment.field])
    case 'COMPANION':
      return JSON.stringify([adjustment.family, adjustment.companionInstanceId, adjustment.field])
    case 'DEFENSE':
      return JSON.stringify([adjustment.family, adjustment.defenseKind, adjustment.damageTypeId])
    case 'PROFICIENCY':
      return JSON.stringify([adjustment.family, adjustment.proficiencyKind, adjustment.targetId])
  }
}

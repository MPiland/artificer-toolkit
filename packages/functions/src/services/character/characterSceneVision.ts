import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { SceneCharacterVision } from '@artificer-toolkit/shared/vtt'

function toFeet(range: { amount: number; unit: string }): number | null {
  switch (range.unit) {
    case 'FEET':
      return range.amount
    case 'INCHES':
      return range.amount / 12
    case 'MILES':
      return range.amount * 5_280
    case 'YARDS':
      return range.amount * 3
    default:
      return null
  }
}

export function resolveCharacterSceneVisionDimRangeFeet(
  senses: CharacterRulePolicyOutput['senses'],
  adjustments: readonly CharacterSheetAdjustment[] = []
): number | null {
  const baseRange = senses.reduce<number | null>((maximum, sense) => {
    if (sense.senseCode.toUpperCase() !== 'DARKVISION' || !sense.range) return maximum
    const feet = toFeet(sense.range)
    if (feet === null) return maximum
    return maximum === null ? feet : Math.max(maximum, feet)
  }, null)
  const override = adjustments.find(
    (adjustment) =>
      adjustment.family === 'SENSE' &&
      adjustment.field === 'RANGE_OVERRIDE' &&
      adjustment.senseId.toUpperCase() === 'DARKVISION'
  )
  if (!override || typeof override.value !== 'number') return baseRange
  const baseDarkvisionRange = senses.find(
    (sense) => sense.senseCode.toUpperCase() === 'DARKVISION'
  )?.range
  return toFeet({ amount: override.value, unit: baseDarkvisionRange?.unit ?? 'FEET' })
}

export function deriveCharacterSceneVision(
  characterId: string,
  senses: CharacterRulePolicyOutput['senses']
): SceneCharacterVision {
  const dimRange = resolveCharacterSceneVisionDimRangeFeet(senses)
  return {
    characterId,
    dimRange: dimRange !== null && dimRange > 0 ? { amount: dimRange, unit: 'FEET' } : null
  }
}

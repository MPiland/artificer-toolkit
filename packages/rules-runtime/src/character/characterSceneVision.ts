import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SceneCharacterVision } from '@artificer-toolkit/shared/vtt'

/** Feet in a typed length; a unit that is not a length in feet or its multiples has none. */
export function lengthInFeet(range: { amount: number; unit: string }): number | null {
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

function supportsOrdinaryDarknessVision(
  pin: Pick<PinnedSenseDefinition, 'document' | 'range'>
): boolean {
  return pin.document.capabilities.some(
    (capability) =>
      capability.channel === 'VISUAL' &&
      capability.accessGrade === 'PRECISE' &&
      capability.satisfies.includes('SEE') &&
      ['ORDINARY_DARKNESS', 'MAGICAL_DARKNESS', 'IGNORE'].includes(capability.illuminationAccess)
  )
}

/** Presentation-only scalar; combat eligibility uses the shared perception resolver. */
export function resolveCharacterSceneVisionDimRangeFeet(
  pinnedSenseDefinitions: readonly Pick<PinnedSenseDefinition, 'document' | 'range'>[]
): number | null {
  return pinnedSenseDefinitions.reduce<number | null>((maximum, pin) => {
    if (!supportsOrdinaryDarknessVision(pin) || !pin.range) return maximum
    const feet = lengthInFeet(pin.range)
    if (feet === null) return maximum
    return maximum === null ? feet : Math.max(maximum, feet)
  }, null)
}

export function deriveCharacterSceneVision(
  characterId: string,
  pinnedSenseDefinitions: readonly Pick<PinnedSenseDefinition, 'document' | 'range'>[]
): SceneCharacterVision {
  const dimRange = resolveCharacterSceneVisionDimRangeFeet(pinnedSenseDefinitions)
  return {
    characterId,
    dimRange: dimRange !== null && dimRange > 0 ? { amount: dimRange, unit: 'FEET' } : null
  }
}

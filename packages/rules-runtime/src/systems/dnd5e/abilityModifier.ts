import { characterPolicyNumber } from './characterPolicyValues.js'

/** The 5e modifier of an ability score. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * The value an ABILITY_MODIFIER_BONUS grant adds: the ability modifier scaled by the grant's
 * multiplier and clamped to its min/max (medium armor's +2 Dexterity cap).
 */
export function resolveAbilityModifierBonus(
  modifier: number,
  payload: Readonly<Record<string, unknown>>
): number {
  return Math.max(
    characterPolicyNumber(payload.min ?? -999),
    Math.min(
      characterPolicyNumber(payload.max ?? 999),
      modifier * characterPolicyNumber(payload.multiplier ?? 1)
    )
  )
}

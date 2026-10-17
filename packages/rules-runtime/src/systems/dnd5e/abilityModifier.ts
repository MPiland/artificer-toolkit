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
  payload: { readonly multiplier?: number; readonly min?: number; readonly max?: number }
): number {
  return Math.max(
    payload.min ?? -999,
    Math.min(payload.max ?? 999, modifier * (payload.multiplier ?? 1))
  )
}

/** The 5e modifier of an ability score. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

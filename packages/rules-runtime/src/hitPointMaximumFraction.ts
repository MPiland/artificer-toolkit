import type { CharacterHitpointsState } from '@artificer-toolkit/shared/subjects/authored'
import type { HitPointMaximumFractionDto } from '@artificer-toolkit/schema/shared/hitPointMaximumFraction'

/** A maximum after a holder's stored fraction, rounded down; no fraction leaves it whole. */
export function applyHitPointMaximumFraction(
  maximum: number,
  fraction: HitPointMaximumFractionDto | null | undefined
): number {
  return fraction ? Math.floor((maximum * fraction.numerator) / fraction.denominator) : maximum
}

/** What a condition change leaves a Character's maximum: the fraction to store and the maximum it gives. */
export type ConditionMaximum = {
  fraction: HitPointMaximumFractionDto | null
  maximumHitPoints: number
}

/** Stores the fraction a condition change leaves the maximum and keeps hit points within it (SPELLS-10.T1b). */
export function applyConditionMaximum(
  character: { state: { hitpoints: CharacterHitpointsState } },
  conditionMaximum?: ConditionMaximum
) {
  if (!conditionMaximum) return
  const { hitpoints } = character.state
  hitpoints.maximumFraction = conditionMaximum.fraction ?? undefined
  hitpoints.current = Math.min(hitpoints.current, conditionMaximum.maximumHitPoints)
}

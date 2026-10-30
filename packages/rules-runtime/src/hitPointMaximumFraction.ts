import type { HitPointMaximumFractionDto } from '@artificer-toolkit/schema/shared/hitPointMaximumFraction'

/** A maximum after a holder's stored fraction, rounded down; no fraction leaves it whole. */
export function applyHitPointMaximumFraction(
  maximum: number,
  fraction: HitPointMaximumFractionDto | null | undefined
): number {
  return fraction ? Math.floor((maximum * fraction.numerator) / fraction.denominator) : maximum
}

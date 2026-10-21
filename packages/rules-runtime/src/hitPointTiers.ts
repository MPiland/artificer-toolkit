/** The floor of a band with no lower neighbour: a target's hit points are never below zero. */
export const NO_HIT_POINT_FLOOR = -1

/** The ceiling of a band with no upper neighbour. */
export const NO_HIT_POINT_CEILING = Number.MAX_SAFE_INTEGER

/** The band a hit-point result-block gate bounds: at most its amount, or at least it. */
export function hitPointGateBand(gate: {
  kind: 'TARGET_HIT_POINTS_AT_MOST' | 'TARGET_HIT_POINTS_AT_LEAST'
  amount: number
}): { above: number; atMost: number } {
  return gate.kind === 'TARGET_HIT_POINTS_AT_LEAST'
    ? { above: gate.amount - 1, atMost: NO_HIT_POINT_CEILING }
    : { above: NO_HIT_POINT_FLOOR, atMost: gate.amount }
}

/**
 * The one hit-point comparison: whether a target's current hit points lie in the band above
 * `above` and at most `atMost`. A gate and every tier of a tiered result are bands.
 */
export function withinHitPointBand(
  currentHitPoints: number,
  above: number,
  atMost: number
): boolean {
  return currentHitPoints > above && currentHitPoints <= atMost
}

/** The ceilings of the tiers an action authors, once each, lowest first; none for an untiered action. */
export function hitPointTierCeilings(entries: readonly object[]): number[] {
  return [
    ...new Set(
      entries.flatMap(
        (entry) => (entry as { hitPointTier?: { atMost: number } }).hitPointTier?.atMost ?? []
      )
    )
  ].sort((left, right) => left - right)
}

/** The floor of the band a tier owns: the nearest lower ceiling among its siblings, if any. */
export function hitPointTierFloor(ceilings: readonly number[], atMost: number): number {
  return Math.max(NO_HIT_POINT_FLOOR, ...ceilings.filter((ceiling) => ceiling < atMost))
}

/**
 * The one place a hit-point tier is chosen: exactly one tier applies, never several, the one whose
 * band holds the target's current hit points. None holding them means no tier.
 */
export function selectHitPointTier(
  ceilings: readonly number[],
  currentHitPoints: number
): number | null {
  return (
    ceilings.find((atMost) =>
      withinHitPointBand(currentHitPoints, hitPointTierFloor(ceilings, atMost), atMost)
    ) ?? null
  )
}

/**
 * The plan of a hit-point-tiered action that holds for a target at its current hit points, or null.
 * A tier that authors no plan (an instant kill) still owns its band, so its targets get no plan.
 */
export function selectHitPointTierPlan<TPlan extends { hitPointTier?: { atMost: number } }>(
  ceilings: readonly number[],
  plans: readonly TPlan[],
  currentHitPoints: number
): TPlan | null {
  const atMost = selectHitPointTier(ceilings, currentHitPoints)
  return plans.find((plan) => plan.hitPointTier?.atMost === atMost) ?? null
}

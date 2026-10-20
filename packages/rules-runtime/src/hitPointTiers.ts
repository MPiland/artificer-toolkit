/** Whether a target's current hit points satisfy a tier or gate that holds up to `atMost`. */
export function withinHitPointTier(currentHitPoints: number, atMost: number): boolean {
  return currentHitPoints <= atMost
}

/**
 * The one place a hit-point tier is chosen: exactly one tier applies, never several, the one with
 * the lowest `atMost` that the target's current hit points satisfy. None satisfied means no tier.
 */
export function selectHitPointTier<TTier extends { atMost: number }>(
  tiers: readonly TTier[],
  currentHitPoints: number
): TTier | null {
  let selected: TTier | null = null
  for (const tier of tiers)
    if (
      withinHitPointTier(currentHitPoints, tier.atMost) &&
      (selected === null || tier.atMost < selected.atMost)
    )
      selected = tier
  return selected
}

/** The plan of a hit-point-tiered action that holds for a target at its current hit points, or null. */
export function selectHitPointTierPlan<TPlan extends { hitPointTier?: { atMost: number } }>(
  plans: readonly TPlan[],
  currentHitPoints: number
): TPlan | null {
  const tier = selectHitPointTier(
    plans.flatMap((plan) => (plan.hitPointTier ? [plan.hitPointTier] : [])),
    currentHitPoints
  )
  return plans.find((plan) => plan.hitPointTier === tier) ?? null
}

/**
 * Creature feature effects are not wielded items: weapon effects copied onto them drop the grip, and
 * the wielder-conditioned ones (the off-hand attack's `requirements`) stay with the item.
 */
export function toCreatureFeatureEffects<TEffect extends { grip: unknown; requirements?: unknown }>(
  effects: readonly TEffect[] | undefined
) {
  return effects
    ?.filter(({ requirements }) => requirements === undefined)
    .map(({ grip: _grip, requirements: _requirements, ...effect }) => effect)
}

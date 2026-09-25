/** Creature feature effects are not wielded items, so weapon effects copied onto them drop the grip. */
export function toCreatureFeatureEffects<TEffect extends { grip: unknown }>(
  effects: readonly TEffect[] | undefined
) {
  return effects?.map(({ grip: _grip, ...effect }) => effect)
}

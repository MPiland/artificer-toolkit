import { EFFECT_KIND } from '#core'

/**
 * The target drops to 0 hit points and loses its temporary hit points. This is not damage: a
 * Creature is defeated and a Character starts dying, as when damage reaches 0.
 */
export type HitPointsToZeroAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.HIT_POINTS_TO_ZERO
}

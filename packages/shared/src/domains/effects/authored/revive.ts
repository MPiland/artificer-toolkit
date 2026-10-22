import { EFFECT_KIND } from '#core'

/**
 * A dead target returns to life (Revivify, True Resurrection): `ONE` hit point or its `MAXIMUM`.
 * A Character's death saves clear; a target that is not dead is left as it was.
 */
export type ReviveAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.REVIVE
  hitPoints: 'ONE' | 'MAXIMUM'
}

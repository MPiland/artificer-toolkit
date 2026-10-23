import { EFFECT_KIND } from '#core'

/**
 * A dead target returns to life (Revivify, True Resurrection): with a `FIXED` number of hit points
 * or its `MAXIMUM`. A Character's death saves clear; a target that is not dead is left as it was.
 */
export type ReviveAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.REVIVE
} & ({ valueKind: 'FIXED'; amount: number } | { valueKind: 'MAXIMUM' })

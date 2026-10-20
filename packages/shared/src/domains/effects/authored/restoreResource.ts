import { EFFECT_KIND } from '#core'

/**
 * Raises a feature charge's remaining uses to at least `floor` when it has `whenAtOrBelow` or
 * fewer left. The charge is the one the holder's feature authors; the outcome never lowers it.
 */
export type RestoreResourceAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.RESTORE_RESOURCE
  chargeId: string
  floor: number // int >= 1
  whenAtOrBelow: number // int >= 0
}

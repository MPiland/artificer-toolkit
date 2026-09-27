import { EFFECT_KIND } from '#core'

export type HitPointMaximumReductionAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION
  amountSource: {
    kind: 'DAMAGE_TAKEN'
    damageOutcomeId: string
  }
  /** Restoration magic always ends the reduction; `LONG_REST` also ends it on a long rest. */
  recoveryTags: Array<'RESTORE_HIT_POINT_MAXIMUM' | 'LONG_REST'>
}

import { EFFECT_KIND } from '#core'

export type HitPointMaximumReductionAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION
  amountSource: {
    kind: 'DAMAGE_TAKEN'
    damageOutcomeId: string
  }
  recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
}

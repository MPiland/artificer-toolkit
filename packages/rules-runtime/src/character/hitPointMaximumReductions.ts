import type { HitPointMaximumReductionRecoveryTag } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

type ReductionSourceEffect = Pick<ActiveRuleEffectRecord, 'id' | 'createdOrdinal' | 'definition'>

type HitPointMaximumReduction = {
  activeEffectId: string
  label: string
  sourceHidden: boolean
  amount: number
  recoveryTags: HitPointMaximumReductionRecoveryTag[]
}

/** A Character's active hit point maximum reductions (Life Drain, Clay Golem), oldest first. */
export function listHitPointMaximumReductions(
  effects: readonly ReductionSourceEffect[]
): HitPointMaximumReduction[] {
  return [...effects]
    .sort(
      (left, right) => left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
    )
    .flatMap((effect) =>
      effect.definition.stateContributions.flatMap((contribution) =>
        contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION'
          ? [
              {
                activeEffectId: effect.id,
                label: contribution.sourceLabel,
                sourceHidden: contribution.sourceHidden,
                amount: contribution.amount,
                recoveryTags: contribution.recoveryTags
              }
            ]
          : []
      )
    )
}

/**
 * A maximum less every active reduction, never below 0. Read maxima through
 * `effectiveHitPointMaximum`, which also applies grants.
 */
export function reduceHitPointMaximum(
  maximum: number,
  reductions: readonly Pick<HitPointMaximumReduction, 'amount'>[]
): number {
  let total = 0
  for (const reduction of reductions) {
    if (!Number.isSafeInteger(total + reduction.amount))
      throw new Error('Active hit point maximum reductions exceed safe bounds.')
    total += reduction.amount
  }
  return Math.max(0, maximum - total)
}

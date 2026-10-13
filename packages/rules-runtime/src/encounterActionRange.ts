import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'

import { isBeyondSingleTargetPath, TOUCH_RANGE } from './encounterActionTargetPolicy.js'
import { rangeLabel } from './rangeLabel.js'

type EncounterActionRange = NonNullable<EncounterActionChoiceDto['range']>

/**
 * The range the target policy evaluator enforces, for the client's range preview; null for a range
 * it cannot measure (sight, special) or a policy it refuses (an area or path action).
 */
function enforcedRange(policy: CompiledActionTargetPolicy): EncounterActionRange | null {
  if (isBeyondSingleTargetPath(policy)) return null
  const { range } = policy
  switch (range.rangeKind) {
    case 'SELF':
      return { kind: 'SELF' }
    case 'UNLIMITED':
      return { kind: 'UNLIMITED' }
    case 'TOUCH':
      return { kind: 'WITHIN', distance: TOUCH_RANGE }
    case 'DISTANCE':
      return range.longAmount === undefined
        ? { kind: 'WITHIN', distance: { amount: range.amount, unit: range.unit } }
        : {
            kind: 'RANGED',
            normal: { amount: range.amount, unit: range.unit },
            long: { amount: range.longAmount, unit: range.unit }
          }
    default:
      return null
  }
}

/**
 * The `range` and `rangeLabel` of an action choice. The label is the authored range, worded as the
 * Sheet words it; `range` is the numeric geometry the policy enforces. A choice without a policy
 * keeps the label its action already carries.
 */
export function encounterActionChoiceRange(
  policy: CompiledActionTargetPolicy | undefined,
  fallbackLabel?: string
): Pick<EncounterActionChoiceDto, 'range' | 'rangeLabel'> {
  if (!policy) return fallbackLabel ? { rangeLabel: fallbackLabel } : {}
  const range = enforcedRange(policy)
  return { ...(range ? { range } : {}), rangeLabel: rangeLabel(policy.range) }
}

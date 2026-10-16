import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'

import { encounterActionTargetKind, pointAreaOriginRange } from './encounterAreaAction.js'
import {
  singleTargetMeasure,
  TOUCH_RANGE,
  withoutCreatureTypeRestrictions
} from './encounterActionTargetPolicy.js'
import { rangeLabel } from './rangeLabel.js'

type EncounterActionRange = NonNullable<EncounterActionChoiceDto['range']>

/**
 * The range the evaluator that handles the policy measures, for the client's range preview. A point
 * area advertises its origin range (the area evaluator ignores a long range); a single-target
 * policy advertises the single-target geometry its action's targeting is checked against (excluded
 * creature types only warn). Null for a policy neither evaluator measures (a
 * path override, an unsupported area, a range kind or targeting the evaluator refuses).
 */
function enforcedRange(policy: CompiledActionTargetPolicy): EncounterActionRange | null {
  if (encounterActionTargetKind(policy) === 'POINT') {
    const origin = pointAreaOriginRange(policy.range)
    if (origin === null) return null
    return origin.rangeKind === 'UNLIMITED'
      ? { kind: 'UNLIMITED' }
      : { kind: 'WITHIN', distance: { amount: origin.amount, unit: origin.unit } }
  }
  const measure = singleTargetMeasure(withoutCreatureTypeRestrictions(policy))
  if (measure === null) return null
  if (measure.kind === 'SELF') return { kind: 'SELF' }
  const { range } = measure
  switch (range.rangeKind) {
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

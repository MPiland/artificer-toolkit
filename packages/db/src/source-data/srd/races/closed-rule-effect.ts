import { RANGE_KIND, TRIGGER, type ClosedRuleKind } from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { closedRuleEffect } from '../closed-rule-effect.js'

export function raceClosedRuleEffect(
  childId: (entry: number) => string,
  ruleKind: ClosedRuleKind
): NonNullable<FeatureAuthored['effects']>[number] {
  return closedRuleEffect({
    id: childId(20),
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.ACTIVATED,
      range: {
        id: childId(21),
        rangeKind: RANGE_KIND.SELF
      }
    },
    ruleKind
  })
}

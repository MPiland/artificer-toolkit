import { CLOSED_RULE_KIND, EFFECT_KIND, type ClosedRuleKind } from '#core'

export type ClosedRuleAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.CLOSED_RULE
  ruleKind: ClosedRuleKind
}

export { CLOSED_RULE_KIND }

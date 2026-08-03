import { EFFECT_KIND, type ActionEconomyRuleKind } from '#core'

export type ActionEconomyRuleAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.ACTION_ECONOMY_RULE
} & (
  | { ruleKind: Extract<ActionEconomyRuleKind, 'LOSE_ACTION'> }
  | {
      ruleKind: Exclude<ActionEconomyRuleKind, 'LOSE_ACTION'>
      maximum: number
    }
)

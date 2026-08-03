import { EFFECT_KIND, type MeasurementUnitCode, type MOVEMENT_RULE_KIND } from '#core'

export type MovementRuleAuthored =
  | {
      id: string
      effectKind: typeof EFFECT_KIND.MOVEMENT_RULE
      ruleKind: typeof MOVEMENT_RULE_KIND.STOP_CURRENT_MOVEMENT
    }
  | {
      id: string
      effectKind: typeof EFFECT_KIND.MOVEMENT_RULE
      ruleKind: typeof MOVEMENT_RULE_KIND.MOVEMENT_COST_MULTIPLIER
      multiplier: number
    }
  | {
      id: string
      effectKind: typeof EFFECT_KIND.MOVEMENT_RULE
      ruleKind: Exclude<
        keyof typeof MOVEMENT_RULE_KIND,
        'STOP_CURRENT_MOVEMENT' | 'MOVEMENT_COST_MULTIPLIER'
      >
      limitDistance: { amount: number; unit: MeasurementUnitCode }
    }

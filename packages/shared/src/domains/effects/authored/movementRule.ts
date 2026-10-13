import { EFFECT_KIND, type LengthUnitCode, type MOVEMENT_RULE_KIND } from '#core'

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
      ruleKind: typeof MOVEMENT_RULE_KIND.ADD_SPEED_TO_MOVEMENT
    }
  | {
      id: string
      effectKind: typeof EFFECT_KIND.MOVEMENT_RULE
      ruleKind: Exclude<
        keyof typeof MOVEMENT_RULE_KIND,
        'STOP_CURRENT_MOVEMENT' | 'MOVEMENT_COST_MULTIPLIER' | 'ADD_SPEED_TO_MOVEMENT'
      >
      limitDistance: { amount: number; unit: LengthUnitCode }
    }

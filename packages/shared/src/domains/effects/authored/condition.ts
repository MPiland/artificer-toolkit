import { EFFECT_KIND } from '#core'

export type ConditionAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.CONDITION
  conditionId: string
}

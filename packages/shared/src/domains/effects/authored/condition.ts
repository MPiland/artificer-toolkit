import { EFFECT_KIND } from '#core'

export type ConditionAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.CONDITION
  conditionId: string
  /** The creature taking the action is this condition's source (Frightened's "source of its fear"). */
  recordsSource?: boolean
}

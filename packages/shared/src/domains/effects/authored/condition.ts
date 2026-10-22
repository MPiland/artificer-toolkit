import { EFFECT_KIND } from '#core'
import type { DurationAuthored } from '#authored'

export type ConditionAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.CONDITION
  conditionId: string
  /** The creature taking the action is this condition's source (Frightened's "source of its fear"). */
  recordsSource?: boolean
  /** The condition's holder must Dash away from its source (Fear's "must Dash away"); needs `recordsSource`. */
  fleesSource?: boolean
  /** How long a gated band's condition lasts; the band's conditions each count their own. */
  duration?: DurationAuthored
  /** A sibling condition of the same band this one ends with (paralyzed "while poisoned this way"). */
  endsWithOutcomeId?: string
}

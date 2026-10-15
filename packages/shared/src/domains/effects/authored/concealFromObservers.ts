import { EFFECT_KIND } from '#core'

/**
 * The holder's location becomes unknown to every observer who fails to notice it, so far as the
 * action's check outcome decides. The observer set is state, not part of this authored record.
 */
export type ConcealFromObserversAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.CONCEAL_FROM_OBSERVERS
  observers: 'NON_ALLIES'
}

import { EFFECT_KIND } from '#core'

/** The event that triggered this reaction (a spell being cast) is cancelled and has no effect. */
export type CancelTriggeringEventAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.CANCEL_TRIGGERING_EVENT
}

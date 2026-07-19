import { EFFECT_KIND } from '#core'

/** Descriptive behavior that the engine intentionally leaves to a player or GM. */
export type ManualAdjudicationAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.MANUAL_ADJUDICATION
}

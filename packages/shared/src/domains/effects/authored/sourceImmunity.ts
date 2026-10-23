import { EFFECT_KIND } from '#core'

/**
 * The target becomes immune to this source's use of this effect for its result block's duration
 * ("on a successful save, the creature is immune to this effect for 24 hours"). With `lifetime`
 * `CONCENTRATION` it lasts as long as the casting's Concentration instead, so the result block needs
 * no duration and the immunity ends with the Concentration (a spell that retargets while it lasts
 * and never picks a creature that already saved).
 */
export type SourceImmunityAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.SOURCE_IMMUNITY
  lifetime?: 'CONCENTRATION'
}

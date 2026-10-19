import { EFFECT_KIND } from '#core'

/**
 * The target becomes immune to this source's use of this effect for its result block's duration
 * ("on a successful save, the creature is immune to this effect for 24 hours").
 */
export type SourceImmunityAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.SOURCE_IMMUNITY
}

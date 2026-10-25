import { EFFECT_KIND } from '#core'

/** A creature whose score in this System ability is at or below `score` cannot join the link. */
export type TelepathicLinkAbilityFloorAuthored = {
  ability: string
  score: number
}

export type TelepathicLinkAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.TELEPATHIC_LINK
  maximumCreatures: number
  excludesAbilityAtOrBelow: TelepathicLinkAbilityFloorAuthored
  anyDistance: boolean
  crossesPlanes: boolean
  requiresSharedLanguage: boolean
}

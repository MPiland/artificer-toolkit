import { EFFECT_KIND } from '#core'

export type TelepathicLinkAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.TELEPATHIC_LINK
  maximumCreatures: number
  excludesIntelligenceAtOrBelow: number
  anyDistance: boolean
  crossesPlanes: boolean
  requiresSharedLanguage: boolean
}

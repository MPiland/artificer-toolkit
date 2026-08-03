import { EFFECT_KIND } from '#core'

export type StabilizeAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.STABILIZE
  requiresZeroHitPoints: true
}

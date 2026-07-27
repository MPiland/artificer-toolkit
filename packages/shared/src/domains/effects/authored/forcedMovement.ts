import type { ForcedMovementDistance } from '#core'
import { EFFECT_KIND, type ForcedMovementActionEconomy, type ForcedMovementDirection } from '#core'

export type ForcedMovementAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.FORCED_MOVEMENT
  direction: ForcedMovementDirection
  actionEconomy: ForcedMovementActionEconomy
} & ForcedMovementDistance

import type { SavingThrowAuthored } from '#authored'
import type { ForcedMovementDistance } from '#core'
import { EFFECT_KIND, type ForcedMovementActionEconomy, type ForcedMovementDirection } from '#core'

/**
 * What a forced movement does where it strikes an object or another creature (D159): the mover
 * takes `diceConfig` of `damageTypeId` for every full 10 feet it travelled, and a creature it
 * strikes makes `savingThrow` or takes the same damage and `conditionId`.
 */
export type ForcedMovementCollisionAuthored = {
  id: string
  damageTypeId: string
  /** The damage dice for each full 10 feet travelled, such as `1d6`. */
  diceConfig: string
  savingThrow: SavingThrowAuthored
  conditionId: string
}

export type ForcedMovementAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.FORCED_MOVEMENT
  direction: ForcedMovementDirection
  actionEconomy: ForcedMovementActionEconomy
  collision?: ForcedMovementCollisionAuthored
} & ForcedMovementDistance

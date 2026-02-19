import type { AbilityCode, SCALING } from '#core'
import {
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND
} from '#core'
import type { LevelScaledValue, PoolScaledValue } from '#authored'

export type DamageBonusAuthored
  = | {
    id: string
    bonusKind: typeof DAMAGE_BONUS_KIND.ABILITY_BONUS
    ability: AbilityCode
    min?: number
    max?: number
    multiplier?: number
    order: number
  }
  | {
    id: string
    bonusKind: typeof DAMAGE_BONUS_KIND.SKILL_BONUS
    skillId: string
    min?: number
    max?: number
    multiplier?: number
    order: number
  }
  | {
    id: string
    bonusKind: typeof DAMAGE_BONUS_KIND.PROFICIENCY_BONUS
    min?: number
    max?: number
    multiplier?: number
    order: number
  }

export type DamageFixedPayload
  = | {
    amount: number
    valueKind: typeof DAMAGE_VALUE_KIND.FIXED
    scalingKind: typeof SCALING.NONE
  } | (
        {
          valueKind: typeof DAMAGE_VALUE_KIND.FIXED
          scalingKind: typeof SCALING.PER_LEVEL
        } & LevelScaledValue<{ amount: number }>
      )

export type DamageDicePayload
  = | {
    diceConfig: string
    valueKind: typeof DAMAGE_VALUE_KIND.DICE
    scalingKind: typeof SCALING.NONE
  } | (
        {
          valueKind: typeof DAMAGE_VALUE_KIND.DICE
          scalingKind: typeof SCALING.PER_LEVEL
        } & LevelScaledValue<{ diceConfig: string }>
      )

export type DamagePoolPayload
  = | {
    amount: number
    valueKind: typeof DAMAGE_VALUE_KIND.POOL
    scalingKind: typeof SCALING.NONE
  } | (
        {
          valueKind: typeof DAMAGE_VALUE_KIND.POOL
          scalingKind: typeof SCALING.PER_LEVEL
        } & PoolScaledValue
      )

export type DamagePayload
  = | DamageFixedPayload | DamageDicePayload | DamagePoolPayload

export type DamageAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.DAMAGE
  damageTypeId: string
  bonuses?: DamageBonusAuthored[]
} & DamagePayload

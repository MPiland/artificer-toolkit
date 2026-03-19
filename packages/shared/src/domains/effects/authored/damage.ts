import type { AbilityCode, SCALING, ScalingAmountKind } from '#core'
import {
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  type ScalingSource,
  type ScalingSourcePayload
} from '#core'

export type DamageProgressionLevel<TPayload = object> = {
  id: string
  level: number
  order: number
} & TPayload

export type DamageProgression<TPayload = object> = {
  [S in ScalingSource]: {
    levels: DamageProgressionLevel<TPayload>[]
  } & ScalingSourcePayload[S]
}[ScalingSource]

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
        } & DamageProgression<{ amount: number }>
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
        } & DamageProgression<{ diceConfig: string }>
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
          scalingSource: 'CHARACTER_LEVEL' | 'CLASS_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL'
          amount?: number
          multiplier?: number
          min?: number
          max?: number
        } & (
          | { scalingSource: 'CLASS_LEVEL', classId: string }
          | { scalingSource: 'CHARACTER_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL' }
        )
      )

export type DamagePayload
  = | DamageFixedPayload | DamageDicePayload | DamagePoolPayload

export type DamageAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.DAMAGE
  damageTypeId: string
  bonuses?: DamageBonusAuthored[]
  amountKind?: ScalingAmountKind
} & DamagePayload

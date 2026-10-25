import type { SCALING, ScalingAmountKind } from '#core'
import {
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  SCALABLE_SCALING_KIND,
  type ScalingBreakpoint,
  type ScalingSource,
  type ScalingSourcePayload
} from '#core'

export type DamageProgressionLevel<TPayload extends object = object> = {
  id: string
  level: number
  order: number
} & TPayload

export type DamageProgression<TPayload extends object = object> = {
  [S in ScalingSource]: {
    levels: DamageProgressionLevel<TPayload>[]
  } & ScalingSourcePayload[S]
}[ScalingSource]

export type DamageBreakpointProgressionLevel<TPayload extends object = object> =
  ScalingBreakpoint<TPayload>

export type DamageBreakpointProgression<TPayload extends object = object> = {
  [S in ScalingSource]: {
    breakpoints: DamageBreakpointProgressionLevel<TPayload>[]
  } & ScalingSourcePayload[S]
}[ScalingSource]

export type DamageBonusAuthored =
  | {
      id: string
      bonusKind: typeof DAMAGE_BONUS_KIND.ABILITY_BONUS
      ability: string
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

export type DamageFixedPayload =
  | {
      amount: number
      valueKind: typeof DAMAGE_VALUE_KIND.FIXED
      scalingKind: typeof SCALING.NONE
    }
  | ({
      valueKind: typeof DAMAGE_VALUE_KIND.FIXED
      scalingKind: typeof SCALING.PER_LEVEL
    } & DamageProgression<{ amount: number }>)
  | ({
      valueKind: typeof DAMAGE_VALUE_KIND.FIXED
      scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
    } & DamageBreakpointProgression<{ amount: number }>)

export type DamageDicePayload =
  | {
      diceConfig: string
      /**
       * The dice rolled instead while the source has half of its hit points or fewer (a swarm's
       * "or 1d6 piercing damage if the swarm has half of its hit points or fewer").
       */
      halfHitPointsDiceConfig?: string
      valueKind: typeof DAMAGE_VALUE_KIND.DICE
      scalingKind: typeof SCALING.NONE
    }
  | ({
      valueKind: typeof DAMAGE_VALUE_KIND.DICE
      scalingKind: typeof SCALING.PER_LEVEL
    } & DamageProgression<{ diceConfig: string }>)
  | ({
      valueKind: typeof DAMAGE_VALUE_KIND.DICE
      scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
    } & DamageBreakpointProgression<{ diceConfig: string }>)

export type DamagePoolPayload =
  | {
      amount: number
      valueKind: typeof DAMAGE_VALUE_KIND.POOL
      scalingKind: typeof SCALING.NONE
    }
  | ({
      valueKind: typeof DAMAGE_VALUE_KIND.POOL
      scalingKind: typeof SCALING.PER_LEVEL
      scalingSource: 'CHARACTER_LEVEL' | 'CLASS_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL'
      amount?: number
      multiplier?: number
      min?: number
      max?: number
    } & (
      | { scalingSource: 'CLASS_LEVEL'; classId: string }
      | { scalingSource: 'CHARACTER_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL' }
    ))

export type DamagePayload = DamageFixedPayload | DamageDicePayload | DamagePoolPayload

/**
 * A damage type is named, or taken from the weapon whose hit triggers a passive rider. The rider
 * form is resolved to the weapon's own type when the Character's weapon action is built.
 */
export type DamageTypeAuthored =
  | { damageTypeId: string; usesTriggeringWeaponDamageType?: false }
  | { usesTriggeringWeaponDamageType: true; damageTypeId?: never }

export type DamageAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.DAMAGE
  bonuses?: DamageBonusAuthored[]
  amountKind?: ScalingAmountKind
  multiplier?: number
} & DamageTypeAuthored &
  DamagePayload

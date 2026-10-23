import type { AbilityModifierReference, SCALING } from '#core'
import {
  EFFECT_KIND,
  SCALABLE_SCALING_KIND,
  type ScalingBreakpoint,
  type ScalingSource,
  type ScalingSourcePayload
} from '#core'

export type HealBonusAuthored =
  | {
      id: string
      bonusKind: 'ABILITY_BONUS'
      ability: AbilityModifierReference
      min?: number
      max?: number
      multiplier?: number
      order: number
    }
  | {
      id: string
      bonusKind: 'PROFICIENCY_BONUS'
      min?: number
      max?: number
      multiplier?: number
      order: number
    }
  | {
      id: string
      bonusKind: 'CLASS_LEVEL'
      classId: string
      min?: number
      max?: number
      multiplier?: number
      order: number
    }

export type HealingProgressionLevel<TPayload extends object = object> = {
  id: string
  level: number
  order: number
} & TPayload

export type HealingProgression<TPayload extends object = object> = {
  [S in ScalingSource]: {
    levels: HealingProgressionLevel<TPayload>[]
  } & ScalingSourcePayload[S]
}[ScalingSource]

export type HealBreakpointProgressionLevel<TPayload extends object = object> =
  ScalingBreakpoint<TPayload>

export type HealBreakpointProgression<TPayload extends object = object> = {
  [S in ScalingSource]: {
    breakpoints: HealBreakpointProgressionLevel<TPayload>[]
  } & ScalingSourcePayload[S]
}[ScalingSource]

export type HealFixedPayload =
  | {
      amount: number
      valueKind: 'FIXED'
      scalingKind: typeof SCALING.NONE
    }
  | ({
      valueKind: 'FIXED'
      scalingKind: typeof SCALING.PER_LEVEL
    } & HealingProgression<{ amount: number }>)
  | ({
      valueKind: 'FIXED'
      scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
    } & HealBreakpointProgression<{ amount: number }>)

export type HealDicePayload =
  | {
      diceConfig: string
      valueKind: 'DICE'
      scalingKind: typeof SCALING.NONE
    }
  | ({
      valueKind: 'DICE'
      scalingKind: typeof SCALING.PER_LEVEL
    } & HealingProgression<{ diceConfig: string }>)
  | ({
      valueKind: 'DICE'
      scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
    } & HealBreakpointProgression<{ diceConfig: string }>)

export type HealPoolPayload =
  | {
      amount: number
      valueKind: 'POOL'
      scalingKind: typeof SCALING.NONE
    }
  | ({
      valueKind: 'POOL'
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

/**
 * A fraction, rounded down, of the damage a sibling DAMAGE outcome of the same result block dealt
 * (after resistance). `recipient` names who regains it; the damage's target is never the recipient.
 */
export type HealDamageDealtPayload = {
  valueKind: 'DAMAGE_DEALT'
  scalingKind: typeof SCALING.NONE
  damageOutcomeId: string
  fraction: { numerator: number; denominator: number }
  recipient: 'SOURCE'
}

export type HealPayload =
  | HealFixedPayload
  | HealDicePayload
  | HealPoolPayload
  | HealDamageDealtPayload

export type HealAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.HEAL
  temporary?: boolean
  bonuses?: HealBonusAuthored[]
} & HealPayload

import type { AbilityCode, SCALING } from '#core'
import { EFFECT_KIND, type ScalingSource, type ScalingSourcePayload } from '#core'

export type HealBonusAuthored
  = | {
    id: string
    bonusKind: 'ABILITY_BONUS'
    ability: AbilityCode
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

export type HealingProgressionLevel<TPayload = object> = {
  id: string
  level: number
  order: number
} & TPayload

export type HealingProgression<TPayload = object> = {
  [S in ScalingSource]: {
    levels: HealingProgressionLevel<TPayload>[]
  } & ScalingSourcePayload[S]
}[ScalingSource]

export type HealFixedPayload
  = | {
    amount: number
    valueKind: 'FIXED'
    scalingKind: typeof SCALING.NONE
  } | ({
    valueKind: 'FIXED'
    scalingKind: typeof SCALING.PER_LEVEL
  } & HealingProgression<{ amount: number }>)

export type HealDicePayload
  = | {
    diceConfig: string
    valueKind: 'DICE'
    scalingKind: typeof SCALING.NONE
  } | ({
    valueKind: 'DICE'
    scalingKind: typeof SCALING.PER_LEVEL
  } & HealingProgression<{ diceConfig: string }>)

export type HealPoolPayload
  = | {
    amount: number
    valueKind: 'POOL'
    scalingKind: typeof SCALING.NONE
  } | ({
    valueKind: 'POOL'
    scalingKind: typeof SCALING.PER_LEVEL
    scalingSource: 'CHARACTER_LEVEL' | 'CLASS_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL'
    amount?: number
    multiplier?: number
    min?: number
    max?: number
  } & (
    | { scalingSource: 'CLASS_LEVEL', classId: string }
    | { scalingSource: 'CHARACTER_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL' }
  ))

export type HealPayload = HealFixedPayload | HealDicePayload | HealPoolPayload

export type HealAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.HEAL
  temporary?: boolean
  bonuses?: HealBonusAuthored[]
} & HealPayload

import {
  type CHARGE_BONUS_KIND,
  type SCALING,
  type AbilityCode,
  type ChargeResetKind
} from '#core'
import type { LevelScaledValue } from './scaling.js'

export type ChargeLimitPayload = {
  CHARACTER_LEVEL: {
    multiplier?: number
  }
  CLASS_LEVEL: {
    classId: string
    multiplier?: number
  }
  SPELL_LEVEL: {
    spellId: string
    multiplier?: number
  }
  FIXED_AMOUNT: {
    amount: number
  }
}

export type ChargeBonusAuthored
  = | {
    id: string
    bonusKind: typeof CHARGE_BONUS_KIND.ABILITY_MODIFIER
    ability: AbilityCode
    min?: number
    max?: number
    multiplier?: number
    order: number
  }
  | {
    id: string
    bonusKind: typeof CHARGE_BONUS_KIND.SKILL_BONUS
    skillId: string
    min?: number
    max?: number
    multiplier?: number
    order: number
  }
  | {
    id: string
    bonusKind: typeof CHARGE_BONUS_KIND.PROFICIENCY_BONUS
    min?: number
    max?: number
    multiplier?: number
    order: number
  }

export type ChargeBaseAuthored<TPayload>
  = | ({
    scalingKind: typeof SCALING.NONE
  } & TPayload)
  | ({
    scalingKind: typeof SCALING.PER_LEVEL
  } & LevelScaledValue<TPayload>)

export type ChargeAuthored = {
  [L in keyof ChargeLimitPayload]: {
    id: string
    resetKind: ChargeResetKind
    limitKind: L
    bonuses?: ChargeBonusAuthored[]
  } & ChargeBaseAuthored<ChargeLimitPayload[L]>
}[keyof ChargeLimitPayload]

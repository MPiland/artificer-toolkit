import { type CHARGE_BONUS_KIND, type SCALING, type ChargeResetKind } from '#core'

export type ChargeLimitPayload =
  | {
      limitKind: 'ABILITY_MODIFIER'
      scalingKind: 'NONE'
      ability: string
      min?: number
      max?: number
      multiplier?: number
    }
  | {
      limitKind: 'CHARACTER_LEVEL'
      scalingKind: 'NONE'
      multiplier?: number
      min?: number
      max?: number
    }
  | {
      limitKind: 'CLASS_LEVEL'
      scalingKind: 'NONE'
      classId: string
      multiplier?: number
      min?: number
      max?: number
    }
  | {
      limitKind: 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL'
      scalingKind: 'NONE'
      multiplier?: number
      min?: number
      max?: number
    }
  | {
      limitKind: 'FIXED_AMOUNT'
      scalingKind: 'NONE'
      amount: number
    }
  | {
      limitKind: 'FIXED_AMOUNT'
      scalingKind: typeof SCALING.PER_LEVEL
      levels: {
        id: string
        level: number
        amount: number
      }[]
    }

export type ChargeBonusAuthored =
  | {
      id: string
      bonusKind: typeof CHARGE_BONUS_KIND.ABILITY_MODIFIER
      ability: string
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

export type OwnedChargeAuthored = {
  id: string
  resetKind: ChargeResetKind
  bonuses?: ChargeBonusAuthored[]
} & ChargeLimitPayload

export type SourceChargeAuthored = {
  id: string
  limitKind: 'SOURCE_CHARGES'
  scalingKind: typeof SCALING.NONE
  cost: number
}

export type ChargeAuthored<AllowSourceCharges extends boolean = false> =
  | OwnedChargeAuthored
  | (AllowSourceCharges extends true ? SourceChargeAuthored : never)

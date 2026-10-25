import { assertNever } from '#utils'

import type { ChargeAuthored, ChargeBonusAuthored, OwnedChargeAuthored } from '#authored'
import { CHARGE_BONUS_KIND, SCALING, type OwnedChargeLimitKind, type ChargeResetKind } from '#core'

export type CompiledChargeLimitPayloadByKind = {
  ABILITY_MODIFIER: {
    ability: string
    multiplier?: number
    min?: number
    max?: number
  }
  CHARACTER_LEVEL: {
    multiplier?: number
    min?: number
    max?: number
  }
  CLASS_LEVEL: {
    classId: string
    multiplier?: number
    min?: number
    max?: number
  }
  PARENT_CLASS_LEVEL: {
    multiplier?: number
    min?: number
    max?: number
  }
  SPELL_CAST_LEVEL: {
    multiplier?: number
    min?: number
    max?: number
  }
  FIXED_AMOUNT: {
    amount: number
  }
}

export type CompiledChargeBonus =
  | {
      bonusKind: typeof CHARGE_BONUS_KIND.ABILITY_MODIFIER
      ability: string
      min?: number
      max?: number
      multiplier?: number
      order: number
    }
  | {
      bonusKind: typeof CHARGE_BONUS_KIND.SKILL_BONUS
      skillId: string
      min?: number
      max?: number
      multiplier?: number
      order: number
    }
  | {
      bonusKind: typeof CHARGE_BONUS_KIND.PROFICIENCY_BONUS
      min?: number
      max?: number
      multiplier?: number
      order: number
    }

export type CompiledCharge<L extends OwnedChargeLimitKind = OwnedChargeLimitKind> =
  | ({
      id: string
      resetKind: ChargeResetKind
      limitKind: Exclude<L, 'FIXED_AMOUNT'>
      bonuses?: CompiledChargeBonus[]
      scalingKind: typeof SCALING.NONE
    } & CompiledChargeLimitPayloadByKind[Exclude<L, 'FIXED_AMOUNT'>])
  | {
      id: string
      resetKind: ChargeResetKind
      limitKind: 'FIXED_AMOUNT'
      bonuses?: CompiledChargeBonus[]
      scalingKind: typeof SCALING.NONE
      amount: number
    }
  | {
      id: string
      resetKind: ChargeResetKind
      limitKind: 'FIXED_AMOUNT'
      bonuses?: CompiledChargeBonus[]
      scalingKind: typeof SCALING.PER_LEVEL
      levels: {
        id: string
        level: number
        amount: number
      }[]
    }

function compileChargeBonus(bonus: ChargeBonusAuthored): CompiledChargeBonus {
  switch (bonus.bonusKind) {
    case CHARGE_BONUS_KIND.ABILITY_MODIFIER:
      return {
        bonusKind: bonus.bonusKind,
        ability: bonus.ability,
        min: bonus.min,
        max: bonus.max,
        multiplier: bonus.multiplier,
        order: bonus.order
      }

    case CHARGE_BONUS_KIND.SKILL_BONUS:
      return {
        bonusKind: bonus.bonusKind,
        skillId: bonus.skillId,
        min: bonus.min,
        max: bonus.max,
        multiplier: bonus.multiplier,
        order: bonus.order
      }

    case CHARGE_BONUS_KIND.PROFICIENCY_BONUS:
      return {
        bonusKind: bonus.bonusKind,
        min: bonus.min,
        max: bonus.max,
        multiplier: bonus.multiplier,
        order: bonus.order
      }

    default:
      return assertNever(bonus)
  }
}

export type CompiledSourceCharge = {
  id: string
  limitKind: 'SOURCE_CHARGES'
  scalingKind: typeof SCALING.NONE
  cost: number
}

export type CompiledChargeUse = CompiledCharge | CompiledSourceCharge

export function compileCharge(authored: OwnedChargeAuthored): CompiledCharge {
  const bonuses =
    authored.bonuses && authored.bonuses.length
      ? authored.bonuses.map(compileChargeBonus)
      : undefined

  const base = {
    id: authored.id,
    resetKind: authored.resetKind,
    bonuses
  }

  switch (authored.limitKind) {
    case 'ABILITY_MODIFIER':
      return {
        ...base,
        limitKind: authored.limitKind,
        scalingKind: SCALING.NONE,
        ability: authored.ability,
        multiplier: authored.multiplier,
        min: authored.min,
        max: authored.max
      }

    case 'CHARACTER_LEVEL':
    case 'PARENT_CLASS_LEVEL':
    case 'SPELL_CAST_LEVEL':
      return {
        ...base,
        limitKind: authored.limitKind,
        scalingKind: SCALING.NONE,
        multiplier: authored.multiplier,
        min: authored.min,
        max: authored.max
      }

    case 'CLASS_LEVEL':
      return {
        ...base,
        limitKind: authored.limitKind,
        scalingKind: SCALING.NONE,
        classId: authored.classId,
        multiplier: authored.multiplier,
        min: authored.min,
        max: authored.max
      }

    case 'FIXED_AMOUNT':
      switch (authored.scalingKind) {
        case SCALING.NONE:
          return {
            ...base,
            limitKind: 'FIXED_AMOUNT',
            scalingKind: SCALING.NONE,
            amount: authored.amount
          }

        case SCALING.PER_LEVEL:
          return {
            ...base,
            limitKind: 'FIXED_AMOUNT',
            scalingKind: SCALING.PER_LEVEL,
            levels: authored.levels.map((entry) => ({
              id: entry.id,
              level: entry.level,
              amount: entry.amount
            }))
          }

        default:
          return assertNever(authored)
      }

    default:
      return assertNever(authored)
  }
}

export function compileChargeUse(authored: ChargeAuthored<true>): CompiledChargeUse {
  if (authored.limitKind === 'SOURCE_CHARGES') {
    return {
      id: authored.id,
      limitKind: authored.limitKind,
      scalingKind: SCALING.NONE,
      cost: authored.cost
    }
  }

  return compileCharge(authored)
}

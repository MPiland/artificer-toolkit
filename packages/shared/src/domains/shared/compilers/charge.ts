import { assertNever } from '#utils'

import type {
  ChargeAuthored,
  ChargeBonusAuthored
} from '#authored'
import {
  SCALING,
  type ScalingPayload,
  CHARGE_BONUS_KIND,
  type AbilityCode,
  type ScalingSource,
  type ChargeResetKind,
  type ChargeLimitKind
} from '#core'
import { compileScalingSource } from '#compilers'

export type CompiledChargeLimitPayload = {
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

export type CompiledChargeBonus
  = | {
    bonusKind: typeof CHARGE_BONUS_KIND.ABILITY_MODIFIER
    ability: AbilityCode
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

export type CompiledChargeDefinition<
  TPayload,
  TSource extends ScalingSource = ScalingSource
>
  = | ({
    scalingKind: typeof SCALING.NONE
  } & TPayload)
  | ({
    scalingKind: typeof SCALING.PER_LEVEL
    levels: ({
      level: number
      order: number
    } & TPayload)[]
  } & ScalingPayload<TSource>)

export type CompiledCharge<
  L extends ChargeLimitKind = ChargeLimitKind,
  TSource extends ScalingSource = ScalingSource
> = {
  id: string
  resetKind: ChargeResetKind
  limitKind: L
  bonuses?: CompiledChargeBonus[]
} & CompiledChargeDefinition<CompiledChargeLimitPayload[L], TSource>

function compileChargeBase(
  authored: ChargeAuthored
): CompiledChargeLimitPayload[keyof CompiledChargeLimitPayload] {
  switch (authored.limitKind) {
    case 'FIXED_AMOUNT': {
      const fixedAuthored = authored as Extract<ChargeAuthored, { limitKind: 'FIXED_AMOUNT' }>
      return {
        amount: (fixedAuthored as { amount: number }).amount
      }
    }

    case 'CHARACTER_LEVEL': {
      const charLevelAuthored = authored as Extract<ChargeAuthored, { limitKind: 'CHARACTER_LEVEL' }>
      return {
        multiplier: (charLevelAuthored as { multiplier?: number }).multiplier
      }
    }

    case 'CLASS_LEVEL': {
      const classLevelAuthored = authored as Extract<ChargeAuthored, { limitKind: 'CLASS_LEVEL' }>
      return {
        classId: (classLevelAuthored as { classId: string }).classId,
        multiplier: (classLevelAuthored as { multiplier?: number }).multiplier
      }
    }

    case 'SPELL_LEVEL': {
      const spellLevelAuthored = authored as Extract<ChargeAuthored, { limitKind: 'SPELL_LEVEL' }>
      return {
        spellId: (spellLevelAuthored as { spellId: string }).spellId,
        multiplier: (spellLevelAuthored as { multiplier?: number }).multiplier
      }
    }

    default:
      return assertNever(authored)
  }
}

function compileChargeBonus(bonus: ChargeBonusAuthored): CompiledChargeBonus {
  switch (bonus.bonusKind) {
    case 'ABILITY_MODIFIER':
      return {
        bonusKind: bonus.bonusKind,
        ability: bonus.ability,
        min: bonus.min,
        max: bonus.max,
        multiplier: bonus.multiplier,
        order: bonus.order
      }

    case 'SKILL_BONUS':
      return {
        bonusKind: bonus.bonusKind,
        skillId: bonus.skillId,
        min: bonus.min,
        max: bonus.max,
        multiplier: bonus.multiplier,
        order: bonus.order
      }

    case 'PROFICIENCY_BONUS':
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

export function compileCharge(authored: ChargeAuthored): CompiledCharge {
  const bonuses
    = authored.bonuses && authored.bonuses.length
      ? authored.bonuses.map(compileChargeBonus)
      : undefined
  const base = {
    id: authored.id,
    resetKind: authored.resetKind,
    limitKind: authored.limitKind,
    bonuses
  }

  switch (authored.scalingKind) {
    case SCALING.NONE: {
      return {
        ...base,
        scalingKind: SCALING.NONE,
        ...compileChargeBase(authored)
      }
    }

    case SCALING.PER_LEVEL: {
      return {
        scalingKind: SCALING.PER_LEVEL,
        ...compileScalingSource(authored),
        ...base,
        levels: authored.levels.map((entry) => ({
          level: entry.level,
          order: entry.order,
          ...compileChargeBase(authored)
        }))
      }
    }
  }
}

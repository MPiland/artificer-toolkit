import { assertNever } from '#utils'

import type { ChargeAuthored, ChargeBonusAuthored, OwnedChargeAuthored } from '#authored'
import {
  CHARGE_BONUS_KIND,
  SCALING,
  type AbilityCode,
  type OwnedChargeLimitKind,
  type ChargeResetKind
} from '#core'

export type CompiledChargeLimitPayloadByKind = {
  ABILITY_MODIFIER: {
    ability: AbilityCode
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

export interface ResolveCompiledChargeMaximumContext {
  abilities: Partial<Record<AbilityCode, number>>
  classLevels?: Readonly<Partial<Record<string, number>>>
  sourceClassLevel?: number
  spellCastLevel?: number
  skillBonuses?: Readonly<Partial<Record<string, number>>>
  proficiencyBonus: number
  totalLevel: number
}

function clampInteger(value: number, min?: number, max?: number): number {
  let result = value
  if (min !== undefined) result = Math.max(result, min)
  if (max !== undefined) result = Math.min(result, max)
  return Math.floor(result)
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function resolveCompiledChargeMaximum(
  charge: CompiledCharge,
  context: ResolveCompiledChargeMaximumContext
): number {
  let base = 0

  if (charge.scalingKind === SCALING.PER_LEVEL) {
    const sourceClassLevel = context.sourceClassLevel
    if (sourceClassLevel === undefined) {
      throw new Error(
        `Cannot resolve charge "${charge.id}": source class level is required for per-level scaling.`
      )
    }
    const entry = [...charge.levels]
      .sort((left, right) => right.level - left.level)
      .find((candidate) => candidate.level <= sourceClassLevel)
    base = entry?.amount ?? 0
  } else {
    switch (charge.limitKind) {
      case 'ABILITY_MODIFIER': {
        const abilityCharge = charge as CompiledCharge & {
          ability: string
          max?: number
          min?: number
          multiplier?: number
        }
        const score = context.abilities[abilityCharge.ability as AbilityCode]
        if (score === undefined) {
          throw new Error(
            `Cannot resolve charge "${charge.id}": ability score "${abilityCharge.ability}" is missing.`
          )
        }
        const raw = abilityModifier(score) * (abilityCharge.multiplier ?? 1)
        base = clampInteger(raw, abilityCharge.min, abilityCharge.max)
        break
      }
      case 'CHARACTER_LEVEL':
        base = clampInteger(context.totalLevel * (charge.multiplier ?? 1), charge.min, charge.max)
        break
      case 'CLASS_LEVEL': {
        const classCharge = charge as CompiledCharge & {
          classId: string
          multiplier?: number
          min?: number
          max?: number
        }
        const classLevel = context.classLevels?.[classCharge.classId]
        if (classLevel === undefined) {
          throw new Error(
            `Cannot resolve charge "${charge.id}": class level for "${classCharge.classId}" is missing.`
          )
        }
        base = clampInteger(
          classLevel * (classCharge.multiplier ?? 1),
          classCharge.min,
          classCharge.max
        )
        break
      }
      case 'PARENT_CLASS_LEVEL':
        if (context.sourceClassLevel === undefined) {
          throw new Error(`Cannot resolve charge "${charge.id}": source class level is required.`)
        }
        base = clampInteger(
          context.sourceClassLevel * (charge.multiplier ?? 1),
          charge.min,
          charge.max
        )
        break
      case 'FIXED_AMOUNT':
        base = charge.amount
        break
      case 'SPELL_CAST_LEVEL':
        if (context.spellCastLevel === undefined) {
          throw new Error(`Cannot resolve charge "${charge.id}": spell cast level is required.`)
        }
        base = clampInteger(
          context.spellCastLevel * (charge.multiplier ?? 1),
          charge.min,
          charge.max
        )
        break
    }
  }

  for (const bonus of charge.bonuses ?? []) {
    switch (bonus.bonusKind) {
      case CHARGE_BONUS_KIND.ABILITY_MODIFIER: {
        const score = context.abilities[bonus.ability]
        if (score === undefined) {
          throw new Error(
            `Cannot resolve charge "${charge.id}": bonus ability score "${bonus.ability}" is missing.`
          )
        }
        base += clampInteger(abilityModifier(score) * (bonus.multiplier ?? 1), bonus.min, bonus.max)
        break
      }
      case CHARGE_BONUS_KIND.PROFICIENCY_BONUS:
        base += clampInteger(
          context.proficiencyBonus * (bonus.multiplier ?? 1),
          bonus.min,
          bonus.max
        )
        break
      case CHARGE_BONUS_KIND.SKILL_BONUS: {
        const skillBonus = context.skillBonuses?.[bonus.skillId]
        if (skillBonus === undefined) {
          throw new Error(
            `Cannot resolve charge "${charge.id}": skill bonus for "${bonus.skillId}" is missing.`
          )
        }
        base += clampInteger(skillBonus * (bonus.multiplier ?? 1), bonus.min, bonus.max)
        break
      }
    }
  }

  return Math.max(0, Math.floor(base))
}

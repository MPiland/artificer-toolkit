import type { DamageAuthored, DamageBonusAuthored } from '#authored'
import {
  type AbilityModifierReference,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  SCALABLE_SCALING_KIND,
  SCALING_SOURCE,
  SCALING,
  ScalingSource,
  type ScalingPayload
} from '#core'
import { assertNever } from '#utils'

export type CompiledLevelScaledValue<
  TPayload,
  TSource extends ScalingSource
> = {
  scalingKind: typeof SCALING.PER_LEVEL
  level: number
  order: number
} & ScalingPayload<TSource>
& TPayload

export type CompiledBreakpointScaledValue<
  TPayload,
  TSource extends ScalingSource
> = {
  scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
  level: number
  order: number
} & ScalingPayload<TSource>
& TPayload

export type CompiledDamagePoolScaled<TSource extends ScalingSource> = {
  valueKind: typeof DAMAGE_VALUE_KIND.POOL
  scalingKind: typeof SCALING.PER_LEVEL
  amount?: number
  multiplier?: number
  min?: number
  max?: number
} & ScalingPayload<TSource>

export type CompiledDamageBonus
  = | {
    bonusKind: typeof DAMAGE_BONUS_KIND.PROFICIENCY_BONUS
    order: number
    min?: number
    max?: number
    multiplier?: number
  }
  | {
    bonusKind: typeof DAMAGE_BONUS_KIND.ABILITY_BONUS
    ability: AbilityModifierReference
    order: number
    min?: number
    max?: number
    multiplier?: number
  }
  | {
    bonusKind: typeof DAMAGE_BONUS_KIND.SKILL_BONUS
    skillId: string
    order: number
    min?: number
    max?: number
    multiplier?: number
  }

export type CompiledDamagePayloadByValue<
  S extends ScalingSource = ScalingSource
> = {
  [DAMAGE_VALUE_KIND.FIXED]:
    | {
      amount: number
      valueKind: typeof DAMAGE_VALUE_KIND.FIXED
      scalingKind: typeof SCALING.NONE
    }
    | ({
      valueKind: typeof DAMAGE_VALUE_KIND.FIXED
      scalingKind: typeof SCALING.PER_LEVEL
    } & CompiledLevelScaledValue<{ amount: number }, S>)
    | ({
      valueKind: typeof DAMAGE_VALUE_KIND.FIXED
      scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
    } & CompiledBreakpointScaledValue<{ amount: number }, S>)
  [DAMAGE_VALUE_KIND.DICE]:
    | {
      dice: string
      valueKind: typeof DAMAGE_VALUE_KIND.DICE
      scalingKind: typeof SCALING.NONE
    }
    | ({
      valueKind: typeof DAMAGE_VALUE_KIND.DICE
      scalingKind: typeof SCALING.PER_LEVEL
    } & CompiledLevelScaledValue<{ dice: string }, S>)
    | ({
      valueKind: typeof DAMAGE_VALUE_KIND.DICE
      scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
    } & CompiledBreakpointScaledValue<{ dice: string }, S>)
  [DAMAGE_VALUE_KIND.POOL]:
    | {
      amount: number
      valueKind: typeof DAMAGE_VALUE_KIND.POOL
      scalingKind: typeof SCALING.NONE
    }
    | ({
      valueKind: typeof DAMAGE_VALUE_KIND.POOL
      scalingKind: typeof SCALING.PER_LEVEL
    } & CompiledDamagePoolScaled<S>)
}

export type CompiledDamageValue<S extends ScalingSource>
  = CompiledDamagePayloadByValue<S>[keyof CompiledDamagePayloadByValue<S>]

export type CompiledDamageEffect<S extends ScalingSource = ScalingSource> = {
  id: string
  effectKind: typeof EFFECT_KIND.DAMAGE
  damageTypeId: string
  bonuses?: CompiledDamageBonus[]
  amountKind?: DamageAuthored['amountKind']
  multiplier?: number
} & CompiledDamageValue<S>

export function compileDamageBonuses(
  authored: DamageBonusAuthored
): CompiledDamageBonus {
  switch (authored.bonusKind) {
    case DAMAGE_BONUS_KIND.PROFICIENCY_BONUS:
      return {
        bonusKind: DAMAGE_BONUS_KIND.PROFICIENCY_BONUS,
        order: authored.order,
        min: authored.min,
        max: authored.max,
        multiplier: authored.multiplier
      }

    case DAMAGE_BONUS_KIND.ABILITY_BONUS:
      return {
        bonusKind: DAMAGE_BONUS_KIND.ABILITY_BONUS,
        ability: authored.ability,
        order: authored.order,
        min: authored.min,
        max: authored.max,
        multiplier: authored.multiplier
      }

    case DAMAGE_BONUS_KIND.SKILL_BONUS:
      return {
        bonusKind: DAMAGE_BONUS_KIND.SKILL_BONUS,
        skillId: authored.skillId,
        order: authored.order,
        min: authored.min,
        max: authored.max,
        multiplier: authored.multiplier
      }

    default:
      return assertNever(authored)
  }
}

export function compileDamageEffect(
  authored: DamageAuthored
): CompiledDamageEffect[] {
  const bonuses
    = authored.bonuses && authored.bonuses.length
      ? authored.bonuses.map(compileDamageBonuses)
      : undefined

  switch (authored.scalingKind) {
    case SCALING.NONE: {
      switch (authored.valueKind) {
        case DAMAGE_VALUE_KIND.FIXED: {
          return [{
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: DAMAGE_VALUE_KIND.FIXED,
            bonuses,
            amountKind: authored.amountKind,
            multiplier: authored.multiplier,
            scalingKind: SCALING.NONE,
            amount: authored.amount
          }]
        }

        case DAMAGE_VALUE_KIND.DICE: {
          return [{
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: authored.valueKind,
            dice: authored.diceConfig,
            bonuses,
            amountKind: authored.amountKind,
            multiplier: authored.multiplier,
            scalingKind: authored.scalingKind
          }]
        }

        case DAMAGE_VALUE_KIND.POOL: {
          return [{
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: authored.valueKind,
            amount: authored.amount,
            bonuses,
            amountKind: authored.amountKind,
            multiplier: authored.multiplier,
            scalingKind: authored.scalingKind
          }]
        }

        default:
          return assertNever(authored)
      }
    }

    case SCALING.PER_LEVEL: {
      switch (authored.valueKind) {
        case DAMAGE_VALUE_KIND.FIXED: {
          return authored.levels.map((entry) => {
            return {
              id: entry.id,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: authored.damageTypeId,
              valueKind: DAMAGE_VALUE_KIND.FIXED,
              level: entry.level,
              order: entry.order,
              amount: entry.amount,
              bonuses,
              amountKind: authored.amountKind,
              multiplier: authored.multiplier,
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: authored.scalingSource,
              ...(authored.scalingSource === SCALING_SOURCE.CLASS_LEVEL
                ? { classId: authored.classId }
                : {})
            } as CompiledDamageEffect
          })
        }
        case DAMAGE_VALUE_KIND.DICE: {
          return authored.levels.map((entry) => {
            return {
              id: entry.id,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: authored.damageTypeId,
              valueKind: DAMAGE_VALUE_KIND.DICE,
              level: entry.level,
              order: entry.order,
              dice: entry.diceConfig,
              bonuses,
              amountKind: authored.amountKind,
              multiplier: authored.multiplier,
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: authored.scalingSource,
              ...(authored.scalingSource === SCALING_SOURCE.CLASS_LEVEL
                ? { classId: authored.classId }
                : {})
            } as CompiledDamageEffect
          })
        }
        case DAMAGE_VALUE_KIND.POOL: {
          return [{
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: DAMAGE_VALUE_KIND.POOL,
            min: authored.min,
            max: authored.max,
            amount: authored.amount,
            multiplier: authored.multiplier,
            bonuses,
            amountKind: authored.amountKind,
            scalingKind: SCALING.PER_LEVEL,
            scalingSource: authored.scalingSource,
            ...(authored.scalingSource === SCALING_SOURCE.CLASS_LEVEL
              ? { classId: authored.classId }
              : {})
          } as CompiledDamageEffect]
        }
        default:
          return assertNever(authored)
      }
    }
    case SCALABLE_SCALING_KIND.BREAKPOINTS: {
      switch (authored.valueKind) {
        case DAMAGE_VALUE_KIND.FIXED: {
          return authored.breakpoints.map((entry) => {
            return {
              id: entry.id,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: authored.damageTypeId,
              valueKind: DAMAGE_VALUE_KIND.FIXED,
              level: entry.level,
              order: entry.order,
              amount: entry.value.amount,
              bonuses,
              amountKind: authored.amountKind,
              multiplier: authored.multiplier,
              scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
              scalingSource: authored.scalingSource,
              ...(authored.scalingSource === SCALING_SOURCE.CLASS_LEVEL
                ? { classId: authored.classId }
                : {})
            } as CompiledDamageEffect
          })
        }
        case DAMAGE_VALUE_KIND.DICE: {
          return authored.breakpoints.map((entry) => {
            return {
              id: entry.id,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: authored.damageTypeId,
              valueKind: DAMAGE_VALUE_KIND.DICE,
              level: entry.level,
              order: entry.order,
              dice: entry.value.diceConfig,
              bonuses,
              amountKind: authored.amountKind,
              multiplier: authored.multiplier,
              scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
              scalingSource: authored.scalingSource,
              ...(authored.scalingSource === SCALING_SOURCE.CLASS_LEVEL
                ? { classId: authored.classId }
                : {})
            } as CompiledDamageEffect
          })
        }
        default:
          return assertNever(authored)
      }
    }
    default:
      return assertNever(authored)
  }
}

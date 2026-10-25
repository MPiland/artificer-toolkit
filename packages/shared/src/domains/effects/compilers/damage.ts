import type { DamageAuthored, DamageBonusAuthored, DamageTypeAuthored } from '#authored'
import {
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

export type CompiledLevelScaledValue<TPayload, TSource extends ScalingSource> = {
  scalingKind: typeof SCALING.PER_LEVEL
  level: number
  order: number
} & ScalingPayload<TSource> &
  TPayload

export type CompiledBreakpointScaledValue<TPayload, TSource extends ScalingSource> = {
  scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
  level: number
  order: number
} & ScalingPayload<TSource> &
  TPayload

export type CompiledDamagePoolScaled<TSource extends ScalingSource> = {
  valueKind: typeof DAMAGE_VALUE_KIND.POOL
  scalingKind: typeof SCALING.PER_LEVEL
  amount?: number
  multiplier?: number
  min?: number
  max?: number
} & ScalingPayload<TSource>

export type CompiledDamageBonus =
  | {
      bonusKind: typeof DAMAGE_BONUS_KIND.PROFICIENCY_BONUS
      order: number
      min?: number
      max?: number
      multiplier?: number
    }
  | {
      bonusKind: typeof DAMAGE_BONUS_KIND.ABILITY_BONUS
      ability: string
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

export type CompiledDamagePayloadByValue<S extends ScalingSource = ScalingSource> = {
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
        /** Rolled instead while the source has half of its hit points or fewer. */
        halfHitPointsDice?: string
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

export type CompiledDamageValue<S extends ScalingSource> =
  CompiledDamagePayloadByValue<S>[keyof CompiledDamagePayloadByValue<S>]

export type CompiledDamageEffect<S extends ScalingSource = ScalingSource> = {
  id: string
  effectKind: typeof EFFECT_KIND.DAMAGE
  bonuses?: CompiledDamageBonus[]
  amountKind?: DamageAuthored['amountKind']
  multiplier?: number
} & DamageTypeAuthored &
  CompiledDamageValue<S>

export function compileDamageBonuses(authored: DamageBonusAuthored): CompiledDamageBonus {
  const optionalBounds = {
    ...(authored.min === undefined ? {} : { min: authored.min }),
    ...(authored.max === undefined ? {} : { max: authored.max }),
    ...(authored.multiplier === undefined ? {} : { multiplier: authored.multiplier })
  }
  switch (authored.bonusKind) {
    case DAMAGE_BONUS_KIND.PROFICIENCY_BONUS:
      return {
        bonusKind: DAMAGE_BONUS_KIND.PROFICIENCY_BONUS,
        order: authored.order,
        ...optionalBounds
      }

    case DAMAGE_BONUS_KIND.ABILITY_BONUS:
      return {
        bonusKind: DAMAGE_BONUS_KIND.ABILITY_BONUS,
        ability: authored.ability,
        order: authored.order,
        ...optionalBounds
      }

    case DAMAGE_BONUS_KIND.SKILL_BONUS:
      return {
        bonusKind: DAMAGE_BONUS_KIND.SKILL_BONUS,
        skillId: authored.skillId,
        order: authored.order,
        ...optionalBounds
      }

    default:
      return assertNever(authored)
  }
}

export function compileDamageEffect(authored: DamageAuthored): CompiledDamageEffect[] {
  const bonusFields =
    authored.bonuses && authored.bonuses.length
      ? { bonuses: authored.bonuses.map(compileDamageBonuses) }
      : {}
  const presentationFields = {
    ...(authored.amountKind === undefined ? {} : { amountKind: authored.amountKind }),
    ...(authored.multiplier === undefined ? {} : { multiplier: authored.multiplier })
  }
  const damageTypeFields: DamageTypeAuthored = authored.usesTriggeringWeaponDamageType
    ? { usesTriggeringWeaponDamageType: true }
    : { damageTypeId: authored.damageTypeId }

  switch (authored.scalingKind) {
    case SCALING.NONE: {
      switch (authored.valueKind) {
        case DAMAGE_VALUE_KIND.FIXED: {
          return [
            {
              id: authored.id,
              effectKind: EFFECT_KIND.DAMAGE,
              ...damageTypeFields,
              valueKind: DAMAGE_VALUE_KIND.FIXED,
              ...bonusFields,
              ...presentationFields,
              scalingKind: SCALING.NONE,
              amount: authored.amount
            }
          ]
        }

        case DAMAGE_VALUE_KIND.DICE: {
          return [
            {
              id: authored.id,
              effectKind: EFFECT_KIND.DAMAGE,
              ...damageTypeFields,
              valueKind: authored.valueKind,
              dice: authored.diceConfig,
              ...(authored.halfHitPointsDiceConfig === undefined
                ? {}
                : { halfHitPointsDice: authored.halfHitPointsDiceConfig }),
              ...bonusFields,
              ...presentationFields,
              scalingKind: authored.scalingKind
            }
          ]
        }

        case DAMAGE_VALUE_KIND.POOL: {
          return [
            {
              id: authored.id,
              effectKind: EFFECT_KIND.DAMAGE,
              ...damageTypeFields,
              valueKind: authored.valueKind,
              amount: authored.amount,
              ...bonusFields,
              ...presentationFields,
              scalingKind: authored.scalingKind
            }
          ]
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
              ...damageTypeFields,
              valueKind: DAMAGE_VALUE_KIND.FIXED,
              level: entry.level,
              order: entry.order,
              amount: entry.amount,
              ...bonusFields,
              ...presentationFields,
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
              ...damageTypeFields,
              valueKind: DAMAGE_VALUE_KIND.DICE,
              level: entry.level,
              order: entry.order,
              dice: entry.diceConfig,
              ...bonusFields,
              ...presentationFields,
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: authored.scalingSource,
              ...(authored.scalingSource === SCALING_SOURCE.CLASS_LEVEL
                ? { classId: authored.classId }
                : {})
            } as CompiledDamageEffect
          })
        }
        case DAMAGE_VALUE_KIND.POOL: {
          return [
            {
              id: authored.id,
              effectKind: EFFECT_KIND.DAMAGE,
              ...damageTypeFields,
              valueKind: DAMAGE_VALUE_KIND.POOL,
              ...(authored.min === undefined ? {} : { min: authored.min }),
              ...(authored.max === undefined ? {} : { max: authored.max }),
              amount: authored.amount,
              ...presentationFields,
              ...bonusFields,
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: authored.scalingSource,
              ...(authored.scalingSource === SCALING_SOURCE.CLASS_LEVEL
                ? { classId: authored.classId }
                : {})
            } as CompiledDamageEffect
          ]
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
              ...damageTypeFields,
              valueKind: DAMAGE_VALUE_KIND.FIXED,
              level: entry.level,
              order: entry.order,
              amount: entry.value.amount,
              ...bonusFields,
              ...presentationFields,
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
              ...damageTypeFields,
              valueKind: DAMAGE_VALUE_KIND.DICE,
              level: entry.level,
              order: entry.order,
              dice: entry.value.diceConfig,
              ...bonusFields,
              ...presentationFields,
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

import type { DamageAuthored, DamageBonusAuthored } from '#authored'
import {
  AbilityCode,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  SCALING,
  SCALING_SOURCE,
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
    ability: AbilityCode
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
  const outcomes: CompiledDamageEffect[] = []
  const bonuses
    = authored.bonuses && authored.bonuses.length
      ? authored.bonuses.map(compileDamageBonuses)
      : undefined
  // handle each DamageValueKind separately because POOL scaling is different
  switch (authored.scalingKind) {
    case SCALING.NONE: {
      switch (authored.valueKind) {
        case DAMAGE_VALUE_KIND.FIXED: {
          outcomes.push({
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: DAMAGE_VALUE_KIND.FIXED,
            bonuses,
            scalingKind: SCALING.NONE,
            amount: authored.amount
          })
          break
        }

        case DAMAGE_VALUE_KIND.DICE: {
          outcomes.push({
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: authored.valueKind,
            dice: authored.diceConfig,
            bonuses,
            scalingKind: authored.scalingKind
          })
          break
        }

        case DAMAGE_VALUE_KIND.POOL: {
          outcomes.push({
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: authored.valueKind,
            amount: authored.amount,
            bonuses,
            scalingKind: authored.scalingKind
          })
          break
        }

        default:
          return assertNever(authored)
      }
      break
    }

    case SCALING.PER_LEVEL: {
      const scaling: ScalingPayload<typeof authored.scalingSource> = (() => {
        switch (authored.scalingSource) {
          case SCALING_SOURCE.CHARACTER_LEVEL:
            return {
              scalingSource: SCALING_SOURCE.CHARACTER_LEVEL
            }

          case SCALING_SOURCE.CLASS_LEVEL: {
            return {
              scalingSource: SCALING_SOURCE.CLASS_LEVEL,
              classId: authored.classId
            }
          }

          case SCALING_SOURCE.SPELL_LEVEL: {
            return {
              scalingSource: SCALING_SOURCE.SPELL_LEVEL,
              spellId: authored.spellId
            }
          }

          default:
            return assertNever(authored)
        }
      })()
      switch (authored.valueKind) {
        case DAMAGE_VALUE_KIND.FIXED: {
          const levels = authored.levels.map((entry) => {
            return {
              id: entry.id,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: authored.damageTypeId,
              valueKind: DAMAGE_VALUE_KIND.FIXED,
              level: entry.level,
              order: entry.order,
              amount: entry.amount,
              bonuses,
              scalingKind: SCALING.PER_LEVEL,
              ...scaling
            }
          })
          outcomes.push(...levels)
          break
        }
        case DAMAGE_VALUE_KIND.DICE: {
          const level = authored.levels.map((entry) => {
            return {
              id: entry.id,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: authored.damageTypeId,
              valueKind: DAMAGE_VALUE_KIND.DICE,
              level: entry.level,
              order: entry.order,
              dice: entry.diceConfig,
              bonuses,
              scalingKind: SCALING.PER_LEVEL,
              ...scaling
            }
          })
          outcomes.push(...level)
          break
        }
        case DAMAGE_VALUE_KIND.POOL: {
          outcomes.push({
            id: authored.id,
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: authored.damageTypeId,
            valueKind: DAMAGE_VALUE_KIND.POOL,
            min: authored.min,
            max: authored.max,
            amount: authored.amount,
            multiplier: authored.multiplier,
            bonuses,
            scalingKind: SCALING.PER_LEVEL,
            ...scaling
          })

          break
        }
        default:
          return assertNever(authored)
      }

      break
    }
    default:
      return assertNever(authored)
  }

  return outcomes
}

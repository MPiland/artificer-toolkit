import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

/**
 * Defines how a damage amount is structurally determined.
 * This is engine-owned vocabulary (not author behavior).
 */
export const DAMAGE_VALUE_KIND = {
  DICE: 'DICE',
  FIXED: 'FIXED',
  POOL: 'POOL'
} as const

export type DamageValueKind = keyof typeof DAMAGE_VALUE_KIND

export type DamageValueOption = CoreMeta<DamageValueKind>

/**
 * Registry of supported damage value kinds.
 * These define structure only — not scaling or math semantics.
 */
export const DAMAGE_VALUE_REGISTRY: Record<DamageValueKind, DamageValueOption> = {
  [DAMAGE_VALUE_KIND.DICE]: {
    code: DAMAGE_VALUE_KIND.DICE,
    label: 'Dice',
    description: 'Damage is determined by rolling one or more dice.',
    tooltip: 'Roll damage dice such as 1d8 or 2d6.'
  },

  [DAMAGE_VALUE_KIND.FIXED]: {
    code: DAMAGE_VALUE_KIND.FIXED,
    label: 'Fixed Value',
    description: 'Damage is determined by a fixed numeric expression.',
    tooltip:
      'Use a fixed value or a value derived from level, ability, or proficiency.'
  },

  [DAMAGE_VALUE_KIND.POOL]: {
    code: DAMAGE_VALUE_KIND.POOL,
    label: 'Pool',
    description: 'Damage is drawn from a shared pool with optional limits.',
    tooltip: 'Use a pool of damage that can be partially or fully expended.'
  }
}

export const DAMAGE_VALUE_OPTIONS = valuesOf(DAMAGE_VALUE_REGISTRY) as readonly DamageValueOption[]

export const DAMAGE_BONUS_KIND = {
  ABILITY_BONUS: 'ABILITY_BONUS',
  SKILL_BONUS: 'SKILL_BONUS',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS'
} as const

export type DamageBonusKind = keyof typeof DAMAGE_BONUS_KIND

export type DamageBonusOption = CoreMeta<DamageBonusKind>

export const DAMAGE_BONUS_REGISTRY: Record<DamageBonusKind, DamageBonusOption>
  = {
    [DAMAGE_BONUS_KIND.ABILITY_BONUS]: {
      code: DAMAGE_BONUS_KIND.ABILITY_BONUS,
      label: 'Ability Bonus',
      tooltip: 'Adds ability bonus to damage.',
      description: 'Uses a chosen ability bonus for to add to the damage.'
    },

    [DAMAGE_BONUS_KIND.SKILL_BONUS]: {
      code: DAMAGE_BONUS_KIND.SKILL_BONUS,
      label: 'Skill Bonus',
      tooltip: 'Adds skill bonus to damage.',
      description: 'Uses a chosen skill bonus for to add to the damage.'
    },

    [DAMAGE_BONUS_KIND.PROFICIENCY_BONUS]: {
      code: DAMAGE_BONUS_KIND.PROFICIENCY_BONUS,
      label: 'Proficiency Bonus',
      tooltip: 'Adds proficiency bonus to damage.',
      description:
        'Uses character\'s proficiency bonus for to add to the damage.'
    }
  }

export const DAMAGE_BONUS_OPTIONS = valuesOf(DAMAGE_BONUS_REGISTRY) as readonly DamageBonusOption[]

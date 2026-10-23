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
    description: 'Roll damage dice such as 1d8 or 2d6.'
  },

  [DAMAGE_VALUE_KIND.FIXED]: {
    code: DAMAGE_VALUE_KIND.FIXED,
    label: 'Fixed Value',
    description: 'Use a fixed value or a value derived from level, ability, or proficiency.'
  },

  [DAMAGE_VALUE_KIND.POOL]: {
    code: DAMAGE_VALUE_KIND.POOL,
    label: 'Pool',
    description: 'Use a pool of damage that can be partially or fully expended.'
  }
}

export const DAMAGE_VALUE_OPTIONS = valuesOf(DAMAGE_VALUE_REGISTRY) as readonly DamageValueOption[]

/** A heal's value kinds: a damage's, plus a fraction of the damage a sibling outcome dealt. */
export const HEAL_VALUE_OPTIONS: readonly CoreMeta<DamageValueKind | 'DAMAGE_DEALT'>[] = [
  ...DAMAGE_VALUE_OPTIONS,
  {
    code: 'DAMAGE_DEALT',
    label: 'Damage Dealt',
    description: 'Regain a fraction of the damage another outcome of this result dealt.'
  }
]

export const DAMAGE_BONUS_KIND = {
  ABILITY_BONUS: 'ABILITY_BONUS',
  SKILL_BONUS: 'SKILL_BONUS',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS'
} as const

export type DamageBonusKind = keyof typeof DAMAGE_BONUS_KIND

export type DamageBonusOption = CoreMeta<DamageBonusKind>

export const DAMAGE_BONUS_REGISTRY: Record<DamageBonusKind, DamageBonusOption> = {
  [DAMAGE_BONUS_KIND.ABILITY_BONUS]: {
    code: DAMAGE_BONUS_KIND.ABILITY_BONUS,
    label: 'Ability Bonus',
    description: 'Adds ability bonus to damage.'
  },

  [DAMAGE_BONUS_KIND.SKILL_BONUS]: {
    code: DAMAGE_BONUS_KIND.SKILL_BONUS,
    label: 'Skill Bonus',
    description: 'Adds skill bonus to damage.'
  },

  [DAMAGE_BONUS_KIND.PROFICIENCY_BONUS]: {
    code: DAMAGE_BONUS_KIND.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    description: 'Adds proficiency bonus to damage.'
  }
}

export const DAMAGE_BONUS_OPTIONS = valuesOf(DAMAGE_BONUS_REGISTRY) as readonly DamageBonusOption[]

export const SAVE_SUCCESS_OUTCOME_KIND = {
  NONE: 'NONE',
  HALF: 'HALF'
} as const

export type SaveSuccessOutcomeKind = keyof typeof SAVE_SUCCESS_OUTCOME_KIND

export type SaveSuccessOutcomeOption = CoreMeta<SaveSuccessOutcomeKind>

export const SAVE_SUCCESS_OUTCOME_REGISTRY: Record<
  SaveSuccessOutcomeKind,
  SaveSuccessOutcomeOption
> = {
  [SAVE_SUCCESS_OUTCOME_KIND.NONE]: {
    code: SAVE_SUCCESS_OUTCOME_KIND.NONE,
    label: 'No Effect On Success',
    description: 'Use when a successful save negates the damage.'
  },
  [SAVE_SUCCESS_OUTCOME_KIND.HALF]: {
    code: SAVE_SUCCESS_OUTCOME_KIND.HALF,
    label: 'Half On Success',
    description: 'Use when a successful save halves the damage.'
  }
}

export const SAVE_SUCCESS_OUTCOME_OPTIONS = valuesOf(
  SAVE_SUCCESS_OUTCOME_REGISTRY
) as readonly SaveSuccessOutcomeOption[]

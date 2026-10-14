import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const CHARGE_SCALING = {
  NONE: 'NONE',
  PER_LEVEL: 'PER_LEVEL'
} as const

export type ChargeScalingKind = keyof typeof CHARGE_SCALING

export type ChargeScalingOption = CoreMeta<ChargeScalingKind>

export const CHARGE_SCALING_REGISTRY: Record<ChargeScalingKind, ChargeScalingOption> = {
  [CHARGE_SCALING.NONE]: {
    code: CHARGE_SCALING.NONE,
    label: 'No Scaling',
    description: 'This charge does not change as the character levels up.'
  },

  [CHARGE_SCALING.PER_LEVEL]: {
    code: CHARGE_SCALING.PER_LEVEL,
    label: 'Scales by Level',
    description: 'This charge changes based on character level.'
  }
} as const

export const CHARGE_SCALING_OPTIONS = valuesOf(
  CHARGE_SCALING_REGISTRY
) as readonly ChargeScalingOption[]

export const CHARGE_RESET_KIND = {
  DAILY: 'DAILY',
  DAWN: 'DAWN',
  DUSK: 'DUSK',
  LONG_REST: 'LONG_REST',
  SHORT_REST: 'SHORT_REST',
  MANUAL: 'MANUAL'
} as const

export type ChargeResetKind = keyof typeof CHARGE_RESET_KIND

export type ChargeResetOption = CoreMeta<ChargeResetKind>

export const CHARGE_RESET_REGISTRY: Record<keyof typeof CHARGE_RESET_KIND, ChargeResetOption> = {
  [CHARGE_RESET_KIND.DAILY]: {
    code: CHARGE_RESET_KIND.DAILY,
    label: 'Daily',
    description: 'All uses are restored when the player applies daily recovery.'
  },

  [CHARGE_RESET_KIND.DAWN]: {
    code: CHARGE_RESET_KIND.DAWN,
    label: 'Dawn',
    description: 'All uses are restored when the player applies dawn recovery.'
  },

  [CHARGE_RESET_KIND.DUSK]: {
    code: CHARGE_RESET_KIND.DUSK,
    label: 'Dusk',
    description: 'All uses are restored when the player applies dusk recovery.'
  },

  [CHARGE_RESET_KIND.LONG_REST]: {
    code: CHARGE_RESET_KIND.LONG_REST,
    label: 'Long Rest',
    description: 'All uses are restored after a long rest.'
  },

  [CHARGE_RESET_KIND.SHORT_REST]: {
    code: CHARGE_RESET_KIND.SHORT_REST,
    label: 'Short Rest',
    description: 'All uses are restored after a short rest.'
  },

  [CHARGE_RESET_KIND.MANUAL]: {
    code: CHARGE_RESET_KIND.MANUAL,
    label: 'Manual',
    description: 'Uses must be restored manually.'
  }
} as const

export const CHARGE_RESET_OPTIONS = valuesOf(CHARGE_RESET_REGISTRY) as readonly ChargeResetOption[]

export const CHARGE_LIMIT_KIND = {
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  PARENT_CLASS_LEVEL: 'PARENT_CLASS_LEVEL',
  SPELL_CAST_LEVEL: 'SPELL_CAST_LEVEL',
  ABILITY_MODIFIER: 'ABILITY_MODIFIER',
  SOURCE_CHARGES: 'SOURCE_CHARGES'
} as const

export type ChargeLimitKind = keyof typeof CHARGE_LIMIT_KIND
export type OwnedChargeLimitKind = Exclude<ChargeLimitKind, 'SOURCE_CHARGES'>

export type ChargeLimitOption = CoreMeta<ChargeLimitKind>

export const CHARGE_LIMIT_REGISTRY: Record<ChargeLimitKind, ChargeLimitOption> = {
  [CHARGE_LIMIT_KIND.FIXED_AMOUNT]: {
    code: CHARGE_LIMIT_KIND.FIXED_AMOUNT,
    label: 'Fixed amount',
    description: 'Sets to a fixed number.'
  },

  [CHARGE_LIMIT_KIND.CHARACTER_LEVEL]: {
    code: CHARGE_LIMIT_KIND.CHARACTER_LEVEL,
    label: 'Character Level',
    description: "Uses the character's level."
  },

  [CHARGE_LIMIT_KIND.CLASS_LEVEL]: {
    code: CHARGE_LIMIT_KIND.CLASS_LEVEL,
    label: 'Class Level',
    description: 'Uses a specific class level.'
  },

  [CHARGE_LIMIT_KIND.PARENT_CLASS_LEVEL]: {
    code: CHARGE_LIMIT_KIND.PARENT_CLASS_LEVEL,
    label: 'Parent Class Level',
    description: 'Uses the owning class level.'
  },

  [CHARGE_LIMIT_KIND.SPELL_CAST_LEVEL]: {
    code: CHARGE_LIMIT_KIND.SPELL_CAST_LEVEL,
    label: 'Spell Cast Level',
    description: 'Uses the actual cast level.'
  },

  [CHARGE_LIMIT_KIND.ABILITY_MODIFIER]: {
    code: CHARGE_LIMIT_KIND.ABILITY_MODIFIER,
    label: 'Ability Modifier',
    description: 'Uses equal to an ability score modifier.'
  },

  [CHARGE_LIMIT_KIND.SOURCE_CHARGES]: {
    code: CHARGE_LIMIT_KIND.SOURCE_CHARGES,
    label: 'Source Charges',
    description: 'Consumes charges from the containing source.'
  }
} as const

export const SOURCE_CHARGE_LIMIT_OPTION = CHARGE_LIMIT_REGISTRY[CHARGE_LIMIT_KIND.SOURCE_CHARGES]

export const CHARGE_LIMIT_OPTIONS = valuesOf(CHARGE_LIMIT_REGISTRY).filter(
  (option): option is ChargeLimitOption & { code: OwnedChargeLimitKind } =>
    option.code !== CHARGE_LIMIT_KIND.SOURCE_CHARGES
)

export const CHARGE_BONUS_KIND = {
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  ABILITY_MODIFIER: 'ABILITY_MODIFIER',
  SKILL_BONUS: 'SKILL_BONUS'
} as const

export type ChargeBonusKind = keyof typeof CHARGE_BONUS_KIND

export type ChargeBonusOption = CoreMeta<ChargeBonusKind>

export const CHARGE_BONUS_REGISTRY: Record<ChargeBonusKind, ChargeBonusOption> = {
  [CHARGE_BONUS_KIND.PROFICIENCY_BONUS]: {
    code: CHARGE_BONUS_KIND.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    description: 'Adds your proficiency bonus to the number of uses.'
  },

  [CHARGE_BONUS_KIND.ABILITY_MODIFIER]: {
    code: CHARGE_BONUS_KIND.ABILITY_MODIFIER,
    label: 'Ability Modifier',
    description: 'Adds an ability score modifier to the number of uses.'
  },

  [CHARGE_BONUS_KIND.SKILL_BONUS]: {
    code: CHARGE_BONUS_KIND.SKILL_BONUS,
    label: 'Skill Bonus',
    description: 'Adds a bonus based on a specific skill.'
  }
} as const

export const CHARGE_BONUS_OPTIONS = valuesOf(CHARGE_BONUS_REGISTRY) as readonly ChargeBonusOption[]

import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const CHARGE_SCALING = {
  NONE: 'NONE',
  PER_LEVEL: 'PER_LEVEL'
} as const

export type ChargeScalingKind = keyof typeof CHARGE_SCALING

export type ChargeScalingOption = CoreMeta<ChargeScalingKind>

export const CHARGE_SCALING_REGISTRY: Record<
  ChargeScalingKind,
  ChargeScalingOption
> = {
  [CHARGE_SCALING.NONE]: {
    code: CHARGE_SCALING.NONE,
    label: 'No Scaling',
    tooltip: 'This charge does not change as the character levels up.',
    description:
      'The chargeed content remains the same regardless of character level.'
  },

  [CHARGE_SCALING.PER_LEVEL]: {
    code: CHARGE_SCALING.PER_LEVEL,
    label: 'Scales by Level',
    tooltip: 'This charge changes based on character level.',
    description:
      'The charge content varies as the character gains levels, using level-based rules.'
  }
} as const

export const CHARGE_SCALING_OPTIONS = valuesOf(CHARGE_SCALING_REGISTRY) as readonly ChargeScalingOption[]

export const CHARGE_RESET_KIND = {
  LONG_REST: 'LONG_REST',
  SHORT_REST: 'SHORT_REST',
  MANUAL: 'MANUAL'
} as const

export type ChargeResetKind = keyof typeof CHARGE_RESET_KIND

export type ChargeResetOption = CoreMeta<ChargeResetKind>

export const CHARGE_RESET_REGISTRY: Record<
  keyof typeof CHARGE_RESET_KIND,
  ChargeResetOption
> = {
  [CHARGE_RESET_KIND.LONG_REST]: {
    code: CHARGE_RESET_KIND.LONG_REST,
    label: 'Long Rest',
    tooltip: 'All uses are restored after a long rest.',
    description:
      'The feature regains all of its uses when the character finishes a long rest.'
  },

  [CHARGE_RESET_KIND.SHORT_REST]: {
    code: CHARGE_RESET_KIND.SHORT_REST,
    label: 'Short Rest',
    tooltip: 'All uses are restored after a short rest.',
    description:
      'The feature regains all of its uses when the character finishes a short rest.'
  },

  [CHARGE_RESET_KIND.MANUAL]: {
    code: CHARGE_RESET_KIND.MANUAL,
    label: 'Manual',
    tooltip: 'Uses must be restored manually.',
    description:
      'Uses do not automatically refresh and must be restored by another rule or effect.'
  }
} as const

export const CHARGE_RESET_OPTIONS = valuesOf(
  CHARGE_RESET_REGISTRY
) as readonly ChargeResetOption[]

export const CHARGE_LIMIT_KIND = {
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  SOURCE_LEVEL: 'SOURCE_LEVEL'
} as const

export type ChargeLimitKind = keyof typeof CHARGE_LIMIT_KIND

export type ChargeLimitOption = CoreMeta<ChargeLimitKind>

export const CHARGE_LIMIT_REGISTRY: Record<ChargeLimitKind, ChargeLimitOption>
  = {
    [CHARGE_LIMIT_KIND.FIXED_AMOUNT]: {
      code: CHARGE_LIMIT_KIND.FIXED_AMOUNT,
      label: 'Fixed amount',
      tooltip: 'Sets to a fixed number.',
      description:
        'Sets the charges to a fixed amount that can still have bonuses added.'
    },

    [CHARGE_LIMIT_KIND.CHARACTER_LEVEL]: {
      code: CHARGE_LIMIT_KIND.CHARACTER_LEVEL,
      label: 'Character Level',
      tooltip: 'Uses the character\'s level.',
      description:
        'The number of uses increases based on the character\'s overall level.'
    },

    [CHARGE_LIMIT_KIND.SOURCE_LEVEL]: {
      code: CHARGE_LIMIT_KIND.SOURCE_LEVEL,
      label: 'Source Level',
      tooltip: 'Uses the source\'s level.',
      description:
        'The number of uses increases based on the source\'s level.'
    }
  } as const

export const CHARGE_LIMIT_OPTIONS = valuesOf(
  CHARGE_LIMIT_REGISTRY
) as readonly ChargeLimitOption[]

export const CHARGE_BONUS_KIND = {
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  ABILITY_MODIFIER: 'ABILITY_MODIFIER',
  SKILL_BONUS: 'SKILL_BONUS'
} as const

export type ChargeBonusKind = keyof typeof CHARGE_BONUS_KIND

export type ChargeBonusOption = CoreMeta<ChargeBonusKind>

export const CHARGE_BONUS_REGISTRY: Record<ChargeBonusKind, ChargeBonusOption>
  = {
    [CHARGE_BONUS_KIND.PROFICIENCY_BONUS]: {
      code: CHARGE_BONUS_KIND.PROFICIENCY_BONUS,
      label: 'Proficiency Bonus',
      tooltip: 'Adds your proficiency bonus to the number of uses.',
      description:
        'The number of uses increases based on the character’s proficiency bonus.'
    },

    [CHARGE_BONUS_KIND.ABILITY_MODIFIER]: {
      code: CHARGE_BONUS_KIND.ABILITY_MODIFIER,
      label: 'Ability Modifier',
      tooltip: 'Adds an ability score modifier to the number of uses.',
      description:
        'The number of uses increases based on a chosen ability score modifier.'
    },

    [CHARGE_BONUS_KIND.SKILL_BONUS]: {
      code: CHARGE_BONUS_KIND.SKILL_BONUS,
      label: 'Skill Bonus',
      tooltip: 'Adds a bonus based on a specific skill.',
      description:
        'The number of uses increases based on the character’s bonus in a chosen skill.'
    }
  } as const

export const CHARGE_BONUS_OPTIONS = valuesOf(CHARGE_BONUS_REGISTRY) as readonly ChargeBonusOption[]

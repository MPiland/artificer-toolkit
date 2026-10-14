import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const SAVING_THROW_DC_METHOD = {
  SOURCE_SAVE_DC: 'SOURCE_SAVE_DC',
  FIXED_DC: 'FIXED_DC',
  DERIVED_DC: 'DERIVED_DC'
} as const

export type SavingThrowDcMethod = keyof typeof SAVING_THROW_DC_METHOD

export type SavingThrowDcMethodOption = CoreMeta<SavingThrowDcMethod>

export const SAVING_THROW_DC_METHOD_REGISTRY: Record<
  (typeof SAVING_THROW_DC_METHOD)[keyof typeof SAVING_THROW_DC_METHOD],
  SavingThrowDcMethodOption
> = {
  [SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC]: {
    code: SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC,
    label: 'Source Save DC',
    description: 'Owning source save DC.'
  },
  [SAVING_THROW_DC_METHOD.FIXED_DC]: {
    code: SAVING_THROW_DC_METHOD.FIXED_DC,
    label: 'Fixed DC',
    description: 'Fixed DC.'
  },
  [SAVING_THROW_DC_METHOD.DERIVED_DC]: {
    code: SAVING_THROW_DC_METHOD.DERIVED_DC,
    label: 'Derived DC',
    description: 'Calculated DC.'
  }
}

export const SAVING_THROW_DC_METHOD_OPTIONS = valuesOf(
  SAVING_THROW_DC_METHOD_REGISTRY
) as SavingThrowDcMethodOption[]

export const SAVING_THROW_DC_BONUS_KIND = {
  ABILITY_MODIFIER: 'ABILITY_MODIFIER',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  STATIC_BONUS: 'STATIC_BONUS'
} as const

export type SavingThrowDcBonusKind = keyof typeof SAVING_THROW_DC_BONUS_KIND

export type SavingThrowDcBonusOption = CoreMeta<SavingThrowDcBonusKind>

export const SAVING_THROW_DC_BONUS_REGISTRY: Record<
  (typeof SAVING_THROW_DC_BONUS_KIND)[keyof typeof SAVING_THROW_DC_BONUS_KIND],
  SavingThrowDcBonusOption
> = {
  [SAVING_THROW_DC_BONUS_KIND.ABILITY_MODIFIER]: {
    code: SAVING_THROW_DC_BONUS_KIND.ABILITY_MODIFIER,
    label: 'Ability Modifier',
    description: 'Ability modifier.'
  },
  [SAVING_THROW_DC_BONUS_KIND.PROFICIENCY_BONUS]: {
    code: SAVING_THROW_DC_BONUS_KIND.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    description: 'Proficiency bonus.'
  },
  [SAVING_THROW_DC_BONUS_KIND.STATIC_BONUS]: {
    code: SAVING_THROW_DC_BONUS_KIND.STATIC_BONUS,
    label: 'Static Bonus',
    description: 'Static bonus.'
  }
}

export const SAVING_THROW_DC_BONUS_OPTIONS = valuesOf(
  SAVING_THROW_DC_BONUS_REGISTRY
) as SavingThrowDcBonusOption[]

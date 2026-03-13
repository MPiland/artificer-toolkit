import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const SAVING_THROW_KIND = {
  SPELL_SAVE_DC: 'SPELL_SAVE_DC',
  FIXED_VALUE: 'FIXED_VALUE'
} as const

export type SavingThrowKind = keyof typeof SAVING_THROW_KIND

export type SavingThrowOption = CoreMeta<SavingThrowKind>

export const SAVING_THROW_REGISTRY: Record<typeof SAVING_THROW_KIND[keyof typeof SAVING_THROW_KIND], SavingThrowOption> = {
  [SAVING_THROW_KIND.SPELL_SAVE_DC]: {
    code: SAVING_THROW_KIND.SPELL_SAVE_DC,
    label: 'Spell Save DC',
    description: 'Uses the character\'s spell save DC amount.',
    tooltip: 'Character\'s saving throw DC.'
  },
  [SAVING_THROW_KIND.FIXED_VALUE]: {
    code: SAVING_THROW_KIND.FIXED_VALUE,
    label: 'Fixed Value',
    description: 'A set DC value for the saving throw.',
    tooltip: 'Fixed value.'
  }
}

export const SAVING_THROW_KIND_OPTIONS = valuesOf(SAVING_THROW_REGISTRY) as SavingThrowOption[]

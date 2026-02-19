import { type CoreMeta } from '#core'

export const RACE_CATEGORY_CODE = {
  BASE: 'BASE',
  SUBRACE: 'SUBRACE',
  VARIANT: 'VARIANT'
} as const

export type RaceCategoryCode = keyof typeof RACE_CATEGORY_CODE

export type RaceCategoryOption = CoreMeta<RaceCategoryCode>

export const RACE_CATEGORY_REGISTRY: Record<
  RaceCategoryCode,
  RaceCategoryOption
> = {
  [RACE_CATEGORY_CODE.BASE]: {
    code: RACE_CATEGORY_CODE.BASE,
    label: 'Base Race',
    description:
      'A primary race selection that defines the core attributes of a character.'
  },

  [RACE_CATEGORY_CODE.SUBRACE]: {
    code: RACE_CATEGORY_CODE.SUBRACE,
    label: 'Subrace',
    description:
      'A subdivision of a base race that modifies or extends its attributes.'
  },

  [RACE_CATEGORY_CODE.VARIANT]: {
    code: RACE_CATEGORY_CODE.VARIANT,
    label: 'Variant',
    description:
      'An alternative version of a race that replaces or significantly alters standard attributes.'
  }
} as const

export const RACE_CATEGORY_OPTIONS = Object.values(
  RACE_CATEGORY_REGISTRY
) as readonly RaceCategoryOption[]

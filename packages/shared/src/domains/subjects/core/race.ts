import { type CoreMeta } from '#core'
import { valuesOf } from '#utils'

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

export const RACE_CATEGORY_OPTIONS = valuesOf(
  RACE_CATEGORY_REGISTRY
) as readonly RaceCategoryOption[]

export const RACE_SELECTION_MODE = {
  DIRECT: 'DIRECT',
  REQUIRES_SUBRACE: 'REQUIRES_SUBRACE'
} as const

export type RaceSelectionMode = keyof typeof RACE_SELECTION_MODE

export type RaceSelectionModeOption = CoreMeta<RaceSelectionMode>

export const RACE_SELECTION_MODE_REGISTRY: Record<
  RaceSelectionMode,
  RaceSelectionModeOption
> = {
  [RACE_SELECTION_MODE.DIRECT]: {
    code: RACE_SELECTION_MODE.DIRECT,
    label: 'Direct',
    description:
      'This base race is a final selectable race by itself.'
  },

  [RACE_SELECTION_MODE.REQUIRES_SUBRACE]: {
    code: RACE_SELECTION_MODE.REQUIRES_SUBRACE,
    label: 'Requires Subrace',
    description:
      'This base race acts as a family container and requires a subrace selection.'
  }
} as const

export const RACE_SELECTION_MODE_OPTIONS = valuesOf(
  RACE_SELECTION_MODE_REGISTRY
) as readonly RaceSelectionModeOption[]

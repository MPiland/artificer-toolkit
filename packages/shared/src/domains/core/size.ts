import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const SIZE_CODE = {
  COLOSSAL: 'COLOSSAL',
  DIMUNITIVE: 'DIMUNITIVE',
  FINE: 'FINE',
  GARGANTUAN: 'GARGANTUAN',
  GIANT: 'GIANT',
  HUGE: 'HUGE',
  LARGE: 'LARGE',
  MEDIUM: 'MEDIUM',
  SMALL: 'SMALL',
  TINY: 'TINY'
} as const

export type SizeCode = keyof typeof SIZE_CODE

export type SizeOption = CoreMeta<SizeCode>

export const SIZE_REGISTRY: Record<SizeCode, SizeOption> = {
  [SIZE_CODE.TINY]: {
    code: SIZE_CODE.TINY,
    label: 'Tiny',
    short: 'T',
    description: 'Very small size.'
  },
  [SIZE_CODE.SMALL]: {
    code: SIZE_CODE.SMALL,
    label: 'Small',
    short: 'S',
    description: 'Below average size.'
  },
  [SIZE_CODE.MEDIUM]: {
    code: SIZE_CODE.MEDIUM,
    label: 'Medium',
    short: 'M',
    description: 'Average humanoid size.'
  },
  [SIZE_CODE.LARGE]: {
    code: SIZE_CODE.LARGE,
    label: 'Large',
    short: 'L',
    description: 'Larger than humanoid.'
  },
  [SIZE_CODE.HUGE]: {
    code: SIZE_CODE.HUGE,
    label: 'Huge',
    short: 'H',
    description: 'Massive size.'
  },
  [SIZE_CODE.GARGANTUAN]: {
    code: SIZE_CODE.GARGANTUAN,
    label: 'Gargantuan',
    short: 'G',
    description: 'Enormous size.'
  },
  [SIZE_CODE.GIANT]: {
    code: SIZE_CODE.GIANT,
    label: 'Giant',
    description: 'Exceptionally large.'
  },
  [SIZE_CODE.FINE]: {
    code: SIZE_CODE.FINE,
    label: 'Fine',
    description: 'Extremely small.'
  },
  [SIZE_CODE.DIMUNITIVE]: {
    code: SIZE_CODE.DIMUNITIVE,
    label: 'Diminutive',
    description: 'Very tiny.'
  },
  [SIZE_CODE.COLOSSAL]: {
    code: SIZE_CODE.COLOSSAL,
    label: 'Colossal',
    description: 'Legendary size.'
  }
} as const

const SIZE_RANK: Record<SizeCode, number> = {
  FINE: 0,
  DIMUNITIVE: 1,
  TINY: 2,
  SMALL: 3,
  MEDIUM: 4,
  LARGE: 5,
  HUGE: 6,
  GARGANTUAN: 7,
  GIANT: 8,
  COLOSSAL: 9
}

/** One size step per rank, smallest first; null for a missing or unknown size. */
export function sizeRank(size: string | null | undefined): number | null {
  return size != null && Object.hasOwn(SIZE_RANK, size) ? SIZE_RANK[size as SizeCode] : null
}

/** The width in feet of the square a creature of each size fills; Fine and Giant sizes fill none a Scene models. */
const SIZE_SPACE_FEET: Partial<Record<SizeCode, number>> = {
  TINY: 2.5,
  SMALL: 5,
  MEDIUM: 5,
  LARGE: 10,
  HUGE: 15,
  GARGANTUAN: 20
}

/** The edge in feet of the space a creature of `size` fills; null for a missing size or one with no modelled space. */
export function sizeSpaceFeet(size: string | null | undefined): number | null {
  return size != null && Object.hasOwn(SIZE_SPACE_FEET, size)
    ? SIZE_SPACE_FEET[size as SizeCode]!
    : null
}

export type SizeRegistryValue = (typeof SIZE_REGISTRY)[keyof typeof SIZE_REGISTRY]

export const SIZE_OPTIONS = valuesOf(SIZE_REGISTRY) as readonly SizeRegistryValue[]

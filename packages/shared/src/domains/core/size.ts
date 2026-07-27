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
    description: 'Tiny creatures are very small, often no larger than a small animal or object.',
    tooltip: 'Very small size.'
  },
  [SIZE_CODE.SMALL]: {
    code: SIZE_CODE.SMALL,
    label: 'Small',
    short: 'S',
    description: 'Small creatures are shorter and lighter than average humanoids.',
    tooltip: 'Below average size.'
  },
  [SIZE_CODE.MEDIUM]: {
    code: SIZE_CODE.MEDIUM,
    label: 'Medium',
    short: 'M',
    description: 'Medium creatures are roughly human-sized in stature and mass.',
    tooltip: 'Average humanoid size.'
  },
  [SIZE_CODE.LARGE]: {
    code: SIZE_CODE.LARGE,
    label: 'Large',
    short: 'L',
    description:
      'Large creatures are significantly bigger than humanoids and occupy substantial space.',
    tooltip: 'Larger than humanoid.'
  },
  [SIZE_CODE.HUGE]: {
    code: SIZE_CODE.HUGE,
    label: 'Huge',
    short: 'H',
    description: 'Huge creatures are massive and dominate their surroundings through sheer scale.',
    tooltip: 'Massive size.'
  },
  [SIZE_CODE.GARGANTUAN]: {
    code: SIZE_CODE.GARGANTUAN,
    label: 'Gargantuan',
    short: 'G',
    description: 'Gargantuan creatures are enormous, often towering over buildings or landscapes.',
    tooltip: 'Enormous size.'
  },
  [SIZE_CODE.GIANT]: {
    code: SIZE_CODE.GIANT,
    label: 'Giant',
    description:
      'Giant represents an exceptionally large size category beyond typical classifications.',
    tooltip: 'Exceptionally large.'
  },
  [SIZE_CODE.FINE]: {
    code: SIZE_CODE.FINE,
    label: 'Fine',
    description: 'Fine creatures are extremely small, often insect-sized or smaller.',
    tooltip: 'Extremely small.'
  },
  [SIZE_CODE.DIMUNITIVE]: {
    code: SIZE_CODE.DIMUNITIVE,
    label: 'Diminutive',
    description: 'Diminutive creatures are tiny, smaller than typical Tiny creatures.',
    tooltip: 'Very tiny.'
  },
  [SIZE_CODE.COLOSSAL]: {
    code: SIZE_CODE.COLOSSAL,
    label: 'Colossal',
    description: 'Colossal creatures are vast beyond ordinary scale, often legendary in size.',
    tooltip: 'Legendary size.'
  }
} as const

export type SizeRegistryValue = (typeof SIZE_REGISTRY)[keyof typeof SIZE_REGISTRY]

export const SIZE_OPTIONS = valuesOf(SIZE_REGISTRY) as readonly SizeRegistryValue[]

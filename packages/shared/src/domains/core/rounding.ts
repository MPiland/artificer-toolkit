import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const ROUNDING_CODE = {
  UP: 'UP',
  DOWN: 'DOWN',
  NEAREST: 'NEAREST'
} as const

export type RoundingCode = keyof typeof ROUNDING_CODE

export type RoundingOption = CoreMeta<RoundingCode>

export const ROUNDING_REGISTRY: Record<RoundingCode, RoundingOption> = {
  [ROUNDING_CODE.UP]: {
    code: ROUNDING_CODE.UP,
    label: 'Round Up',
    description: 'Rounds fractional values upward.'
  },

  [ROUNDING_CODE.DOWN]: {
    code: ROUNDING_CODE.DOWN,
    label: 'Round Down',
    description: 'Rounds fractional values downward.'
  },

  [ROUNDING_CODE.NEAREST]: {
    code: ROUNDING_CODE.NEAREST,
    label: 'Round to Nearest',
    description: 'Rounds to the closest whole number.'
  }
} as const

export const ROUNDING_OPTIONS = valuesOf(ROUNDING_REGISTRY) as RoundingOption[]

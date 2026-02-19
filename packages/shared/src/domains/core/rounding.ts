import type { CoreMeta } from './core.js'

export const ROUNDING_CODE = {
  UP: 'UP',
  DOWN: 'DOWN',
  NEAREST: 'NEAREST'
} as const

export type RoundingCode = keyof typeof ROUNDING_CODE

export type RoundingOption = CoreMeta<RoundingCode>

export const ROUNDING_REGISTRY: Record<
  RoundingCode,
  RoundingOption
> = {
  [ROUNDING_CODE.UP]: {
    code: ROUNDING_CODE.UP,
    label: 'Round Up',
    tooltip: 'Rounds fractional values upward.',
    description: 'Always rounds the value up to the next whole number.'
  },

  [ROUNDING_CODE.DOWN]: {
    code: ROUNDING_CODE.DOWN,
    label: 'Round Down',
    tooltip: 'Rounds fractional values downward.',
    description: 'Always rounds the value down to the previous whole number.'
  },

  [ROUNDING_CODE.NEAREST]: {
    code: ROUNDING_CODE.NEAREST,
    label: 'Round to Nearest',
    tooltip: 'Rounds to the closest whole number.',
    description: 'Rounds the value to the nearest whole number.'
  }
} as const

export const ROUNDING_OPTIONS = Object.values(ROUNDING_REGISTRY) as RoundingOption[]

import { valuesOf } from '#utils'
import type { CoreMeta } from './core.js'

export const MEASUREMENT_TYPE_CODE = {
  VOLUME: 'VOLUME',
  WEIGHT: 'WEIGHT',
  LENGTH: 'LENGTH'
} as const

export type MeasurementTypeCode = keyof typeof MEASUREMENT_TYPE_CODE

export type MeasurementTypeOption = CoreMeta<MeasurementTypeCode>

export const MEASUREMENT_TYPE_REGISTRY: Record<MeasurementTypeCode, MeasurementTypeOption> = {
  [MEASUREMENT_TYPE_CODE.VOLUME]: {
    code: MEASUREMENT_TYPE_CODE.VOLUME,
    label: 'Volume',
    short: 'Volume',
    description: 'Volume measurement.'
  },
  [MEASUREMENT_TYPE_CODE.WEIGHT]: {
    code: MEASUREMENT_TYPE_CODE.WEIGHT,
    label: 'Weight',
    short: 'Weight',
    description: 'Weight measurement.'
  },
  [MEASUREMENT_TYPE_CODE.LENGTH]: {
    code: MEASUREMENT_TYPE_CODE.LENGTH,
    label: 'Length',
    short: 'Length',
    description: 'Length measurement.'
  }
}

export const MEASUREMENT_UNIT_CODE = {
  POUNDS: 'POUNDS',
  GALLONS: 'GALLONS',
  INCHES: 'INCHES',
  FEET: 'FEET',
  YARDS: 'YARDS',
  MILES: 'MILES',
  OUNCES: 'OUNCES',
  CUPS: 'CUPS',
  TABLESPOONS: 'TABLESPOONS',
  TEASPOONS: 'TEASPOONS',
  LITERS: 'LITERS',
  QUARTS: 'QUARTS'
} as const

export type MeasurementUnitCode = keyof typeof MEASUREMENT_UNIT_CODE

export type MeasurementUnitOption = CoreMeta<MeasurementUnitCode>

export const MEASUREMENT_UNIT_REGISTRY: Record<MeasurementUnitCode, MeasurementUnitOption> = {
  [MEASUREMENT_UNIT_CODE.POUNDS]: {
    code: MEASUREMENT_UNIT_CODE.POUNDS,
    label: 'Pounds',
    short: 'lb',
    description: 'Unit of weight.'
  },

  [MEASUREMENT_UNIT_CODE.GALLONS]: {
    code: MEASUREMENT_UNIT_CODE.GALLONS,
    label: 'Gallons',
    short: 'gal',
    description: 'Unit of volume.'
  },

  [MEASUREMENT_UNIT_CODE.INCHES]: {
    code: MEASUREMENT_UNIT_CODE.INCHES,
    label: 'Inches',
    short: 'in',
    description: 'Unit of length.'
  },

  [MEASUREMENT_UNIT_CODE.FEET]: {
    code: MEASUREMENT_UNIT_CODE.FEET,
    label: 'Feet',
    short: 'ft',
    description: 'Unit of length.'
  },

  [MEASUREMENT_UNIT_CODE.YARDS]: {
    code: MEASUREMENT_UNIT_CODE.YARDS,
    label: 'Yards',
    short: 'yd',
    description: 'Unit of length.'
  },

  [MEASUREMENT_UNIT_CODE.MILES]: {
    code: MEASUREMENT_UNIT_CODE.MILES,
    label: 'Miles',
    short: 'mi',
    description: 'Unit of long distance.'
  },

  [MEASUREMENT_UNIT_CODE.OUNCES]: {
    code: MEASUREMENT_UNIT_CODE.OUNCES,
    label: 'Ounces',
    short: 'oz',
    description: 'Unit of weight or volume.'
  },

  [MEASUREMENT_UNIT_CODE.CUPS]: {
    code: MEASUREMENT_UNIT_CODE.CUPS,
    label: 'Cups',
    short: 'cup',
    description: 'Unit of volume.'
  },

  [MEASUREMENT_UNIT_CODE.TABLESPOONS]: {
    code: MEASUREMENT_UNIT_CODE.TABLESPOONS,
    label: 'Tablespoons',
    short: 'tbsp',
    description: 'Small unit of volume.'
  },

  [MEASUREMENT_UNIT_CODE.TEASPOONS]: {
    code: MEASUREMENT_UNIT_CODE.TEASPOONS,
    label: 'Teaspoons',
    short: 'tsp',
    description: 'Very small unit of volume.'
  },

  [MEASUREMENT_UNIT_CODE.LITERS]: {
    code: MEASUREMENT_UNIT_CODE.LITERS,
    label: 'Liters',
    short: 'L',
    description: 'Metric unit of volume.'
  },

  [MEASUREMENT_UNIT_CODE.QUARTS]: {
    code: MEASUREMENT_UNIT_CODE.QUARTS,
    label: 'Quarts',
    short: 'qt',
    description: 'Unit of volume.'
  }
} as const

/** The units a distance is authored in: exactly those a Scene converts. */
export const LENGTH_UNIT_CODES = [
  MEASUREMENT_UNIT_CODE.INCHES,
  MEASUREMENT_UNIT_CODE.FEET,
  MEASUREMENT_UNIT_CODE.YARDS,
  MEASUREMENT_UNIT_CODE.MILES
] as const

export type LengthUnitCode = (typeof LENGTH_UNIT_CODES)[number]

const FEET_PER_LENGTH_UNIT: Record<LengthUnitCode, number> = {
  [MEASUREMENT_UNIT_CODE.INCHES]: 1 / 12,
  [MEASUREMENT_UNIT_CODE.FEET]: 1,
  [MEASUREMENT_UNIT_CODE.YARDS]: 3,
  [MEASUREMENT_UNIT_CODE.MILES]: 5_280
}

/** Feet in a typed length; the one conversion every length consumer shares. */
export function lengthMeasurementInFeet(length: { amount: number; unit: LengthUnitCode }): number {
  return length.amount * FEET_PER_LENGTH_UNIT[length.unit]
}

/** The amount of a length unit that makes the given feet; the inverse of `lengthMeasurementInFeet`. */
export function feetInLengthUnit(feet: number, unit: LengthUnitCode): number {
  return feet / FEET_PER_LENGTH_UNIT[unit]
}

/** A converted length amount at the precision the product displays: three decimals, no trailing zeros. */
export function roundLengthForDisplay(amount: number): number {
  return Math.round(amount * 1_000) / 1_000
}

/** A length as the product displays it, such as "11.667 yards". */
export function formatLengthMeasurement(length: { amount: number; unit: LengthUnitCode }): string {
  return `${roundLengthForDisplay(length.amount)} ${MEASUREMENT_UNIT_REGISTRY[length.unit].label.toLowerCase()}`
}

export const LENGTH_UNIT_OPTIONS: readonly MeasurementUnitOption[] = LENGTH_UNIT_CODES.map(
  (code) => MEASUREMENT_UNIT_REGISTRY[code]
)

export type MeasurementUnitValue =
  (typeof MEASUREMENT_UNIT_REGISTRY)[keyof typeof MEASUREMENT_UNIT_REGISTRY]

export const MEASUREMENT_UNIT_OPTIONS = valuesOf(
  MEASUREMENT_UNIT_REGISTRY
) as readonly MeasurementUnitOption[]

import { authoredLengthSchema } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  feetInLengthUnit,
  lengthMeasurementInFeet,
  type LengthUnitCode
} from '@artificer-toolkit/shared/core'

/** Whether a modifier's value is a typed length rather than a plain number (D111). */
export function isLengthModifierDomain(valueDomainCode: unknown): boolean {
  return valueDomainCode === 'SPEED' || valueDomainCode === 'SENSE_RANGE'
}

/**
 * A SPEED or SENSE_RANGE modifier payload read as the typed length publication guarantees. Anything
 * else is an invariant failure at read, never a value the rules guess at.
 */
export function modifierLength(payload: unknown) {
  return authoredLengthSchema.parse(payload)
}

/** The feet of a SPEED or SENSE_RANGE modifier payload, through the shared unit conversion. */
export function modifierLengthFeet(payload: unknown): number {
  return lengthMeasurementInFeet(modifierLength(payload))
}

/** A length's amount in `unit`; a length already in it is not converted. */
export function lengthInUnit(
  length: { amount: number; unit: LengthUnitCode },
  unit: LengthUnitCode
): number {
  return length.unit === unit
    ? length.amount
    : feetInLengthUnit(lengthMeasurementInFeet(length), unit)
}

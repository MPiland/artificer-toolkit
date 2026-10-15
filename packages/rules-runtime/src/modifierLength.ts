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

type ModifierLength = ReturnType<typeof authoredLengthSchema.parse>

/**
 * The feet of a SPEED or SENSE_RANGE modifier payload, through the shared unit conversion. The
 * payload is the typed length publication guarantees; anything else is an invariant failure at
 * read, never a value the rules guess at.
 */
export function modifierLengthFeet(payload: unknown): number {
  return lengthMeasurementInFeet(authoredLengthSchema.parse(payload))
}

/**
 * "Your speed is X" grants keyed by speed: the widest applicable one wins, in its authored unit. A
 * Character policy and a Creature holder fold their SET_VALUE speeds through this one rule.
 */
export function widestLengthByKey(
  grants: Iterable<{ key: string; payload: unknown }>
): Map<string, ModifierLength> {
  const widest = new Map<string, ModifierLength>()
  for (const { key, payload } of grants) {
    const length = authoredLengthSchema.parse(payload)
    const best = widest.get(key)
    if (best === undefined || lengthMeasurementInFeet(length) > lengthMeasurementInFeet(best))
      widest.set(key, length)
  }
  return widest
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

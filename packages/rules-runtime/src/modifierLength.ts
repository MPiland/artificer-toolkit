import {
  authoredFractionSchema,
  authoredLengthSchema,
  speedEqualsPayloadSchema
} from '@artificer-toolkit/schema/shared/authoredLimits'
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
 * grant that names another speed ("equal to your walking speed") is that speed's length, taken from
 * `speedLength` (the holder's base speed of that type); a grant naming a speed the holder lacks
 * grants nothing. A Character policy and a Creature holder fold their SET_VALUE speeds through this
 * one rule.
 */
export function widestLengthByKey(
  grants: Iterable<{ key: string; payload: unknown }>,
  speedLength: (speedId: string) => ModifierLength | undefined = () => undefined
): Map<string, ModifierLength> {
  const widest = new Map<string, ModifierLength>()
  for (const { key, payload } of grants) {
    const equals = speedEqualsPayloadSchema.safeParse(payload)
    const length = equals.success
      ? speedLength(equals.data.equalsSpeedId)
      : authoredLengthSchema.parse(payload)
    if (length === undefined) continue
    const best = widest.get(key)
    if (best === undefined || lengthMeasurementInFeet(length) > lengthMeasurementInFeet(best))
      widest.set(key, length)
  }
  return widest
}

/** Whether a SPEED payload names another speed instead of a length. */
export function isSpeedEqualsPayload(payload: unknown): boolean {
  return speedEqualsPayloadSchema.safeParse(payload).success
}

/**
 * A speed after the "your speed is multiplied by n/d" grants that apply to it: the product of
 * the fractions, rounded down once (D94). A Character policy and a Creature holder fold their
 * fractions through this one rule.
 */
export function speedAfterFractions(amount: number, payloads: Iterable<unknown>): number {
  let numerator = 1
  let denominator = 1
  for (const payload of payloads) {
    const fraction = authoredFractionSchema.parse(payload)
    numerator *= fraction.numerator
    denominator *= fraction.denominator
  }
  return Math.floor((amount * numerator) / denominator)
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

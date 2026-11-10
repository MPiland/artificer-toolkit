import { type LengthUnitCode, type RangeKind, type ScalableValueAuthored } from '#core'

export type RangeMeasurementAuthored = {
  amount: number
  unit: LengthUnitCode
}

export type RangeAuthored =
  | {
      id: string
      rangeKind: Exclude<RangeKind, 'DISTANCE'>
    }
  | {
      id: string
      rangeKind: Extract<RangeKind, 'DISTANCE'>
      amount: number
      /** A ranged weapon attack's long range; beyond `amount` the attack has disadvantage. */
      longAmount?: number
      /** An attack's close range (a Lance); against a target within it the attack has disadvantage. */
      closeAmount?: number
      unit: LengthUnitCode
      scaling?: ScalableValueAuthored<RangeMeasurementAuthored>
    }

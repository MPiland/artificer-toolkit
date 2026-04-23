import {
  type MeasurementUnitCode,
  type RangeKind,
  type ScalableValueAuthored
} from '#core'

export type RangeMeasurementAuthored = {
  amount: number
  unit: MeasurementUnitCode
}

export type RangeAuthored
  = | {
    id: string
    rangeKind: Exclude<RangeKind, 'DISTANCE'>
  } | {
    id: string
    rangeKind: Extract<RangeKind, 'DISTANCE'>
    amount: number
    unit: MeasurementUnitCode
    scaling?: ScalableValueAuthored<RangeMeasurementAuthored>
  }

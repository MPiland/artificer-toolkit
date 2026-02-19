import { type MeasurementUnitCode, type RangeKind } from '#core'

export type RangeAuthored
  = | {
    id: string
    rangeKind: Exclude<RangeKind, 'DISTANCE'>
  } | {
    id: string
    rangeKind: Extract<RangeKind, 'DISTANCE'>
    amount: number
    unit: MeasurementUnitCode
  }

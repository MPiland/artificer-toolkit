import type { MeasurementUnitCode, RangeKind, RangePayloadByType } from '#core'

export type CompiledRange = {
  [K in RangeKind]: K extends keyof RangePayloadByType ? {
    rangeKind: K
    unit: MeasurementUnitCode
    min: number
    max?: number
  } & RangePayloadByType[K] : {
    rangeKind: K
  }
}[RangeKind]

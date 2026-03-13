import type { MeasurementUnitCode, RangeKind } from '#core'
import type { RangeAuthored } from '#authored'

export type CompiledRange
  = | {
    id: string
    rangeKind: Exclude<RangeKind, 'DISTANCE'>
  }
    | {
      id: string
      rangeKind: 'DISTANCE'
      amount: number
      unit: MeasurementUnitCode
    }

export function compileRange(authored: RangeAuthored): CompiledRange {
  switch (authored.rangeKind) {
    case 'DISTANCE':
      return {
        id: authored.id,
        rangeKind: authored.rangeKind,
        amount: authored.amount,
        unit: authored.unit
      }

    default:
      return {
        id: authored.id,
        rangeKind: authored.rangeKind
      }
  }
}

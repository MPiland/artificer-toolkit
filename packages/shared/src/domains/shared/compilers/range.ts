import type { LengthUnitCode, RangeKind, ScalableValueAuthored } from '#core'
import type { RangeAuthored, RangeMeasurementAuthored } from '#authored'

export type CompiledRange =
  | {
      id: string
      rangeKind: Exclude<RangeKind, 'DISTANCE'>
    }
  | {
      id: string
      rangeKind: 'DISTANCE'
      amount: number
      unit: LengthUnitCode
      scaling?: ScalableValueAuthored<RangeMeasurementAuthored>
    }

export function compileRange(authored: RangeAuthored): CompiledRange {
  switch (authored.rangeKind) {
    case 'DISTANCE':
      return {
        id: authored.id,
        rangeKind: authored.rangeKind,
        amount: authored.amount,
        unit: authored.unit,
        ...(authored.scaling ? { scaling: authored.scaling } : {})
      }

    default:
      return {
        id: authored.id,
        rangeKind: authored.rangeKind
      }
  }
}

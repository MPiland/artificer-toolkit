import type { MeasurementUnitCode } from '#core'
import { MEASUREMENT_UNIT_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

export type MeasurementAuthored = {
  amount: number
  unit: MeasurementUnitCode
}

const measurement = buildNodeMap<MeasurementAuthored>()

export const MEASUREMENT_NODE_MAP = measurement.define('measurement', ({ map, nodes }) => {
  const { selectSingle, number } = nodes

  map
    .set('amount', number(['amount'], 'Amount', {
      order: 1,
      requiredIf: true
    }))
    .set('unit', selectSingle(['unit'], 'Unit', {
      kind: 'INLINE_OPTIONS',
      options: MEASUREMENT_UNIT_OPTIONS
    }, {
      order: 2,
      requiredIf: true
    }))
})

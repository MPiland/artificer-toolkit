import type { LengthUnitCode } from '#core'
import { LENGTH_UNIT_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

export type MeasurementAuthored = {
  amount: number
  unit: LengthUnitCode
}

const measurement = buildNodeMap<MeasurementAuthored>()

export const MEASUREMENT_NODE_MAP = measurement.define('measurement', ({ map, nodes }) => {
  const { selectSingle, number } = nodes

  map
    .set(
      'amount',
      number(['amount'], 'Amount', {
        order: 1,
        requiredIf: true
      })
    )
    .set(
      'unit',
      selectSingle(
        ['unit'],
        'Unit',
        {
          kind: 'INLINE_OPTIONS',
          options: LENGTH_UNIT_OPTIONS
        },
        {
          order: 2,
          requiredIf: true
        }
      )
    )
})

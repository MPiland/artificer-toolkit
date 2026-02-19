import type { RangeAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS, RANGE_KIND_OPTIONS } from '#core'
import { buildNodeMap } from '#util'

const range = buildNodeMap<RangeAuthored>()

export const RANGE_NODE_MAP = range.define((map, { field }) => map({
  rangeKind: {
    kind: 'INPUT',
    label: 'Range Type',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: RANGE_KIND_OPTIONS
    }
  },
  amount: {
    kind: 'INPUT',
    label: 'Distance Amount',
    type: 'NUMBER',
    showIf: field('rangeKind').eq('DISTANCE')
  },
  unit: {
    kind: 'INPUT',
    label: 'Distance Unit',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    },
    showIf: field('rangeKind').eq('DISTANCE')
  }
}))

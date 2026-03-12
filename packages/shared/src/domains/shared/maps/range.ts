import type { RangeAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS, RANGE_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

const range = buildNodeMap<RangeAuthored>()

export const RANGE_NODE_MAP = range.define('range', ({ map, cond, nodes }) => {
  const local = cond.local()
  const { selectSingle, number } = nodes
  map
    .set('rangeKind', selectSingle(['rangeKind'], 'Range Kind', {
      kind: 'INLINE',
      options: RANGE_OPTIONS
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('amount', number(['amount'], 'Amount', {
      order: 2,
      requiredIf: true,
      showIf: local.field(['rangeKind']).eq('DISTANCE')
    }))
    .set('unit', selectSingle(['unit'], 'Unit', {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    }, {
      order: 3,
      requiredIf: true,
      showIf: local.field(['rangeKind']).eq('DISTANCE')
    }))
})

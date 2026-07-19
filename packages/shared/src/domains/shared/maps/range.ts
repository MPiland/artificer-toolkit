import type { RangeAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS, RANGE_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import { MEASUREMENT_NODE_MAP } from './measurement.js'
import { createBreakpointScalingNodeMap } from './scaling.js'

const range = buildNodeMap<RangeAuthored>()

const RANGE_SCALING_NODE_MAP
  = createBreakpointScalingNodeMap('rangeScaling', 'Range Measurement', MEASUREMENT_NODE_MAP)

export const RANGE_NODE_MAP = range.define('range', ({ map, cond, nodes }) => {
  const local = cond.local()
  const { selectSingle, number, groupObject } = nodes
  map
    .set('rangeKind', selectSingle(['rangeKind'], 'Range Kind', {
      kind: 'INLINE_OPTIONS',
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
      kind: 'INLINE_OPTIONS',
      options: MEASUREMENT_UNIT_OPTIONS
    }, {
      order: 3,
      requiredIf: true,
      showIf: local.field(['rangeKind']).eq('DISTANCE')
    }))
    .set('scaling', groupObject(['scaling'], 'Scaling', () => RANGE_SCALING_NODE_MAP, { presentation: 'inline',
      order: 4,
      showIf: local.field(['rangeKind']).eq('DISTANCE')
    }))
})

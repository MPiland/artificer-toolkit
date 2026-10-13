import type { RangeAuthored } from '#authored'
import { LENGTH_UNIT_OPTIONS, RANGE_OPTIONS, RANGE_REGISTRY, SENSE_RANGE_KINDS } from '#core'
import { buildNodeMap } from '#utils'
import { MEASUREMENT_NODE_MAP } from './measurement.js'
import { createBreakpointScalingNodeMap } from './scaling.js'

const range = buildNodeMap<RangeAuthored>()

const RANGE_SCALING_NODE_MAP = createBreakpointScalingNodeMap(
  'rangeScaling',
  'Range Measurement',
  MEASUREMENT_NODE_MAP
)

/** An attack or effect range also carries a long range and level scaling; a sense range does not. */
function createRangeNodeMap(
  mapId: string,
  rangeKindOptions: typeof RANGE_OPTIONS,
  withLongRangeAndScaling: boolean
) {
  return range.define(mapId, ({ map, cond, nodes }) => {
    const local = cond.local()
    const { selectSingle, number, groupObject } = nodes
    map
      .set(
        'rangeKind',
        selectSingle(
          ['rangeKind'],
          'Range Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: rangeKindOptions
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Amount', {
          order: 2,
          requiredIf: true,
          showIf: local.field(['rangeKind']).eq('DISTANCE')
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
            order: 4,
            requiredIf: true,
            showIf: local.field(['rangeKind']).eq('DISTANCE')
          }
        )
      )
    if (!withLongRangeAndScaling) return
    map
      .set(
        'longAmount',
        number(['longAmount'], 'Long Range', {
          order: 3,
          showIf: local.field(['rangeKind']).eq('DISTANCE')
        })
      )
      .set(
        'scaling',
        groupObject(['scaling'], 'Scaling', () => RANGE_SCALING_NODE_MAP, {
          presentation: 'inline',
          order: 5,
          showIf: local.field(['rangeKind']).eq('DISTANCE')
        })
      )
  })
}

export const RANGE_NODE_MAP = createRangeNodeMap('range', RANGE_OPTIONS, true)

export const SENSE_RANGE_NODE_MAP = createRangeNodeMap(
  'senseRange',
  SENSE_RANGE_KINDS.map((kind) => RANGE_REGISTRY[kind]),
  false
)

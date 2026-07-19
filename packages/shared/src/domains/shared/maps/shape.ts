import type { ShapeAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS, SHAPE_KIND_OPTIONS, type ShapeMeasurementAuthored } from '#core'
import { buildNodeMap } from '#utils'
import { MEASUREMENT_NODE_MAP } from './measurement.js'
import { createBreakpointScalingNodeMap } from './scaling.js'

const shapeMeasurement = buildNodeMap<ShapeMeasurementAuthored>()

const SHAPE_MEASUREMENT_SCALING_NODE_MAP
  = createBreakpointScalingNodeMap('shapeMeasurementScaling', 'Shape Measurement', MEASUREMENT_NODE_MAP)

export const SHAPE_MEASUREMENT_NODE_MAP = shapeMeasurement.define('shapeMeasurement', ({ map, nodes }) => {
  const { selectSingle, number, groupObject } = nodes

  map
    .set('amount', number(['amount'], 'Amount', {
      order: 1,
      requiredIf: true
    }))
    .set('unit', selectSingle(['unit'], 'Unit', {
      kind: 'INLINE_OPTIONS',
      options: MEASUREMENT_UNIT_OPTIONS
    }))
    .set('scaling', groupObject(['scaling'], 'Scaling', () => SHAPE_MEASUREMENT_SCALING_NODE_MAP, { presentation: 'inline',
      order: 3
    }))
})

const shape = buildNodeMap<ShapeAuthored>()

export const SHAPE_NODE_MAP = shape.define('shape', ({ map, cond, nodes, logic }) => {
  const { or } = logic
  const { selectSingle, groupObject } = nodes
  const local = cond.local()

  map
    .set('shapeKind', selectSingle(['shapeKind'], 'Shape Kind', {
      kind: 'INLINE_OPTIONS',
      options: SHAPE_KIND_OPTIONS
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('length', groupObject(['length'], 'Length', () => SHAPE_MEASUREMENT_NODE_MAP, { presentation: 'inline',
      order: 2,
      showIf: or([
        local.field(['shapeKind']).eq('LINE'),
        local.field(['shapeKind']).eq('CONE'),
        local.field(['shapeKind']).eq('WALL')
      ])
    }))
    .set('edgeLength', groupObject(['edgeLength'], 'Edge Length', () => SHAPE_MEASUREMENT_NODE_MAP, { presentation: 'inline',
      order: 2,
      showIf: local.field(['shapeKind']).eq('CUBE')
    }))
    .set('height', groupObject(['height'], 'Height', () => SHAPE_MEASUREMENT_NODE_MAP, { presentation: 'inline',
      order: 2,
      showIf: or([
        local.field(['shapeKind']).eq('CYLINDER'),
        local.field(['shapeKind']).eq('WALL')
      ]),
      requiredIf: or([
        local.field(['shapeKind']).eq('CYLINDER'),
        local.field(['shapeKind']).eq('WALL')
      ])
    }))
    .set('radius', groupObject(['radius'], 'Radius', () => SHAPE_MEASUREMENT_NODE_MAP, { presentation: 'inline',
      order: 2,
      showIf: or([
        local.field(['shapeKind']).eq('CYLINDER'),
        local.field(['shapeKind']).eq('SPHERE'),
        local.field(['shapeKind']).eq('CIRCLE'),
        local.field(['shapeKind']).eq('DOME')
      ]),
      requiredIf: true
    }))
    .set('thickness', groupObject(['thickness'], 'Thickness', () => SHAPE_MEASUREMENT_NODE_MAP, { presentation: 'inline',
      order: 2,
      showIf: local.field(['shapeKind']).eq('WALL')
    }))
})

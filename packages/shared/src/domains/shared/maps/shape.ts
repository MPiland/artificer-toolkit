import type { ShapeAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS, SHAPE_KIND_OPTIONS, type ShapeMeasurementAuthored } from '#core'
import { buildNodeMap } from '#utils'

const shapeMeasurement = buildNodeMap<ShapeMeasurementAuthored>()

export const SHAPE_MEASUREMENT_NODE_MAP = shapeMeasurement.define((map) => map({
  amount: {
    kind: 'INPUT',
    label: 'Amount',
    type: 'NUMBER'
  },
  unit: {
    kind: 'INPUT',
    label: 'Unit',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    }
  }
}))

const shape = buildNodeMap<ShapeAuthored>()

export const SHAPE_NODE_MAP = shape.define((map, { local, or }) => map({
  shapeKind: {
    kind: 'INPUT',
    label: 'Shape',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: SHAPE_KIND_OPTIONS
    }
  },
  length: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: or([
      local('shapeKind').eq('LINE'),
      local('shapeKind').eq('CONE'),
      local('shapeKind').eq('WALL')
    ])
  },
  radius: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: or([
      local('shapeKind').eq('CYLINDER'),
      local('shapeKind').eq('SPHERE'),
      local('shapeKind').eq('DOME'),
      local('shapeKind').eq('CIRCLE')
    ])
  },
  height: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: or([
      local('shapeKind').eq('CYLINDER'),
      local('shapeKind').eq('WALL')
    ])
  },
  thickness: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: local('shapeKind').eq('WALL')
  },
  edgeLength: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: local('shapeKind').eq('CUBE')
  }
}))

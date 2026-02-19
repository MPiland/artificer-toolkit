import type { ShapeAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS, SHAPE_KIND_OPTIONS, type ShapeMeasurementAuthored } from '#core'
import { buildNodeMap } from '#util'

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

export const SHAPE_NODE_MAP = shape.define((map, { field, or }) => map({
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
      field('shapeKind').eq('LINE'),
      field('shapeKind').eq('CONE'),
      field('shapeKind').eq('WALL')
    ])
  },
  radius: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: or([
      field('shapeKind').eq('CYLINDER'),
      field('shapeKind').eq('SPHERE'),
      field('shapeKind').eq('DOME'),
      field('shapeKind').eq('CIRCLE')
    ])
  },
  height: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: or([
      field('shapeKind').eq('CYLINDER'),
      field('shapeKind').eq('WALL')
    ])
  },
  thickness: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: field('shapeKind').eq('WALL')
  },
  edgeLength: {
    kind: 'GROUP',
    nodes: SHAPE_MEASUREMENT_NODE_MAP,
    showIf: field('shapeKind').eq('CUBE')
  }
}))

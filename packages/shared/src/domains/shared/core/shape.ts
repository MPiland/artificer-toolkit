import type { CoreMeta, MeasurementUnitCode, ScalableValueAuthored } from '#core'
import { valuesOf } from '#utils'

export const SHAPE_KIND = {
  LINE: 'LINE',
  CONE: 'CONE',
  CUBE: 'CUBE',
  CYLINDER: 'CYLINDER',
  SPHERE: 'SPHERE',
  WALL: 'WALL',
  CIRCLE: 'CIRCLE',
  DOME: 'DOME'
} as const

export type ShapeKind = keyof typeof SHAPE_KIND

export type ShapeOption = CoreMeta<ShapeKind>

export const SHAPE_REGISTRY: Record<ShapeKind, ShapeOption> = {
  [SHAPE_KIND.LINE]: {
    code: SHAPE_KIND.LINE,
    label: 'Line',
    description: 'A straight geometric path extending from a point of origin.',
    tooltip: 'Straight line area.'
  },
  [SHAPE_KIND.CONE]: {
    code: SHAPE_KIND.CONE,
    label: 'Cone',
    description: 'An area extending outward from a point of origin in a widening form.',
    tooltip: 'Cone-shaped area.'
  },
  [SHAPE_KIND.CUBE]: {
    code: SHAPE_KIND.CUBE,
    label: 'Cube',
    description: 'A uniform three-dimensional area with equal length, width, and height.',
    tooltip: 'Cube-shaped area.'
  },
  [SHAPE_KIND.CYLINDER]: {
    code: SHAPE_KIND.CYLINDER,
    label: 'Cylinder',
    description: 'A circular area extended through a uniform height.',
    tooltip: 'Cylindrical area.'
  },
  [SHAPE_KIND.SPHERE]: {
    code: SHAPE_KIND.SPHERE,
    label: 'Sphere',
    description: 'A radial three-dimensional volume extending equally in all directions.',
    tooltip: 'Spherical area.'
  },
  [SHAPE_KIND.WALL]: {
    code: SHAPE_KIND.WALL,
    label: 'Wall',
    description: 'A vertical planar barrier with a defined length and height.',
    tooltip: 'Wall-shaped area.'
  },
  [SHAPE_KIND.CIRCLE]: {
    code: SHAPE_KIND.CIRCLE,
    label: 'Circle',
    description: 'A flat, circular area defined by a radius on a surface.',
    tooltip: 'Circular area.'
  },
  [SHAPE_KIND.DOME]: {
    code: SHAPE_KIND.DOME,
    label: 'Dome',
    description: 'A hemispherical area extending outward from a surface or point.',
    tooltip: 'Half-sphere area.'
  }
} as const

export const SHAPE_KIND_OPTIONS = valuesOf(SHAPE_REGISTRY) as ShapeOption[]

export type ShapeMeasurementValueAuthored = {
  amount: number
  unit: MeasurementUnitCode
}

export type ShapeMeasurementAuthored = ShapeMeasurementValueAuthored & {
  scaling?: ScalableValueAuthored<ShapeMeasurementValueAuthored>
}

export type ShapePayloadByType = {
  [SHAPE_KIND.LINE]: {
    length: ShapeMeasurementAuthored
  }
  [SHAPE_KIND.CONE]: {
    length: ShapeMeasurementAuthored
  }
  [SHAPE_KIND.CUBE]: {
    edgeLength: ShapeMeasurementAuthored
  }
  [SHAPE_KIND.CYLINDER]: {
    height: ShapeMeasurementAuthored
    radius: ShapeMeasurementAuthored
  }
  [SHAPE_KIND.SPHERE]: {
    radius: ShapeMeasurementAuthored
  }
  [SHAPE_KIND.WALL]: {
    length: ShapeMeasurementAuthored
    height: ShapeMeasurementAuthored
    thickness?: ShapeMeasurementAuthored
  }
  [SHAPE_KIND.CIRCLE]: {
    radius: ShapeMeasurementAuthored
  }
  [SHAPE_KIND.DOME]: {
    radius: ShapeMeasurementAuthored
  }
}

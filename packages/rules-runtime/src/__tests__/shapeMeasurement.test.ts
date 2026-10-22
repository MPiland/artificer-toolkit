import { describe, expect, it } from 'vitest'
import type { ShapeDto } from '@artificer-toolkit/schema/shared/shape'

import { scaledShapeMeasurements, shapeExtent } from '../shapeMeasurement.js'

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
const byLevel = (amount: number) => ({
  ...feet(amount),
  scaling: {
    scalingKind: 'BREAKPOINTS' as const,
    scalingSource: 'CLASS_LEVEL' as const,
    classId: 'paladin',
    breakpoints: [{ id: 'aura-18', level: 18, order: 1, value: feet(30) }]
  }
})

describe('shapeExtent', () => {
  it.each<[ShapeDto, number | null]>([
    [{ shapeKind: 'CUBE', edgeLength: feet(10) }, 10],
    [{ shapeKind: 'CONE', length: feet(15) }, 15],
    [{ shapeKind: 'LINE', length: feet(60), width: feet(5) }, 60],
    [{ shapeKind: 'WALL', length: feet(30), height: feet(10) }, 30],
    [{ shapeKind: 'SPHERE', radius: feet(20) }, 20],
    [{ shapeKind: 'CYLINDER', radius: feet(5), height: feet(40) }, 5],
    [{ shapeKind: 'CIRCLE', radius: feet(25) }, 25],
    [{ shapeKind: 'DOME', radius: feet(10) }, null]
  ])('sizes %o by its governing measurement', (shape, amount) => {
    expect(shapeExtent(shape)?.amount ?? null).toBe(amount)
  })
})

describe('scaledShapeMeasurements', () => {
  it('names each scaling measurement with the source it scales by', () => {
    const shape: ShapeDto = { shapeKind: 'CYLINDER', radius: byLevel(10), height: feet(20) }
    expect(scaledShapeMeasurements(shape)).toEqual([
      { measurement: 'radius', scalingSource: 'CLASS_LEVEL' }
    ])
  })

  it('names none for a fixed shape', () => {
    const shape: ShapeDto = { shapeKind: 'LINE', length: feet(60), width: feet(5) }
    expect(scaledShapeMeasurements(shape)).toEqual([])
  })
})

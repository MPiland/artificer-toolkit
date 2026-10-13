import { describe, expect, it } from 'vitest'

import { LENGTH_UNIT_CODES, lengthMeasurementInFeet } from '../domains/core/measurement.js'
import { lengthMeasurementInSceneUnits } from '../domains/vtt/index.js'

const FEET_GRID = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' } as const

describe('length measurement', () => {
  it('converts every length unit to feet', () => {
    expect(
      LENGTH_UNIT_CODES.map((unit) => [unit, lengthMeasurementInFeet({ amount: 36, unit })])
    ).toEqual([
      ['INCHES', 3],
      ['FEET', 36],
      ['YARDS', 108],
      ['MILES', 190_080]
    ])
  })

  it('measures a length in the Scene unit through the same conversion', () => {
    expect(lengthMeasurementInSceneUnits({ amount: 2, unit: 'YARDS' }, FEET_GRID)).toBe(6)
    expect(
      lengthMeasurementInSceneUnits({ amount: 100, unit: 'FEET' }, { ...FEET_GRID, unit: 'METERS' })
    ).toBeCloseTo(30.48)
    expect(lengthMeasurementInSceneUnits({ amount: -5, unit: 'FEET' }, FEET_GRID)).toBe(0)
    expect(lengthMeasurementInSceneUnits(null, FEET_GRID)).toBeNull()
  })

  it('keeps the grid-overflow and uncalibrated-SQUARES failures', () => {
    expect(() =>
      lengthMeasurementInSceneUnits({ amount: Number.MAX_VALUE, unit: 'MILES' }, FEET_GRID)
    ).toThrow('overflowed')
    expect(() =>
      lengthMeasurementInSceneUnits(
        { amount: 5, unit: 'FEET' },
        { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'SQUARES' }
      )
    ).toThrow('uncalibrated SQUARES')
  })
})

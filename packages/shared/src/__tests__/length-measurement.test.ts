import { describe, expect, it } from 'vitest'

import { LENGTH_UNIT_CODES, lengthMeasurementInFeet } from '../domains/core/measurement.js'
import {
  feetInSceneUnit,
  lengthMeasurementInSceneUnits,
  senseRangeInSceneUnits
} from '../domains/vtt/index.js'

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
  })

  it('converts feet into a calibrated Scene unit', () => {
    expect(feetInSceneUnit(10, 'FEET')).toBe(10)
    expect(feetInSceneUnit(10, 'METERS')).toBeCloseTo(3.048)
  })

  it('measures nothing on an uncalibrated SQUARES Scene', () => {
    expect(
      lengthMeasurementInSceneUnits(
        { amount: 5, unit: 'FEET' },
        { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'SQUARES' }
      )
    ).toBeNull()
  })

  it('keeps an unlimited sense unlimited and drops a ranged sense the Scene cannot measure', () => {
    const squaresGrid = { ...FEET_GRID, unit: 'SQUARES' } as const
    expect(senseRangeInSceneUnits(null, FEET_GRID)).toEqual({ range: null })
    expect(senseRangeInSceneUnits(null, squaresGrid)).toEqual({ range: null })
    expect(senseRangeInSceneUnits({ amount: 60, unit: 'FEET' }, FEET_GRID)).toEqual({ range: 60 })
    expect(senseRangeInSceneUnits({ amount: 60, unit: 'FEET' }, squaresGrid)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import {
  LENGTH_UNIT_CODES,
  feetInLengthUnit,
  formatLengthMeasurement,
  lengthMeasurementInFeet,
  roundLengthForDisplay
} from '../domains/core/measurement.js'
import { AUTHORED_LENGTH_AMOUNT_MAX } from '../utils/authoringLimits.js'
import {
  SCENE_LENGTH_AMOUNT_MAX,
  SYSTEM_BASE_SQUARE_FEET,
  convertSceneDistance,
  feetInSceneUnit,
  sceneLengthInFeet,
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

  it('converts feet into every length unit as the inverse of the forward conversion', () => {
    expect(LENGTH_UNIT_CODES.map((unit) => [unit, feetInLengthUnit(30, unit)])).toEqual([
      ['INCHES', 360],
      ['FEET', 30],
      ['YARDS', 10],
      ['MILES', 30 / 5_280]
    ])
    for (const unit of LENGTH_UNIT_CODES)
      expect(feetInLengthUnit(lengthMeasurementInFeet({ amount: 7, unit }), unit)).toBeCloseTo(7)
  })

  it('rounds a converted length to three decimals for display and drops trailing zeros', () => {
    expect(roundLengthForDisplay(40 / 3)).toBe(13.333)
    expect(roundLengthForDisplay(35 / 3)).toBe(11.667)
    expect(roundLengthForDisplay(28)).toBe(28)
    expect(roundLengthForDisplay(0.0004)).toBe(0)
    expect(formatLengthMeasurement({ amount: 40 / 3, unit: 'YARDS' })).toBe('13.333 yards')
    expect(formatLengthMeasurement({ amount: 28, unit: 'YARDS' })).toBe('28 yards')
    expect(formatLengthMeasurement({ amount: 2.5, unit: 'MILES' })).toBe('2.5 miles')
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
    expect(feetInSceneUnit(10, 'SQUARES')).toBe(2)
  })

  it('gives the System base square exactly in every Scene unit', () => {
    expect(
      (['FEET', 'METERS', 'SQUARES'] as const).map((unit) =>
        feetInSceneUnit(SYSTEM_BASE_SQUARE_FEET, unit)
      )
    ).toEqual([5, 1.524, 1])
  })

  it('converts a Scene distance between units without float noise on a round trip', () => {
    expect(convertSceneDistance(5, 'FEET', 'METERS')).toBe(1.524)
    expect(convertSceneDistance(1.524, 'METERS', 'FEET')).toBe(5)
    expect(convertSceneDistance(10, 'FEET', 'METERS')).toBe(3.048)
    expect(convertSceneDistance(3.048, 'METERS', 'FEET')).toBe(10)
    expect(convertSceneDistance(1, 'SQUARES', 'FEET')).toBe(5)
    expect(convertSceneDistance(1, 'SQUARES', 'METERS')).toBe(1.524)
    expect(convertSceneDistance(3, 'FEET', 'FEET')).toBe(3)
  })

  it('keeps the largest authored length finite and within the Scene bound in every Scene unit', () => {
    const largest = { amount: AUTHORED_LENGTH_AMOUNT_MAX, unit: 'MILES' } as const
    const squaresGrid = { ...FEET_GRID, distancePerCell: 1, unit: 'SQUARES' } as const
    const grids = [FEET_GRID, { ...FEET_GRID, unit: 'METERS' }, squaresGrid] as const
    for (const grid of grids) {
      const length = lengthMeasurementInSceneUnits(largest, grid)
      expect(Number.isFinite(length)).toBe(true)
      expect(length).toBeLessThanOrEqual(SCENE_LENGTH_AMOUNT_MAX)
    }
    expect(lengthMeasurementInSceneUnits(largest, FEET_GRID)).toBe(SCENE_LENGTH_AMOUNT_MAX)
  })

  it('measures a square as the System base square, 5 feet, on a SQUARES Scene', () => {
    const squaresGrid = { ...FEET_GRID, distancePerCell: 1, unit: 'SQUARES' } as const
    expect(lengthMeasurementInSceneUnits({ amount: 5, unit: 'FEET' }, squaresGrid)).toBe(1)
    expect(lengthMeasurementInSceneUnits({ amount: 60, unit: 'FEET' }, squaresGrid)).toBe(12)
    expect(sceneLengthInFeet(3, squaresGrid)).toBe(15)
  })

  it('keeps an unlimited sense unlimited and measures a ranged sense in Scene units', () => {
    const squaresGrid = { ...FEET_GRID, distancePerCell: 1, unit: 'SQUARES' } as const
    expect(senseRangeInSceneUnits({ rangeKind: 'UNLIMITED' }, FEET_GRID)).toEqual({
      rangeKind: 'UNLIMITED'
    })
    expect(senseRangeInSceneUnits({ rangeKind: 'UNLIMITED' }, squaresGrid)).toEqual({
      rangeKind: 'UNLIMITED'
    })
    expect(
      senseRangeInSceneUnits({ rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' }, FEET_GRID)
    ).toEqual({ rangeKind: 'DISTANCE', amount: 60 })
    expect(
      senseRangeInSceneUnits({ rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' }, squaresGrid)
    ).toEqual({ rangeKind: 'DISTANCE', amount: 12 })
  })
})

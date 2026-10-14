import { describe, expect, it } from 'vitest'

import { scenePointInPolygon } from '../domains/vtt/geometry.js'
import type { SceneDiagonalPolicy, SceneGrid, SceneToken } from '../domains/vtt/scene.js'
import { sceneRangeBand, sceneRangeOutline } from '../domains/vtt/sceneRange.js'

const CELL = 100
const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

function squareGrid(diagonalPolicy: SceneDiagonalPolicy): SceneGrid {
  return {
    kind: 'SQUARE',
    cellSize: CELL,
    diagonalPolicy,
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  }
}

const gridless: SceneGrid = { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' }

/** A token whose footprint covers `cells` squares from the cell (column, row). */
function cellToken(
  column: number,
  row: number,
  cells = 1
): Pick<SceneToken, 'height' | 'position' | 'width'> {
  return {
    height: cells * CELL,
    position: { x: (column + cells / 2) * CELL, y: (row + cells / 2) * CELL },
    width: cells * CELL
  }
}

describe('Scene range band', () => {
  const equal = squareGrid('EQUAL')

  it('measures from the footprint edge: a Medium target next to a Large source is within reach', () => {
    const large = cellToken(1, 1, 2)
    // Centres are 150 pixels (7.5 feet) apart, yet the footprints touch.
    expect(sceneRangeBand(equal, large, cellToken(3, 1), { normal: feet(5) })).toBe('NORMAL')
    expect(sceneRangeBand(equal, large, cellToken(4, 1), { normal: feet(5) })).toBe('OUT')
    expect(sceneRangeBand(equal, large, cellToken(0, 0), { normal: feet(5) })).toBe('NORMAL')
    expect(sceneRangeBand(equal, large, cellToken(4, 4), { normal: feet(5) })).toBe('OUT')
  })

  it.each([
    ['EQUAL', 2, 2, 'NORMAL', 3, 3, 'NORMAL'],
    ['ALTERNATING', 2, 2, 'NORMAL', 3, 3, 'OUT'],
    ['EUCLIDEAN', 2, 2, 'NORMAL', 3, 3, 'OUT']
  ] as const)(
    'counts a 15 foot diagonal on a square grid the %s way',
    (policy, nearColumns, nearRows, nearBand, farColumns, farRows, farBand) => {
      const grid = squareGrid(policy)
      const source = cellToken(10, 10)
      expect(
        sceneRangeBand(grid, source, cellToken(10 + nearColumns, 10 + nearRows), {
          normal: feet(15)
        })
      ).toBe(nearBand)
      expect(
        sceneRangeBand(grid, source, cellToken(10 + farColumns, 10 + farRows), {
          normal: feet(15)
        })
      ).toBe(farBand)
    }
  )

  it('splits a ranged attack into normal, long and out of range', () => {
    const range = { normal: feet(30), long: feet(120) }
    const source = cellToken(0, 0)
    expect(sceneRangeBand(equal, source, cellToken(6, 0), range)).toBe('NORMAL')
    expect(sceneRangeBand(equal, source, cellToken(7, 0), range)).toBe('LONG')
    expect(sceneRangeBand(equal, source, cellToken(24, 0), range)).toBe('LONG')
    expect(sceneRangeBand(equal, source, cellToken(25, 0), range)).toBe('OUT')
  })

  it('reaches only an overlapping footprint at zero range', () => {
    const source = cellToken(5, 5, 2)
    expect(sceneRangeBand(equal, source, cellToken(6, 6), { normal: feet(0) })).toBe('NORMAL')
    expect(sceneRangeBand(equal, source, cellToken(7, 5), { normal: feet(0) })).toBe('OUT')
  })

  it('judges a zero normal range that has a long range by distance, not overlap', () => {
    const source = cellToken(5, 5, 2)
    const range = { normal: feet(0), long: feet(30) }
    expect(sceneRangeBand(equal, source, cellToken(6, 6), range)).toBe('NORMAL')
    expect(sceneRangeBand(equal, source, cellToken(7, 5), range)).toBe('LONG')
    expect(sceneRangeBand(equal, source, cellToken(12, 5), range)).toBe('LONG')
    expect(sceneRangeBand(equal, source, cellToken(13, 5), range)).toBe('OUT')
  })

  it('adds the base square on a gridless Scene', () => {
    const source = { height: 50, position: { x: 0, y: 0 }, width: 50 }
    const target = (gap: number) => ({
      height: 50,
      position: { x: 50 + gap, y: 0 },
      width: 50
    })
    // Touching footprints are 5 feet apart; each further pixel is a tenth of a foot.
    expect(sceneRangeBand(gridless, source, target(0), { normal: feet(5) })).toBe('NORMAL')
    expect(sceneRangeBand(gridless, source, target(50), { normal: feet(10) })).toBe('NORMAL')
    expect(sceneRangeBand(gridless, source, target(51), { normal: feet(10) })).toBe('OUT')
  })
})

describe('Scene range outline', () => {
  const window = Array.from({ length: 29 }, (_, index) => index - 14)

  it.each(['EQUAL', 'ALTERNATING', 'EUCLIDEAN'] as const)(
    'encloses exactly the %s squares a Large source reaches at 15 and 30 feet',
    (policy) => {
      const grid = squareGrid(policy)
      const source = cellToken(20, 20, 2)
      for (const reach of [15, 30]) {
        const outline = sceneRangeOutline(grid, source, feet(reach))
        if (!outline) throw new Error(`Expected a ${reach} ft outline.`)
        const polygon = { points: outline }
        for (const column of window)
          for (const row of window) {
            const target = cellToken(21 + column, 21 + row)
            expect(
              scenePointInPolygon(target.position, polygon),
              `${policy} ${reach} ft at ${column},${row}`
            ).toBe(sceneRangeBand(grid, source, target, { normal: feet(reach) }) !== 'OUT')
          }
      }
    }
  )

  it('reaches a Large target when any of its squares is enclosed', () => {
    const grid = squareGrid('ALTERNATING')
    const source = cellToken(20, 20)
    const points = sceneRangeOutline(grid, source, feet(15))
    if (!points) throw new Error('Expected a 15 ft outline.')
    const outline = { points }
    for (const column of window)
      for (const row of window) {
        const target = cellToken(21 + column, 21 + row, 2)
        const squares = [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1]
        ].map(([dx, dy]) => cellToken(21 + column + dx!, 21 + row + dy!).position)
        expect(
          squares.some((square) => scenePointInPolygon(square, outline)),
          `Large target at ${column},${row}`
        ).toBe(sceneRangeBand(grid, source, target, { normal: feet(15) }) !== 'OUT')
      }
  })

  it('rounds a gridless footprint out by the range less the base square', () => {
    const source = { height: 50, position: { x: 400, y: 400 }, width: 50 }
    // The arcs are polygon chords, so a point must clear the edge by a few pixels to be decided.
    const innerPoints = sceneRangeOutline(gridless, source, feet(14.5))
    const outerPoints = sceneRangeOutline(gridless, source, feet(15.5))
    if (!innerPoints || !outerPoints) throw new Error('Expected gridless outlines.')
    const inner = { points: innerPoints }
    const outer = { points: outerPoints }
    let decidedInside = 0
    let decidedOutside = 0
    for (let x = 250; x <= 550; x += 7)
      for (let y = 250; y <= 550; y += 7) {
        const point = { x, y }
        const band = sceneRangeBand(
          gridless,
          source,
          { height: 1, position: point, width: 1 },
          {
            normal: feet(15)
          }
        )
        if (scenePointInPolygon(point, inner)) {
          decidedInside += 1
          expect(band, `${x},${y}`).toBe('NORMAL')
        }
        if (!scenePointInPolygon(point, outer)) {
          decidedOutside += 1
          expect(band, `${x},${y}`).toBe('OUT')
        }
      }
    expect(decidedInside).toBeGreaterThan(0)
    expect(decidedOutside).toBeGreaterThan(0)
  })

  it('has no outline for an empty range or one shorter than the base square', () => {
    expect(sceneRangeOutline(squareGrid('EQUAL'), cellToken(0, 0), feet(0))).toBeNull()
    expect(
      sceneRangeOutline(gridless, { height: 50, position: { x: 0, y: 0 }, width: 50 }, feet(2))
    ).toBeNull()
  })
})

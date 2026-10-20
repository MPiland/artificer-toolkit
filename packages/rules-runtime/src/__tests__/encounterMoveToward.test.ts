import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import { movedTowardTarget } from '../encounterMoveToward.js'

/** 100px cells of 5 feet; a Medium token fills one cell and is anchored at its center. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

/** The center of the square at (column, row). */
const square = (column: number, row = 0) => ({ x: column * 100 + 50, y: row * 100 + 50 })
const token = (column: number, row = 0) => ({
  position: square(column, row),
  width: 100,
  height: 100,
  rotationDegrees: 0
})

/** The target stands in column 10, row 0. */
const TARGET = token(10)

function closed(input: {
  start: { x: number; y: number }
  end: { x: number; y: number }
  standingAt?: { x: number; y: number }
  grid?: SceneGrid
}) {
  return movedTowardTarget({
    grid: input.grid ?? FEET_GRID,
    lastMove: { start: input.start, end: input.end },
    attackerToken: { ...token(0), position: input.standingAt ?? input.end },
    targetToken: TARGET
  })
}

describe('how far an attacker’s latest move closed its distance to the target', () => {
  it('counts a straight approach as the feet it covered', () => {
    expect(closed({ start: square(0), end: square(4) })).toEqual({ closedFeet: 20 })
  })

  it('counts nothing for a move away from the target', () => {
    expect(closed({ start: square(4), end: square(0) })).toEqual({ closedFeet: 0 })
  })

  it('counts only the distance gained by a sideways move that still ends nearer', () => {
    // Six squares (30 ft) moved, but the target is only two squares (10 ft) nearer.
    expect(closed({ start: square(0, 0), end: square(2, 4) })).toEqual({ closedFeet: 10 })
  })

  it('counts nothing for a circling move that ends as far as it began', () => {
    expect(closed({ start: square(0, 0), end: square(0, 8) })).toEqual({ closedFeet: 0 })
  })

  it('counts nothing without a move this turn', () => {
    expect(
      movedTowardTarget({
        grid: FEET_GRID,
        lastMove: null,
        attackerToken: token(4),
        targetToken: TARGET
      })
    ).toEqual({ closedFeet: 0 })
  })

  it('counts nothing once the attacker no longer stands where the move ended', () => {
    expect(closed({ start: square(0), end: square(4), standingAt: square(3) })).toEqual({
      closedFeet: 0
    })
  })

  it('converts the Scene’s unit into feet', () => {
    const grid: SceneGrid = { ...FEET_GRID, distancePerCell: 1, unit: 'SQUARES' }
    expect(closed({ start: square(0), end: square(4), grid })).toEqual({ closedFeet: 20 })
  })
})

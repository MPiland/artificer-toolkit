import { describe, expect, it } from 'vitest'

import type { SceneGrid } from '../domains/vtt/scene.js'
import {
  directedAreaInSceneCoordinates,
  directedAreaOutline,
  isDirectedAreaOriginOnToken,
  nearestFootprintEdgePoint,
  spatialTokensInsideArea,
  type SpatialDirectedAreaShape
} from '../domains/vtt/spatial.js'

const grid: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

/** The caster's Medium token: the 100 px square every offset below is measured from. */
const caster = { id: 'caster', position: { x: 550, y: 550 }, width: 100, height: 100 }
const squareAt = (column: number, row: number) => ({
  id: `${column},${row}`,
  position: { x: 550 + column * 100, y: 550 + row * 100 },
  width: 100,
  height: 100
})
/** A token on every square within 14 squares of the caster, the caster's own square included. */
const everySquare = Array.from({ length: 29 }, (_, row) =>
  Array.from({ length: 29 }, (_, column) => squareAt(column - 14, row - 14))
).flat()

function caught(origin: { x: number; y: number }, shape: SpatialDirectedAreaShape) {
  return spatialTokensInsideArea({ origin, shape, tokens: everySquare }).sort()
}
const squares = (...ids: string[]) => ids.sort()
/** The squares of one column (east of the caster) in the given rows. */
const column = (column: number, rows: readonly number[]) => rows.map((row) => `${column},${row}`)
/** The squares of one row in the given columns. */
const row = (row: number, columns: readonly number[]) => columns.map((column) => `${column},${row}`)
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index)

describe('a cone from the caster’s edge', () => {
  const eastEdge = { x: 600, y: 550 }

  it('catches the squares its template covers along an axis (15 ft)', () => {
    expect(caught(eastEdge, { kind: 'CONE', length: 300, toward: { x: 700, y: 550 } })).toEqual(
      squares(...column(1, [0]), ...column(2, [-1, 0, 1]), ...column(3, [-1, 0, 1]))
    )
  })

  it('widens by one square per two squares of length (60 ft)', () => {
    // The cone is as wide as it is long, so column n is reached by rows within ±R of the axis
    // where R is the largest whole number below (n + 1) / 2.
    const reach = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]
    expect(caught(eastEdge, { kind: 'CONE', length: 1200, toward: { x: 700, y: 550 } })).toEqual(
      squares(...reach.flatMap((rows, index) => column(index + 1, range(-rows, rows))))
    )
  })

  it('catches the squares its template covers diagonally (15 ft)', () => {
    expect(
      caught({ x: 600, y: 600 }, { kind: 'CONE', length: 300, toward: { x: 700, y: 700 } })
    ).toEqual(squares('1,1', '2,1', '1,2', '3,1', '1,3', '2,2', '3,2', '2,3', '3,3', '4,2', '2,4'))
  })

  it('catches the same squares pointing west, north and south as east, turned', () => {
    expect(
      caught({ x: 500, y: 550 }, { kind: 'CONE', length: 300, toward: { x: 400, y: 550 } })
    ).toEqual(squares(...column(-1, [0]), ...column(-2, [-1, 0, 1]), ...column(-3, [-1, 0, 1])))
    expect(
      caught({ x: 550, y: 500 }, { kind: 'CONE', length: 300, toward: { x: 550, y: 400 } })
    ).toEqual(squares(...row(-1, [0]), ...row(-2, [-1, 0, 1]), ...row(-3, [-1, 0, 1])))
    expect(
      caught({ x: 550, y: 600 }, { kind: 'CONE', length: 300, toward: { x: 550, y: 700 } })
    ).toEqual(squares(...row(1, [0]), ...row(2, [-1, 0, 1]), ...row(3, [-1, 0, 1])))
  })

  it('does not catch a square its template only grazes', () => {
    // The cone's edge passes through the corner shared by (1, 0), (1, 1), (2, 0) and (2, 1) and
    // never over (1, 1): a single point of contact is not part of the space.
    expect(
      caught(eastEdge, { kind: 'CONE', length: 300, toward: { x: 700, y: 550 } })
    ).not.toContain('1,1')
  })
})

describe('a line from the caster’s edge', () => {
  it('catches the squares of the authored length and width in each direction', () => {
    const toward = (x: number, y: number) => ({ x, y })
    // 30 ft long, 5 ft wide: six squares in the one row or column it runs along.
    expect(
      caught(
        { x: 600, y: 550 },
        { kind: 'LINE', length: 600, width: 100, toward: toward(700, 550) }
      )
    ).toEqual(squares(...row(0, range(1, 6))))
    expect(
      caught(
        { x: 500, y: 550 },
        { kind: 'LINE', length: 600, width: 100, toward: toward(400, 550) }
      )
    ).toEqual(squares(...row(0, range(-6, -1))))
    expect(
      caught(
        { x: 550, y: 500 },
        { kind: 'LINE', length: 600, width: 100, toward: toward(550, 400) }
      )
    ).toEqual(squares(...column(0, range(-6, -1))))
    expect(
      caught(
        { x: 550, y: 600 },
        { kind: 'LINE', length: 600, width: 100, toward: toward(550, 700) }
      )
    ).toEqual(squares(...column(0, range(1, 6))))
  })

  it('runs the full 100 ft of a Lightning Bolt and not a square further', () => {
    const along = range(0, 22).map((column) => squareAt(column, 0))
    expect(
      spatialTokensInsideArea({
        origin: { x: 600, y: 550 },
        shape: { kind: 'LINE', length: 2000, width: 100, toward: { x: 700, y: 550 } },
        tokens: along
      }).sort()
    ).toEqual(squares(...row(0, range(1, 20))))
  })

  it('is as wide as authored: a 10 ft line covers the rows either side of its axis', () => {
    expect(
      caught(
        { x: 600, y: 550 },
        { kind: 'LINE', length: 300, width: 200, toward: { x: 700, y: 550 } }
      )
    ).toEqual(squares(...column(1, [-1, 0, 1]), ...column(2, [-1, 0, 1]), ...column(3, [-1, 0, 1])))
  })

  it('catches the squares its template covers diagonally', () => {
    // 30 ft along the diagonal from the caster's south-east corner: the squares on the diagonal
    // and the two beside it, plus the two the template's start overlaps beside the corner.
    expect(
      caught(
        { x: 600, y: 600 },
        { kind: 'LINE', length: 600, width: 100, toward: { x: 700, y: 700 } }
      )
    ).toEqual(
      squares(
        ...range(1, 5).map((step) => `${step},${step}`),
        ...range(0, 4).map((step) => `${step},${step + 1}`),
        ...range(0, 4).map((step) => `${step + 1},${step}`)
      )
    )
  })
})

describe('a cube from the caster’s side', () => {
  it('extends its full edge out from the chosen side, centered on the origin, without the caster', () => {
    expect(
      caught(
        { x: 600, y: 550 },
        { kind: 'CUBE_FROM_SIDE', edgeLength: 300, toward: { x: 700, y: 550 } }
      )
    ).toEqual(squares(...column(1, [-1, 0, 1]), ...column(2, [-1, 0, 1]), ...column(3, [-1, 0, 1])))
    expect(
      caught(
        { x: 550, y: 500 },
        { kind: 'CUBE_FROM_SIDE', edgeLength: 300, toward: { x: 550, y: 400 } }
      )
    ).not.toContain('0,0')
  })

  it('takes the side its direction mostly faces', () => {
    expect(
      caught(
        { x: 550, y: 500 },
        { kind: 'CUBE_FROM_SIDE', edgeLength: 300, toward: { x: 600, y: 400 } }
      )
    ).toEqual(squares(...row(-1, [-1, 0, 1]), ...row(-2, [-1, 0, 1]), ...row(-3, [-1, 0, 1])))
  })
})

describe('directedAreaOutline', () => {
  it('is the polygon the catching reads, null without a direction', () => {
    expect(
      directedAreaOutline(
        { x: 600, y: 550 },
        { kind: 'CONE', length: 300, toward: { x: 700, y: 550 } }
      )
    ).toEqual([
      { x: 600, y: 550 },
      { x: 900, y: 700 },
      { x: 900, y: 400 }
    ])
    expect(
      directedAreaOutline(
        { x: 600, y: 550 },
        { kind: 'CONE', length: 300, toward: { x: 600, y: 550 } }
      )
    ).toBeNull()
  })
})

describe('directedAreaInSceneCoordinates', () => {
  const toward = { x: 700, y: 550 }

  it('reads authored feet as Scene coordinates', () => {
    expect(
      directedAreaInSceneCoordinates({ kind: 'CONE', length: feet(15) }, toward, grid)
    ).toEqual({
      kind: 'CONE',
      length: 300,
      toward
    })
    expect(
      directedAreaInSceneCoordinates({ kind: 'CUBE_FROM_SIDE', edgeLength: feet(15) }, toward, grid)
    ).toEqual({ kind: 'CUBE_FROM_SIDE', edgeLength: 300, toward })
  })

  it('gives a line the authored width, or 5 ft when none is authored', () => {
    expect(
      directedAreaInSceneCoordinates(
        { kind: 'LINE', length: feet(100), width: feet(10) },
        toward,
        grid
      )
    ).toEqual({ kind: 'LINE', length: 2000, width: 200, toward })
    expect(
      directedAreaInSceneCoordinates({ kind: 'LINE', length: feet(100) }, toward, grid)
    ).toEqual({ kind: 'LINE', length: 2000, width: 100, toward })
  })

  it('has no area when the size is scaled or empty', () => {
    const scaled = { ...feet(15), scaling: { kind: 'BREAKPOINT', breakpoints: [] } }
    expect(
      directedAreaInSceneCoordinates({ kind: 'CONE', length: scaled }, toward, grid)
    ).toBeNull()
    expect(
      directedAreaInSceneCoordinates({ kind: 'CONE', length: feet(0) }, toward, grid)
    ).toBeNull()
  })
})

describe('isDirectedAreaOriginOnToken', () => {
  const cone = (toward: { x: number; y: number }): SpatialDirectedAreaShape => ({
    kind: 'CONE',
    length: 300,
    toward
  })
  const cube = (toward: { x: number; y: number }): SpatialDirectedAreaShape => ({
    kind: 'CUBE_FROM_SIDE',
    edgeLength: 300,
    toward
  })

  it('accepts an origin on an edge or a corner of the footprint facing out', () => {
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 600, y: 520 },
        shape: cone({ x: 700, y: 520 })
      })
    ).toBe(true)
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 600, y: 600 },
        shape: cone({ x: 700, y: 700 })
      })
    ).toBe(true)
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 600, y: 500 },
        shape: cone({ x: 700, y: 500 })
      })
    ).toBe(true)
  })

  it('refuses an origin off the footprint, inside it, or on its edge pointing along or into it', () => {
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 650, y: 550 },
        shape: cone({ x: 750, y: 550 })
      })
    ).toBe(false)
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 550, y: 550 },
        shape: cone({ x: 650, y: 550 })
      })
    ).toBe(false)
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 600, y: 550 },
        shape: cone({ x: 500, y: 550 })
      })
    ).toBe(false)
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 600, y: 550 },
        shape: cone({ x: 600, y: 650 })
      })
    ).toBe(false)
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 600, y: 550 },
        shape: cone({ x: 600, y: 550 })
      })
    ).toBe(false)
  })

  it('needs a cube’s origin on the side its direction faces', () => {
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 600, y: 550 },
        shape: cube({ x: 700, y: 560 })
      })
    ).toBe(true)
    expect(
      isDirectedAreaOriginOnToken({
        token: caster,
        origin: { x: 550, y: 500 },
        shape: cube({ x: 700, y: 500 })
      })
    ).toBe(false)
  })
})

describe('nearestFootprintEdgePoint', () => {
  it('snaps a point outside the footprint to the nearest edge or corner', () => {
    expect(nearestFootprintEdgePoint(caster, { x: 900, y: 560 })).toEqual({ x: 600, y: 560 })
    expect(nearestFootprintEdgePoint(caster, { x: 900, y: 900 })).toEqual({ x: 600, y: 600 })
    expect(nearestFootprintEdgePoint(caster, { x: 520, y: 100 })).toEqual({ x: 520, y: 500 })
  })

  it('snaps a point inside the footprint to the nearest side, and leaves an edge point where it is', () => {
    expect(nearestFootprintEdgePoint(caster, { x: 590, y: 550 })).toEqual({ x: 600, y: 550 })
    expect(nearestFootprintEdgePoint(caster, { x: 520, y: 560 })).toEqual({ x: 500, y: 560 })
    expect(nearestFootprintEdgePoint(caster, { x: 600, y: 520 })).toEqual({ x: 600, y: 520 })
  })

  it('always yields an origin the rules accept for a direction leaving the footprint', () => {
    const shape: SpatialDirectedAreaShape = {
      kind: 'CONE',
      length: 300,
      toward: { x: 900, y: 560 }
    }
    const origin = nearestFootprintEdgePoint(caster, { x: 900, y: 560 })
    expect(isDirectedAreaOriginOnToken({ token: caster, origin, shape })).toBe(true)
  })
})

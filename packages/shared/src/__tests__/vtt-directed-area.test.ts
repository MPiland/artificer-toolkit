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

/** The square the caster stands on: `everySquare` holds it as an ordinary token. */
const casterSquare = '0,0'

function caught(origin: { x: number; y: number }, shape: SpatialDirectedAreaShape) {
  return spatialTokensInsideArea({
    origin,
    shape,
    tokens: everySquare,
    casterTokenId: casterSquare
  }).sort()
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

  it('catches exactly the squares its template shares area with diagonally (60 ft)', () => {
    // Rows 1 to 13 south of the caster's row, each as the first and last column the cone reaches,
    // from an independent clip of the template triangle against every square. The cone is symmetric
    // about the diagonal, so the columns read the same turned.
    const reach = [
      [1, 3],
      [1, 6],
      [1, 9],
      [2, 12],
      [2, 13],
      [2, 12],
      [3, 11],
      [3, 10],
      [3, 9],
      [4, 8],
      [4, 7],
      [4, 6],
      [5, 5]
    ] as const
    expect(
      caught({ x: 600, y: 600 }, { kind: 'CONE', length: 1200, toward: { x: 700, y: 700 } })
    ).toEqual(squares(...reach.flatMap(([from, to], index) => row(index + 1, range(from, to)))))
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

  it('never catches the caster, even when the template overlaps the caster’s own square', () => {
    // Aimed almost due north from the east edge, the cone’s left edge sweeps back over the caster’s
    // square. A second token on the very same square stands in for the caster to prove it does.
    const shape: SpatialDirectedAreaShape = {
      kind: 'CONE',
      length: 300,
      toward: { x: 610, y: 0 }
    }
    const origin = { x: 600, y: 520 }
    const bystander = { ...squareAt(0, 0), id: 'bystander' }
    const catches = spatialTokensInsideArea({
      origin,
      shape,
      tokens: [...everySquare, bystander],
      casterTokenId: casterSquare
    })
    expect(catches).toContain('bystander')
    expect(catches).not.toContain(casterSquare)
  })

  it.each([
    ['no caster token', null],
    ['a caster token that is not on the Scene', 'elsewhere']
  ])('refuses to catch for %s: a directed area starts on the caster', (_name, casterTokenId) => {
    expect(() =>
      spatialTokensInsideArea({
        origin: { x: 600, y: 550 },
        shape: { kind: 'CONE', length: 300, toward: { x: 900, y: 550 } },
        tokens: everySquare,
        casterTokenId
      })
    ).toThrow('A directed area needs the caster’s token.')
  })

  it('ignores the caster of a point area, which can catch the caster', () => {
    expect(
      spatialTokensInsideArea({
        origin: { x: 600, y: 600 },
        shape: { kind: 'RADIUS', radius: 50 },
        tokens: [squareAt(0, 0)],
        casterTokenId: casterSquare
      })
    ).toEqual([casterSquare])
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
        tokens: along,
        casterTokenId: casterSquare
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
  const cubeToward = (x: number, y: number): SpatialDirectedAreaShape => ({
    kind: 'CUBE_FROM_SIDE',
    edgeLength: 300,
    cellSize: 100,
    gridOrigin: { x: 0, y: 0 },
    toward: { x, y }
  })

  it('extends its full edge out from the chosen side, centered on the caster at the middle of the side', () => {
    expect(caught({ x: 600, y: 550 }, cubeToward(700, 550))).toEqual(
      squares(...column(1, [-1, 0, 1]), ...column(2, [-1, 0, 1]), ...column(3, [-1, 0, 1]))
    )
  })

  it('slides along the side so the caster’s row is the first or the last of the cube’s rows', () => {
    // The face of a 15 ft cube is 3 squares; the caster's side is 1, so the face sits in one of
    // three snapped places: pressing near either end of the side picks that end.
    expect(caught({ x: 600, y: 505 }, cubeToward(700, 505))).toEqual(
      squares(...column(1, [-2, -1, 0]), ...column(2, [-2, -1, 0]), ...column(3, [-2, -1, 0]))
    )
    expect(caught({ x: 600, y: 595 }, cubeToward(700, 595))).toEqual(
      squares(...column(1, [0, 1, 2]), ...column(2, [0, 1, 2]), ...column(3, [0, 1, 2]))
    )
    expect(caught({ x: 550, y: 500 }, cubeToward(550, 400))).toEqual(
      squares(...row(-1, [-1, 0, 1]), ...row(-2, [-1, 0, 1]), ...row(-3, [-1, 0, 1]))
    )
    expect(caught({ x: 595, y: 500 }, cubeToward(595, 400))).toEqual(
      squares(...row(-1, [0, 1, 2]), ...row(-2, [0, 1, 2]), ...row(-3, [0, 1, 2]))
    )
  })

  it('always covers exactly 9 squares, whichever point of the side is pressed, never 12 from a corner', () => {
    for (const y of range(0, 20).map((step) => 500 + step * 5)) {
      expect(caught({ x: 600, y }, cubeToward(700, y))).toHaveLength(9)
      expect(caught({ x: 500, y }, cubeToward(400, y))).toHaveLength(9)
    }
  })

  it('takes the side its direction mostly faces', () => {
    expect(caught({ x: 550, y: 500 }, cubeToward(600, 400))).toEqual(
      squares(...row(-1, [-1, 0, 1]), ...row(-2, [-1, 0, 1]), ...row(-3, [-1, 0, 1]))
    )
  })

  it('never catches the caster', () => {
    expect(caught({ x: 550, y: 500 }, cubeToward(550, 400))).not.toContain(casterSquare)
  })
})

describe('a cube from the caster’s side snaps to the grid', () => {
  /** The grid positions from `first` to `last`, one cell apart. */
  const places = (first: number, last: number) =>
    range(0, (last - first) / 100).map((step) => first + step * 100)
  /**
   * Casters on and off the grid, each with the places a cube's face may start along their side for
   * each edge length: every grid position whose cube shares the side with the caster, worked out by
   * hand from the side's two ends.
   */
  const casters = [
    {
      name: 'a 1 square caster on the grid',
      token: { id: 'caster', position: { x: 550, y: 550 }, width: 100, height: 100 },
      gridOrigin: { x: 0, y: 0 },
      starts: {
        100: places(500, 500),
        200: places(400, 500),
        300: places(300, 500),
        400: places(200, 500),
        600: places(0, 500)
      }
    },
    {
      name: 'a 1 square caster between grid lines',
      token: { id: 'caster', position: { x: 580, y: 580 }, width: 100, height: 100 },
      gridOrigin: { x: 0, y: 0 },
      starts: {
        100: places(500, 600),
        200: places(400, 600),
        300: places(300, 600),
        400: places(200, 600),
        600: places(0, 600)
      }
    },
    {
      name: 'a 2 square caster on the grid',
      token: { id: 'caster', position: { x: 600, y: 600 }, width: 200, height: 200 },
      gridOrigin: { x: 0, y: 0 },
      starts: {
        100: places(500, 600),
        200: places(400, 600),
        300: places(300, 600),
        400: places(200, 600),
        600: places(0, 600)
      }
    },
    {
      name: 'a 1 square caster on a grid that starts at 30',
      token: { id: 'caster', position: { x: 580, y: 580 }, width: 100, height: 100 },
      gridOrigin: { x: 30, y: 30 },
      starts: {
        100: places(530, 530),
        200: places(430, 530),
        300: places(330, 530),
        400: places(230, 530),
        600: places(30, 530)
      }
    }
  ] as const
  /** A side of the caster's space: where the pointer presses along it and what the cube covers. */
  const sides = [
    { name: 'east', along: 'y', out: 1, depth: 'x' },
    { name: 'west', along: 'y', out: -1, depth: 'x' },
    { name: 'south', along: 'x', out: 1, depth: 'y' },
    { name: 'north', along: 'x', out: -1, depth: 'y' }
  ] as const
  /** Presses per place across the side: each press falls inside one place, never on a boundary. */
  const PRESSES_PER_PLACE = 12

  const cases = casters.flatMap((entry) =>
    sides.flatMap((side) =>
      ([100, 200, 300, 400, 600] as const).map((edgeLength) => ({ entry, side, edgeLength }))
    )
  )

  it.each(cases)(
    'puts the $edgeLength px cube of $entry.name flush on its $side side, on grid lines, sharing the side, each place equally',
    ({ entry, side, edgeLength }) => {
      const { token, gridOrigin, starts } = entry
      const half = { x: token.width / 2, y: token.height / 2 }
      const sideStart = token.position[side.along] - half[side.along]
      const sideLength = half[side.along] * 2
      const faceAt = token.position[side.depth] + side.out * half[side.depth]
      const expected = starts[edgeLength]
      const pressCount = expected.length * PRESSES_PER_PLACE
      const placed = range(0, pressCount - 1).map((press) => {
        const pressedAt = sideStart + ((press + 0.5) / pressCount) * sideLength
        const origin = { [side.depth]: faceAt, [side.along]: pressedAt } as { x: number; y: number }
        const toward = { ...origin, [side.depth]: faceAt + side.out * 100 }
        const outline = directedAreaOutline(
          origin,
          { kind: 'CUBE_FROM_SIDE', edgeLength, cellSize: 100, gridOrigin, toward },
          token
        )
        if (!outline) throw new Error('The cube has no outline.')
        const depths = outline.map((point) => point[side.depth])
        const slides = outline.map((point) => point[side.along])
        // Flush against the side and one full edge out from it.
        expect([Math.min(...depths), Math.max(...depths)]).toEqual(
          side.out > 0 ? [faceAt, faceAt + edgeLength] : [faceAt - edgeLength, faceAt]
        )
        expect(Math.max(...slides) - Math.min(...slides)).toBe(edgeLength)
        return Math.min(...slides)
      })
      // On grid lines: the face starts on a line of the Scene's grid, not at the caster's own edge.
      expect([...new Set(placed)]).toEqual(expected)
      // Equal shares: the places run in order across the side and each holds the same presses.
      expect(placed).toEqual(
        expected.flatMap((place) => Array.from({ length: PRESSES_PER_PLACE }, () => place))
      )
    }
  )
})

describe('a cube from a point', () => {
  // User ruling 2026-10-14, D103: an area catches a footprint only when it shares area with it.
  it('on grid lines catches exactly the 9 squares it covers, not the ones it touches', () => {
    expect(
      spatialTokensInsideArea({
        origin: { x: 550, y: 550 },
        shape: { kind: 'CUBE', edgeLength: 300 },
        tokens: everySquare
      }).sort()
    ).toEqual(squares(...range(-1, 1).flatMap((x) => column(x, [-1, 0, 1]))))
  })
})

describe('directedAreaOutline', () => {
  it('is the polygon the catching reads, null without a direction', () => {
    expect(
      directedAreaOutline(
        { x: 600, y: 550 },
        { kind: 'CONE', length: 300, toward: { x: 700, y: 550 } },
        caster
      )
    ).toEqual([
      { x: 600, y: 550 },
      { x: 900, y: 700 },
      { x: 900, y: 400 }
    ])
    expect(
      directedAreaOutline(
        { x: 600, y: 550 },
        { kind: 'CONE', length: 300, toward: { x: 600, y: 550 } },
        caster
      )
    ).toBeNull()
  })

  it('draws a cube flush against the side, slid to the squares the origin picks', () => {
    expect(
      directedAreaOutline(
        { x: 600, y: 505 },
        {
          kind: 'CUBE_FROM_SIDE',
          edgeLength: 300,
          cellSize: 100,
          gridOrigin: { x: 0, y: 0 },
          toward: { x: 700, y: 505 }
        },
        caster
      )
    ).toEqual([
      { x: 600, y: 300 },
      { x: 900, y: 300 },
      { x: 900, y: 600 },
      { x: 600, y: 600 }
    ])
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
    ).toEqual({
      kind: 'CUBE_FROM_SIDE',
      edgeLength: 300,
      cellSize: 100,
      gridOrigin: { x: 0, y: 0 },
      toward
    })
  })

  it('snaps a cube to the lines of a grid that does not start at the Scene’s corner', () => {
    expect(
      directedAreaInSceneCoordinates({ kind: 'CUBE_FROM_SIDE', edgeLength: feet(15) }, toward, {
        ...grid,
        origin: { x: 30, y: 45 }
      })
    ).toEqual({
      kind: 'CUBE_FROM_SIDE',
      edgeLength: 300,
      cellSize: 100,
      gridOrigin: { x: 30, y: 45 },
      toward
    })
  })

  it('snaps a cube on a gridless Scene to 5 ft squares', () => {
    const gridless: SceneGrid = { kind: 'GRIDLESS', pixelsPerUnit: 20, unit: 'FEET' }
    expect(
      directedAreaInSceneCoordinates(
        { kind: 'CUBE_FROM_SIDE', edgeLength: feet(15) },
        toward,
        gridless
      )
    ).toEqual({
      kind: 'CUBE_FROM_SIDE',
      edgeLength: 300,
      cellSize: 100,
      gridOrigin: { x: 0, y: 0 },
      toward
    })
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
    cellSize: 100,
    gridOrigin: { x: 0, y: 0 },
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

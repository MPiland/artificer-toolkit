import { describe, expect, it } from 'vitest'

import {
  classifySquareGridFootprintFacingArcs,
  classifySquareGridFacingArc,
  deriveSquareGridForcedMovementDestinations,
  enumerateSquareGridFootprint,
  facingArcSectors,
  findSquareGridFlankingPairs,
  SQUARE_GRID_COMPASS_RAYS,
  traceSquareGridForcedMovementRay
} from '../domains/vtt/optionalCombatGeometry.js'
import type { FacingArcRange } from '../domains/vtt/facingArc.js'
import type { CampaignSceneState, SceneGrid, SceneToken } from '../domains/vtt/scene.js'

/** Four 90-degree arcs centred on the facing, as the SRD Facing rule authors them. */
const QUARTER_ARCS: readonly FacingArcRange[] = [
  { arc: 'FRONT', fromDegrees: -45, toDegrees: 45 },
  { arc: 'RIGHT_SIDE', fromDegrees: 45, toDegrees: 135 },
  { arc: 'REAR', fromDegrees: 135, toDegrees: 225 },
  { arc: 'LEFT_SIDE', fromDegrees: 225, toDegrees: 315 }
]

const grid: SceneGrid = {
  cellSize: 10,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  kind: 'SQUARE',
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

function token(
  position: { x: number; y: number },
  width = 10,
  height = width
): Pick<SceneToken, 'height' | 'position' | 'rotationDegrees' | 'width'> {
  return { height, position, rotationDegrees: 0, width }
}

function footprint(value: ReturnType<typeof enumerateSquareGridFootprint>) {
  if (!value) throw new Error('Expected an aligned footprint')
  return value
}

function state(
  overrides: Partial<Pick<CampaignSceneState, 'barriers' | 'doorStates' | 'grid' | 'map'>> = {}
) {
  return {
    barriers: [],
    doorStates: {},
    grid,
    map: { assetId: 'map', height: 100, tileManifestAssetId: null, width: 100 },
    ...overrides
  }
}

describe('optional combat square-grid geometry', () => {
  it('enumerates exact small and rectangular occupied cells without rounding', () => {
    expect(footprint(enumerateSquareGridFootprint(grid, token({ x: 5, y: 5 }))).cells).toEqual([
      { column: 0, id: '0:0', center: { x: 5, y: 5 }, row: 0 }
    ])
    expect(
      footprint(enumerateSquareGridFootprint(grid, token({ x: 10, y: 10 }, 20, 20))).cells
    ).toHaveLength(4)
    expect(
      footprint(enumerateSquareGridFootprint(grid, token({ x: 15, y: 10 }, 30, 20))).cells.map(
        (cell) => cell.id
      )
    ).toEqual(['0:0', '1:0', '2:0', '0:1', '1:1', '2:1'])
    expect(
      footprint(enumerateSquareGridFootprint(grid, token({ x: 80, y: 80 }, 160, 160))).cells
    ).toHaveLength(256)
    expect(enumerateSquareGridFootprint(grid, token({ x: 85, y: 80 }, 170, 160))).toBeNull()
    expect(enumerateSquareGridFootprint(grid, token({ x: 6, y: 5 }))).toBeNull()
    expect(
      enumerateSquareGridFootprint(
        { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' },
        token({ x: 5, y: 5 })
      )
    ).toBeNull()
  })

  it('finds exact opposite adjacent side/corner flank pairs and rejects reach-like distance', () => {
    const target = footprint(enumerateSquareGridFootprint(grid, token({ x: 10, y: 10 }, 20, 20)))
    const west = footprint(enumerateSquareGridFootprint(grid, token({ x: -5, y: 5 })))
    const east = footprint(enumerateSquareGridFootprint(grid, token({ x: 25, y: 5 })))
    const northWest = footprint(enumerateSquareGridFootprint(grid, token({ x: -5, y: -5 })))
    const southEast = footprint(enumerateSquareGridFootprint(grid, token({ x: 25, y: 25 })))
    expect(
      findSquareGridFlankingPairs({ allied: east, attacker: west, grid, target })[0]
    ).toMatchObject({
      alliedCell: { id: '2:0' },
      alliedSector: 'EAST',
      attackerCell: { id: '-1:0' },
      attackerSector: 'WEST'
    })
    expect(
      findSquareGridFlankingPairs({ allied: southEast, attacker: northWest, grid, target })
    ).toHaveLength(1)
    const twoCellsAway = footprint(enumerateSquareGridFootprint(grid, token({ x: -15, y: 5 })))
    expect(
      findSquareGridFlankingPairs({ allied: east, attacker: twoCellsAway, grid, target })
    ).toEqual([])
  })

  it('draws each arc where the classifier puts a direction into it', () => {
    const target = { ...token({ x: 15, y: 15 }, 20, 20), rotationDegrees: 90 }
    for (const sector of facingArcSectors({ arcs: QUARTER_ARCS, rotationDegrees: 90 })) {
      const middle = (((sector.fromBearing + sector.toBearing) / 2) * Math.PI) / 180
      expect(
        classifySquareGridFacingArc({
          arcs: QUARTER_ARCS,
          subject: { x: 15 + Math.sin(middle) * 50, y: 15 - Math.cos(middle) * 50 },
          target
        })
      ).toBe(sector.arc)
    }
    expect(facingArcSectors({ arcs: QUARTER_ARCS, rotationDegrees: Number.NaN })).toEqual([])
  })

  it('normalizes rotations and applies stable arc-boundary precedence', () => {
    const target = token({ x: 15, y: 15 }, 20, 20)
    expect(
      classifySquareGridFacingArc({ arcs: QUARTER_ARCS, subject: { x: 15, y: 5 }, target })
    ).toBe('FRONT')
    expect(
      classifySquareGridFacingArc({ arcs: QUARTER_ARCS, subject: { x: 25, y: 5 }, target })
    ).toBe('FRONT')
    expect(
      classifySquareGridFacingArc({ arcs: QUARTER_ARCS, subject: { x: 25.1, y: 5 }, target })
    ).toBe('RIGHT_SIDE')
    expect(
      classifySquareGridFacingArc({
        arcs: QUARTER_ARCS,
        subject: { x: 25, y: 25 },
        target: { ...target, rotationDegrees: 360 }
      })
    ).toBe('RIGHT_SIDE')
    expect(
      classifySquareGridFacingArc({
        arcs: QUARTER_ARCS,
        subject: { x: 5, y: 25 },
        target: { ...target, rotationDegrees: -360 }
      })
    ).toBe('LEFT_SIDE')
    expect(
      classifySquareGridFacingArc({ arcs: QUARTER_ARCS, subject: { x: 15, y: 35 }, target })
    ).toBe('REAR')
  })

  it('classifies against the authored arc table, so a homebrew table moves the edges (ATTACK-12)', () => {
    // A wide front and a narrow rear, with no side arcs.
    const homebrew: readonly FacingArcRange[] = [
      { arc: 'FRONT', fromDegrees: -120, toDegrees: 120 },
      { arc: 'REAR', fromDegrees: 120, toDegrees: 240 }
    ]
    const target = token({ x: 15, y: 15 }, 20, 20)
    const east = { x: 35, y: 15 }
    const southEast = { x: 35, y: 35 }
    const south = { x: 15, y: 35 }
    expect(classifySquareGridFacingArc({ arcs: QUARTER_ARCS, subject: east, target })).toBe(
      'RIGHT_SIDE'
    )
    expect(classifySquareGridFacingArc({ arcs: homebrew, subject: east, target })).toBe('FRONT')
    expect(classifySquareGridFacingArc({ arcs: QUARTER_ARCS, subject: southEast, target })).toBe(
      'RIGHT_SIDE'
    )
    expect(classifySquareGridFacingArc({ arcs: homebrew, subject: southEast, target })).toBe('REAR')
    expect(classifySquareGridFacingArc({ arcs: homebrew, subject: south, target })).toBe('REAR')
    // An edge both arcs share belongs to the one nearer the front.
    expect(
      classifySquareGridFacingArc({
        arcs: homebrew,
        subject: {
          x: 15 + Math.sin((120 * Math.PI) / 180) * 20,
          y: 15 - Math.cos((120 * Math.PI) / 180) * 20
        },
        target
      })
    ).toBe('FRONT')
  })
  it('uses the closest occupied cells for large-footprint facing with stable ties', () => {
    const source = footprint(enumerateSquareGridFootprint(grid, token({ x: 20, y: 20 }, 40)))
    const target = footprint(enumerateSquareGridFootprint(grid, token({ x: 45, y: -20 }, 10, 60)))
    const arcs = classifySquareGridFootprintFacingArcs({
      arcs: QUARTER_ARCS,
      grid,
      source: { footprint: source, rotationDegrees: 0 },
      target: { footprint: target, rotationDegrees: 180 }
    })
    // The target center is in source's front arc; its closest occupied square is on the right.
    expect(arcs).toMatchObject({ sourceToTarget: 'RIGHT_SIDE' })

    const tieTarget = footprint(enumerateSquareGridFootprint(grid, token({ x: 30, y: 10 }, 20)))
    const tieInput = {
      arcs: QUARTER_ARCS,
      grid,
      source: {
        footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 10, y: 10 }, 20))),
        rotationDegrees: 0
      },
      target: { footprint: tieTarget, rotationDegrees: 0 }
    }
    expect(
      classifySquareGridFootprintFacingArcs({
        ...tieInput,
        target: {
          ...tieInput.target,
          footprint: { ...tieTarget, cells: [...tieTarget.cells].reverse() }
        }
      })
    ).toEqual(classifySquareGridFootprintFacingArcs(tieInput))
    const boundary = classifySquareGridFootprintFacingArcs({
      arcs: QUARTER_ARCS,
      grid,
      source: {
        footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 5, y: 5 }))),
        rotationDegrees: 0
      },
      target: {
        footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 15, y: -5 }))),
        rotationDegrees: 0
      }
    })
    expect(boundary).toMatchObject({ sourceToTarget: 'FRONT' })
    expect(
      classifySquareGridFootprintFacingArcs({
        ...tieInput,
        source: { ...tieInput.source, rotationDegrees: Number.NaN }
      })
    ).toBeNull()
  })

  it('fails closed for forged or stale grid footprints', () => {
    const attacker = footprint(enumerateSquareGridFootprint(grid, token({ x: -5, y: 5 })))
    const allied = footprint(enumerateSquareGridFootprint(grid, token({ x: 25, y: 5 })))
    const target = footprint(enumerateSquareGridFootprint(grid, token({ x: 10, y: 10 }, 20, 20)))
    expect(
      findSquareGridFlankingPairs({
        allied,
        attacker,
        grid,
        target: { ...target, bounds: { ...target.bounds, right: target.bounds.right + 10 } }
      })
    ).toEqual([])
    expect(
      findSquareGridFlankingPairs({
        allied,
        attacker: {
          ...attacker,
          cells: [{ ...attacker.cells[0]!, center: { x: 0, y: 5 } }]
        },
        grid,
        target
      })
    ).toEqual([])
  })

  it('fails closed for invalid inputs', () => {
    const target = footprint(enumerateSquareGridFootprint(grid, token({ x: 5, y: 5 })))
    expect(
      findSquareGridFlankingPairs({
        allied: target,
        attacker: target,
        grid: { ...grid, cellSize: 0 },
        target
      })
    ).toEqual([])
    expect(
      classifySquareGridFacingArc({
        arcs: QUARTER_ARCS,
        subject: { x: Number.NaN, y: 0 },
        target: token({ x: 5, y: 5 })
      })
    ).toBeNull()
  })
})

describe('square-grid forced movement', () => {
  const source = token({ x: 15, y: 45 })
  const push = (
    overrides: Partial<Parameters<typeof deriveSquareGridForcedMovementDestinations>[0]> = {}
  ) =>
    deriveSquareGridForcedMovementDestinations({
      direction: 'AWAY_FROM_SOURCE',
      distance: 15,
      upTo: false,
      sourceReach: null,
      source,
      target: token({ x: 25, y: 45 }),
      occupants: [source],
      state: state(),
      ...overrides
    })

  it('moves the exact distance straight away from or toward the source', () => {
    expect(push()).toEqual([{ x: 55, y: 45 }])
    expect(
      push({ direction: 'TOWARD_SOURCE', distance: 20, target: token({ x: 75, y: 45 }) })
    ).toEqual([{ x: 35, y: 45 }])
    expect(
      push({
        distance: 10,
        source: token({ x: 15, y: 15 }),
        target: token({ x: 25, y: 25 }),
        occupants: [token({ x: 15, y: 15 })]
      })
    ).toEqual([{ x: 45, y: 45 }])
    expect(push({ distance: 0 })).toEqual([{ x: 25, y: 45 }])
  })

  it('stops before the first barrier, token or map edge on its line', () => {
    const wall = {
      a: { x: 40, y: 40 },
      b: { x: 40, y: 50 },
      blocksLight: true,
      blocksMovement: true,
      id: 'wall',
      kind: 'WALL' as const
    }
    expect(push({ state: state({ barriers: [wall] }) })).toEqual([{ x: 35, y: 45 }])
    expect(push({ occupants: [source, token({ x: 45, y: 45 })] })).toEqual([{ x: 35, y: 45 }])
    expect(push({ distance: 50, target: token({ x: 85, y: 45 }) })).toEqual([{ x: 95, y: 45 }])
    expect(
      push({ direction: 'TOWARD_SOURCE', distance: 25, target: token({ x: 45, y: 45 }) })
    ).toEqual([{ x: 25, y: 45 }])
  })

  it('lists every square along the line for an up-to distance, staying put first', () => {
    expect(push({ upTo: true })).toEqual([
      { x: 25, y: 45 },
      { x: 35, y: 45 },
      { x: 45, y: 45 },
      { x: 55, y: 45 }
    ])
    expect(push({ upTo: true, occupants: [source, token({ x: 45, y: 45 })] })).toEqual([
      { x: 25, y: 45 },
      { x: 35, y: 45 }
    ])
  })

  describe('a rolled ray', () => {
    const trace = (
      overrides: Partial<Parameters<typeof traceSquareGridForcedMovementRay>[0]> = {}
    ) =>
      traceSquareGridForcedMovementRay({
        direction: 'RAY',
        ray: { x: 0, y: 1 },
        distance: 15,
        upTo: false,
        sourceReach: null,
        source,
        target: token({ x: 45, y: 45 }),
        occupants: [source],
        state: state(),
        ...overrides
      })

    it('lists eight unit compass rays, north first and clockwise', () => {
      expect(SQUARE_GRID_COMPASS_RAYS).toEqual([
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: 0 },
        { x: -1, y: -1 }
      ])
    })

    it('walks the given line whatever side of the source the target is on, diagonals included', () => {
      expect(push({ direction: 'RAY', ray: { x: 0, y: 1 } })).toEqual([{ x: 25, y: 75 }])
      expect(push({ direction: 'RAY', ray: { x: -1, y: -1 }, distance: 10 })).toEqual([
        { x: 5, y: 25 }
      ])
      expect(push({ direction: 'RAY', ray: { x: 1, y: 0 }, upTo: true, distance: 10 })).toEqual([
        { x: 25, y: 45 },
        { x: 35, y: 45 },
        { x: 45, y: 45 }
      ])
    })

    it('fails closed without a direction to follow', () => {
      expect(trace({ ray: undefined })).toBeNull()
      expect(trace({ ray: { x: 0, y: 0 } })).toBeNull()
    })

    it('reports a distance stop when nothing was in the way', () => {
      expect(trace()).toEqual({
        reached: [
          { x: 45, y: 45 },
          { x: 45, y: 55 },
          { x: 45, y: 65 },
          { x: 45, y: 75 }
        ],
        stop: { kind: 'DISTANCE' }
      })
    })

    it('reports the creature, by its place among the occupants, that stopped the line', () => {
      expect(trace({ occupants: [source, token({ x: 45, y: 65 })] })).toEqual({
        reached: [
          { x: 45, y: 45 },
          { x: 45, y: 55 }
        ],
        stop: { kind: 'CREATURE', occupantIndex: 1 }
      })
    })

    it('reports an object when a wall or the map edge stopped the line', () => {
      const wall = {
        a: { x: 40, y: 60 },
        b: { x: 50, y: 60 },
        blocksLight: true,
        blocksMovement: true,
        id: 'wall',
        kind: 'WALL' as const
      }
      expect(trace({ state: state({ barriers: [wall] }) })?.stop).toEqual({ kind: 'OBJECT' })
      expect(trace({ distance: 100, target: token({ x: 45, y: 85 }) })?.stop).toEqual({
        kind: 'OBJECT'
      })
    })

    it('reports a creature in the way of a straight push the same way', () => {
      expect(
        trace({
          direction: 'AWAY_FROM_SOURCE',
          ray: undefined,
          target: token({ x: 25, y: 45 }),
          occupants: [source, token({ x: 45, y: 45 })]
        })
      ).toEqual({
        reached: [
          { x: 25, y: 45 },
          { x: 35, y: 45 }
        ],
        stop: { kind: 'CREATURE', occupantIndex: 1 }
      })
    })
  })

  describe('a direction the mover picks', () => {
    const crusher = token({ x: 45, y: 55 })
    const pick = (
      overrides: Partial<Parameters<typeof deriveSquareGridForcedMovementDestinations>[0]> = {}
    ) =>
      push({
        direction: 'ANY',
        distance: 5,
        source: crusher,
        target: token({ x: 55, y: 55 }),
        occupants: [crusher],
        ...overrides
      })

    it('offers each free square at exactly the distance in any direction (the Crusher)', () => {
      expect(pick()).toEqual([
        { x: 45, y: 45 },
        { x: 55, y: 45 },
        { x: 65, y: 45 },
        { x: 65, y: 55 },
        { x: 45, y: 65 },
        { x: 55, y: 65 },
        { x: 65, y: 65 }
      ])
    })

    it('offers staying put first and every nearer square for an up-to distance', () => {
      const squares = pick({ distance: 10, upTo: true })
      expect(squares?.[0]).toEqual({ x: 55, y: 55 })
      expect(squares).toHaveLength(24)
      expect(squares).not.toContainEqual({ x: 45, y: 55 })
      expect(squares).toContainEqual({ x: 75, y: 75 })
    })

    it('leaves the target in place when no square at the distance is free', () => {
      const ring = [45, 55, 65].flatMap((x) =>
        [45, 55, 65].filter((y) => x !== 55 || y !== 55).map((y) => token({ x, y }))
      )
      expect(pick({ occupants: ring })).toEqual([{ x: 55, y: 55 }])
    })

    it('keeps an aside move within the source reach', () => {
      expect(pick({ direction: 'ASIDE', sourceReach: 5 })).toEqual([
        { x: 45, y: 45 },
        { x: 55, y: 45 },
        { x: 45, y: 65 },
        { x: 55, y: 65 }
      ])
      expect(pick({ direction: 'ASIDE', sourceReach: 10 })).toHaveLength(7)
      expect(pick({ direction: 'ASIDE', sourceReach: null })).toBeNull()
    })

    it('fails closed past the interaction bound', () => {
      expect(pick({ distance: 100 })).toBeNull()
    })
  })

  it('fails closed without a square grid or a line to follow', () => {
    expect(
      push({ state: state({ grid: { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' } }) })
    ).toBeNull()
    expect(push({ target: token({ x: 15, y: 45 }) })).toBeNull()
    expect(push({ target: token({ x: 26, y: 45 }) })).toBeNull()
  })
})

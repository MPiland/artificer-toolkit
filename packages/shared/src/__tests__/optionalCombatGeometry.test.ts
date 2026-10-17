import { describe, expect, it } from 'vitest'

import {
  classifySquareGridFootprintFacingArcs,
  classifySquareGridFacingArc,
  deriveSquareGridForcedMovementDestination,
  deriveSquareGridShoveAsideDestinations,
  enumerateSquareGridFootprint,
  findSquareGridCreatureCoverIntervenors,
  findSquareGridFlankingPairs
} from '../domains/vtt/optionalCombatGeometry.js'
import type { CampaignSceneState, SceneGrid, SceneToken } from '../domains/vtt/scene.js'

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

  it('normalizes rotations and applies stable arc-boundary precedence', () => {
    const target = token({ x: 15, y: 15 }, 20, 20)
    expect(classifySquareGridFacingArc({ subject: { x: 15, y: 5 }, target })).toBe('FRONT')
    expect(classifySquareGridFacingArc({ subject: { x: 25, y: 5 }, target })).toBe('FRONT')
    expect(classifySquareGridFacingArc({ subject: { x: 25.1, y: 5 }, target })).toBe('RIGHT_SIDE')
    expect(
      classifySquareGridFacingArc({
        subject: { x: 25, y: 25 },
        target: { ...target, rotationDegrees: 360 }
      })
    ).toBe('RIGHT_SIDE')
    expect(
      classifySquareGridFacingArc({
        subject: { x: 5, y: 25 },
        target: { ...target, rotationDegrees: -360 }
      })
    ).toBe('LEFT_SIDE')
    expect(classifySquareGridFacingArc({ subject: { x: 15, y: 35 }, target })).toBe('REAR')
  })

  it('uses the closest occupied cells for large-footprint facing with stable ties', () => {
    const source = footprint(enumerateSquareGridFootprint(grid, token({ x: 20, y: 20 }, 40)))
    const target = footprint(enumerateSquareGridFootprint(grid, token({ x: 45, y: -20 }, 10, 60)))
    const arcs = classifySquareGridFootprintFacingArcs({
      grid,
      source: { footprint: source, rotationDegrees: 0 },
      target: { footprint: target, rotationDegrees: 180 }
    })
    // The target center is in source's front arc; its closest occupied square is on the right.
    expect(arcs).toMatchObject({ sourceToTarget: 'RIGHT_SIDE' })

    const tieTarget = footprint(enumerateSquareGridFootprint(grid, token({ x: 30, y: 10 }, 20)))
    const tieInput = {
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

  it('returns deterministic intervening creature cells while excluding endpoints and corner touches', () => {
    const attacker = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 5, y: 15 }))),
      tokenId: 'attacker'
    }
    const target = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 45, y: 15 }))),
      tokenId: 'target'
    }
    const middleB = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 25, y: 15 }))),
      tokenId: 'b'
    }
    const middleA = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 15, y: 15 }))),
      tokenId: 'a'
    }
    const corner = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 25, y: 25 }))),
      tokenId: 'corner'
    }
    expect(
      findSquareGridCreatureCoverIntervenors({
        attacker,
        candidates: [middleB, target, corner, attacker, middleA],
        grid,
        target
      })
    ).toEqual([
      { cell: expect.objectContaining({ id: '1:1' }), tokenId: 'a' },
      { cell: expect.objectContaining({ id: '2:1' }), tokenId: 'b' }
    ])
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
    const malformedCandidate = {
      footprint: {
        ...attacker,
        cells: [{ ...attacker.cells[0]!, id: 'wrong-id' }]
      },
      tokenId: 'candidate'
    }
    expect(
      findSquareGridCreatureCoverIntervenors({
        attacker: { footprint: attacker, tokenId: 'attacker' },
        candidates: [malformedCandidate],
        grid,
        target: { footprint: target, tokenId: 'target' }
      })
    ).toEqual([])
    expect(
      findSquareGridCreatureCoverIntervenors({
        attacker: { footprint: attacker, tokenId: 'attacker' },
        candidates: [],
        grid,
        target: { footprint: { ...target, cells: target.cells.slice(0, -1) }, tokenId: 'target' }
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
        subject: { x: Number.NaN, y: 0 },
        target: token({ x: 5, y: 5 })
      })
    ).toBeNull()
    expect(
      findSquareGridCreatureCoverIntervenors({
        attacker: { footprint: target, tokenId: 'a' },
        candidates: [],
        grid: { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' },
        target: { footprint: target, tokenId: 't' }
      })
    ).toEqual([])
  })

  it('derives canonical legal Shove Aside destinations and rejects collision, map, and barrier paths', () => {
    const attacker = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 15, y: 15 }))),
      tokenId: 'attacker'
    }
    const target = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 25, y: 15 }))),
      tokenId: 'target'
    }
    const initial = deriveSquareGridShoveAsideDestinations({
      attacker,
      displacement: 5,
      occupants: [],
      state: state(),
      target
    })
    expect(initial.map((candidate) => candidate.direction)).toEqual([
      'NORTH',
      'SOUTH',
      'SOUTH_WEST',
      'NORTH_WEST'
    ])
    expect(initial.every((candidate) => candidate.remainsAdjacentToAttacker)).toBe(true)

    expect(
      deriveSquareGridShoveAsideDestinations({
        attacker,
        displacement: 5,
        occupants: [],
        state: state(),
        target: {
          footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 45, y: 15 }))),
          tokenId: 'distant-target'
        }
      })
    ).toEqual([])

    const occupied = deriveSquareGridShoveAsideDestinations({
      attacker,
      displacement: 5,
      occupants: [
        {
          footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 35, y: 15 }))),
          tokenId: 'occupant'
        }
      ],
      state: state(),
      target
    })
    expect(occupied.map((candidate) => candidate.direction)).not.toContain('EAST')

    const blocked = deriveSquareGridShoveAsideDestinations({
      attacker,
      displacement: 5,
      occupants: [],
      state: state({
        barriers: [
          {
            a: { x: 30, y: 10 },
            b: { x: 30, y: 20 },
            blocksLight: true,
            blocksMovement: true,
            id: 'wall',
            kind: 'WALL'
          }
        ]
      }),
      target
    })
    expect(blocked.map((candidate) => candidate.direction)).not.toContain('EAST')

    const edgeTarget = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 5, y: 5 }))),
      tokenId: 'edge-target'
    }
    const edgeAttacker = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 15, y: 15 }))),
      tokenId: 'edge-attacker'
    }
    expect(
      deriveSquareGridShoveAsideDestinations({
        attacker: edgeAttacker,
        displacement: 5,
        occupants: [],
        state: state(),
        target: edgeTarget
      }).map((candidate) => candidate.direction)
    ).not.toContain('NORTH_WEST')
  })

  it('keeps large rectangular Shove Aside footprints aligned and fails closed outside square grids', () => {
    const attacker = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 10, y: 10 }, 20, 20))),
      tokenId: 'attacker'
    }
    const target = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 35, y: 20 }, 30, 20))),
      tokenId: 'target'
    }
    const candidates = deriveSquareGridShoveAsideDestinations({
      attacker,
      displacement: 5,
      occupants: [],
      state: state(),
      target
    })
    expect(candidates).not.toHaveLength(0)
    expect(candidates.every((candidate) => candidate.targetFootprint.cells.length === 6)).toBe(true)
    expect(
      deriveSquareGridShoveAsideDestinations({
        attacker,
        displacement: 5,
        occupants: [],
        state: state({ grid: { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' } }),
        target
      })
    ).toEqual([])
  })

  it('uses the sealed Scene-measurement displacement instead of treating every grid cell as five feet', () => {
    const attacker = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 15, y: 15 }))),
      tokenId: 'attacker'
    }
    const target = {
      footprint: footprint(enumerateSquareGridFootprint(grid, token({ x: 25, y: 15 }))),
      tokenId: 'target'
    }
    expect(
      deriveSquareGridShoveAsideDestinations({
        attacker,
        displacement: 5,
        occupants: [],
        state: state({ grid: { ...grid, distancePerCell: 10 } }),
        target
      })
    ).toEqual([])

    const euclidean = deriveSquareGridShoveAsideDestinations({
      attacker,
      displacement: 5,
      occupants: [],
      state: state({ grid: { ...grid, diagonalPolicy: 'EUCLIDEAN' } }),
      target
    })
    expect(euclidean.map((candidate) => candidate.direction)).toEqual(['NORTH', 'SOUTH'])
  })
})

describe('square-grid forced movement', () => {
  const source = token({ x: 15, y: 45 })
  const push = (
    overrides: Partial<Parameters<typeof deriveSquareGridForcedMovementDestination>[0]> = {}
  ) =>
    deriveSquareGridForcedMovementDestination({
      direction: 'AWAY_FROM_SOURCE',
      distance: 15,
      source,
      target: token({ x: 25, y: 45 }),
      occupants: [source],
      state: state(),
      ...overrides
    })

  it('moves the exact distance straight away from or toward the source', () => {
    expect(push()).toEqual({ x: 55, y: 45 })
    expect(
      push({ direction: 'TOWARD_SOURCE', distance: 20, target: token({ x: 75, y: 45 }) })
    ).toEqual({ x: 35, y: 45 })
    expect(
      push({
        distance: 10,
        source: token({ x: 15, y: 15 }),
        target: token({ x: 25, y: 25 }),
        occupants: [token({ x: 15, y: 15 })]
      })
    ).toEqual({ x: 45, y: 45 })
    expect(push({ distance: 0 })).toEqual({ x: 25, y: 45 })
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
    expect(push({ state: state({ barriers: [wall] }) })).toEqual({ x: 35, y: 45 })
    expect(push({ occupants: [source, token({ x: 45, y: 45 })] })).toEqual({ x: 35, y: 45 })
    expect(push({ distance: 50, target: token({ x: 85, y: 45 }) })).toEqual({ x: 95, y: 45 })
    expect(
      push({ direction: 'TOWARD_SOURCE', distance: 25, target: token({ x: 45, y: 45 }) })
    ).toEqual({ x: 25, y: 45 })
  })

  it('fails closed without a square grid or a line to follow', () => {
    expect(
      push({ state: state({ grid: { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' } }) })
    ).toBeNull()
    expect(push({ target: token({ x: 15, y: 45 }) })).toBeNull()
    expect(push({ target: token({ x: 26, y: 45 }) })).toBeNull()
  })
})

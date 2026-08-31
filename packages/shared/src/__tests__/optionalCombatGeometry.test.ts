import { describe, expect, it } from 'vitest'

import {
  classifySquareGridFootprintFacingArcs,
  classifySquareGridFacingArc,
  enumerateSquareGridFootprint,
  findSquareGridCreatureCoverIntervenors,
  findSquareGridFlankingPairs
} from '../domains/vtt/optionalCombatGeometry.js'
import type { SceneGrid, SceneToken } from '../domains/vtt/scene.js'

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
})

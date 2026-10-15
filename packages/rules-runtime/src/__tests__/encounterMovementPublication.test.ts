import { spatialRuleEffectPlacementDtoSchema } from '@artificer-toolkit/schema/shared/spatial'
import { describe, expect, it } from 'vitest'

import {
  preparedMovementCost,
  preparedMovementSceneDelta,
  preparedMovementSegment
} from '../encounterMovementPublication.js'

const tokenId = '00000000-0000-4000-8000-000000000001'
const path = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 }
]

describe('prepared movement publication', () => {
  it('measures a segment from the path origin, so a mid-cell pause does not round twice', () => {
    const grid = {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    }
    const walk = {
      grid,
      scene: { barriers: [] },
      path: [
        { x: 0, y: 0 },
        { x: 300, y: 0 }
      ]
    }
    // A pause half a cell in rounds to one cell; the rest of the walk then costs two.
    expect(preparedMovementCost({ ...walk, startDistance: 50, outcome: null })).toBe(10)
    expect(preparedMovementCost({ ...walk, startDistance: 0, outcome: null })).toBe(15)
  })

  it('charges a careful mover double for the stretch it spends in a half-speed field', () => {
    const grid = {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    }
    const field = (
      bypassAtHalfSpeed: boolean,
      visibility: 'PUBLIC' | 'HIDDEN' = 'PUBLIC',
      revealed = true
    ) => ({
      spatialState: { schemaVersion: 1 as const, revealed },
      placement: spatialRuleEffectPlacementDtoSchema.parse({
        schemaVersion: 1,
        anchorKind: 'FIXED',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: {
            kind: 'POLYGON',
            points: [
              { x: 100, y: -100 },
              { x: 200, y: -100 },
              { x: 200, y: 100 },
              { x: 100, y: 100 }
            ]
          }
        },
        triggerModes: ['ENTER'],
        movementKinds: ['VOLUNTARY'],
        activation: 'REPEATABLE',
        visibility,
        revealOnTrigger: false,
        bypassAtHalfSpeed
      })
    })
    const walk = {
      grid,
      scene: { barriers: [] },
      path: [
        { x: 0, y: 0 },
        { x: 400, y: 0 }
      ],
      startDistance: 0,
      outcome: null
    }
    const tokens = [{ id: tokenId, position: { x: 0, y: 0 }, width: 100, height: 100 }]
    const careful = (
      flagged: boolean,
      visibility: 'PUBLIC' | 'HIDDEN' = 'PUBLIC',
      revealed = true
    ) => ({
      tokenId,
      tokens,
      effects: [field(flagged, visibility, revealed)]
    })
    const plain = preparedMovementCost(walk)
    expect(plain).toBe(20)
    expect(preparedMovementCost({ ...walk, careful: careful(false) })).toBe(plain)
    // A hidden field the mover has not seen cannot be crossed carefully: no doubled cost.
    expect(preparedMovementCost({ ...walk, careful: careful(true, 'HIDDEN', false) })).toBe(plain)
    expect(preparedMovementCost({ ...walk, careful: careful(true, 'HIDDEN', true) })).toBeCloseTo(
      30
    )
    // The 100-wide footprint overlaps the field while its centre is between x=50 and x=250: half
    // of the 400-unit walk, so that half costs double.
    expect(preparedMovementCost({ ...walk, careful: careful(true) })).toBeCloseTo(30)
  })

  it('walks the whole remaining path when no rules interrupt it', () => {
    expect(preparedMovementSegment({ path, startDistance: 0, outcome: null })).toEqual({
      path,
      position: { x: 100, y: 50 }
    })
    expect(
      preparedMovementSegment({
        path,
        startDistance: 50,
        outcome: { kind: 'UNINTERRUPTED', reason: 'NO_CANDIDATES' }
      })
    ).toEqual({
      path: [
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 }
      ],
      position: { x: 100, y: 50 }
    })
  })

  it('publishes an unbound or uninterrupted move to the end of its path', () => {
    for (const outcome of [null, { kind: 'UNINTERRUPTED' as const, reason: 'MANUAL' as const }])
      expect(preparedMovementSceneDelta({ tokenId, path, outcome, sceneVersion: 4 })).toEqual({
        kind: 'TOKEN_MOVED',
        tokenId,
        position: { x: 100, y: 50 }
      })
  })
})

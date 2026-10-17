import { describe, expect, it } from 'vitest'

import {
  pointAreaInSceneCoordinates,
  collectSpatialMovementCandidates,
  collectTokenFootprintPathCrossings,
  effectiveSpatialGeometry,
  spatialGeometryOverlapsTokenFootprint,
  spatialSegmentShareInside,
  type SpatialEffectInstance,
  spatialTokensInsideArea,
  spatialTokensWithinSpaceRadius,
  type SpatialSceneToken,
  VTT_SPATIAL_LIMITS
} from '../domains/vtt/spatial.js'
import { sceneDistanceAsCoordinateLength } from '../domains/vtt/geometry.js'
import { VTT_SCENE_LIMITS, type SceneGrid } from '../domains/vtt/scene.js'

const ids = {
  effect: '00000000-0000-4000-8000-000000000001',
  effectTwo: '00000000-0000-4000-8000-000000000002',
  sourceActor: '00000000-0000-4000-8000-000000000003',
  sourceToken: '00000000-0000-4000-8000-000000000004',
  targetActor: '00000000-0000-4000-8000-000000000005',
  targetToken: '00000000-0000-4000-8000-000000000006'
}

function token(id: string, x: number, y = 0): SpatialSceneToken {
  return { height: 2, id, position: { x, y }, width: 2 }
}

function effect(overrides: Partial<SpatialEffectInstance> = {}): SpatialEffectInstance {
  return {
    anchorKind: 'FIXED',
    effectId: ids.effect,
    geometry: {
      frame: 'SCENE_ABSOLUTE',
      shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 }
    },
    movementKinds: ['VOLUNTARY', 'FORCED', 'TELEPORT'],
    sourceActorId: ids.sourceActor,
    sourceTokenId: null,
    triggerModes: ['ENTER', 'EXIT', 'CROSS'],
    ...overrides
  }
}

function collect(
  input: Omit<
    Parameters<typeof collectSpatialMovementCandidates>[0],
    'actorIdByTokenId' | 'effects' | 'tokens' | 'movingTokenId'
  > & {
    readonly effects?: readonly SpatialEffectInstance[]
    readonly tokens?: readonly SpatialSceneToken[]
  }
) {
  return collectSpatialMovementCandidates({
    actorIdByTokenId: new Map([
      [ids.sourceToken, ids.sourceActor],
      [ids.targetToken, ids.targetActor]
    ]),
    effects: input.effects ?? [effect()],
    movingTokenId: ids.targetToken,
    tokens: input.tokens ?? [token(ids.targetToken, input.path[0]!.x, input.path[0]!.y)],
    ...input
  })
}

describe('spatial movement candidates', () => {
  it('uses the full occupied footprint for circle CROSS and EXIT contacts', () => {
    const cross = collect({
      movementKind: 'VOLUNTARY',
      path: [
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ]
    })
    const exit = collect({
      movementKind: 'VOLUNTARY',
      path: [
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ]
    })

    expect(cross).toMatchObject([{ trigger: 'CROSS', sourceMoved: false }])
    expect(cross[0]?.contact.x).toBeCloseTo(-2)
    expect(exit).toMatchObject([{ trigger: 'EXIT', sourceMoved: false }])
    expect(exit[0]?.contact.x).toBeCloseTo(2)
  })

  describe('creatures designated unaffected (SPELLS-20 T4c)', () => {
    const walk = [
      { x: -5, y: 0 },
      { x: 5, y: 0 }
    ]

    const spared = effect({ unaffectedActorIds: [ids.targetActor] })
    const otherSpared = effect({ unaffectedActorIds: [ids.sourceActor] })
    const movements = [
      { trigger: 'CROSS', movementKind: 'VOLUNTARY', path: walk },
      {
        trigger: 'EXIT',
        movementKind: 'VOLUNTARY',
        path: [
          { x: 0, y: 0 },
          { x: 5, y: 0 }
        ]
      },
      {
        trigger: 'ENTER',
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 0, y: 0 }
        ]
      },
      { trigger: 'CROSS', movementKind: 'FORCED', path: walk },
      {
        trigger: 'ENTER',
        movementKind: 'TELEPORT',
        path: [
          { x: -5, y: 0 },
          { x: 0, y: 0 }
        ]
      },
      {
        trigger: 'EXIT',
        movementKind: 'TELEPORT',
        path: [
          { x: 0, y: 0 },
          { x: 5, y: 0 }
        ]
      }
    ] as const

    it.each(movements)(
      'never catches a creature the effect names unaffected on a $movementKind $trigger, and still catches the others',
      ({ trigger, movementKind, path }) => {
        expect(collect({ effects: [otherSpared], movementKind, path })).toMatchObject([{ trigger }])
        expect(collect({ effects: [spared], movementKind, path })).toEqual([])
      }
    )

    it('never catches a spared creature a moving source aura passes over', () => {
      const aura = (unaffectedActorIds: readonly string[]) =>
        effect({
          anchorKind: 'TOKEN',
          geometry: {
            frame: 'TOKEN_LOCAL',
            shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 }
          },
          sourceTokenId: ids.sourceToken,
          unaffectedActorIds
        })
      const sweep = (unaffectedActorIds: readonly string[]) =>
        collectSpatialMovementCandidates({
          actorIdByTokenId: new Map([
            [ids.sourceToken, ids.sourceActor],
            [ids.targetToken, ids.targetActor]
          ]),
          effects: [aura(unaffectedActorIds)],
          movementKind: 'FORCED',
          movingTokenId: ids.sourceToken,
          path: walk,
          tokens: [token(ids.sourceToken, -5), token(ids.targetToken, 0)]
        })
      expect(sweep([ids.targetActor])).toEqual([])
      expect(sweep([])).toHaveLength(1)
    })
  })

  describe('half-speed passage', () => {
    const field = effect({ bypassAtHalfSpeed: true })
    const walk = [
      { x: -5, y: 0 },
      { x: 5, y: 0 }
    ]

    it('skips a flagged field for a voluntary mover who moves carefully', () => {
      expect(collect({ effects: [field], movementKind: 'VOLUNTARY', path: walk })).toHaveLength(1)
      expect(
        collect({ carefully: true, effects: [field], movementKind: 'VOLUNTARY', path: walk })
      ).toEqual([])
    })

    it('still triggers an unflagged field and every non-voluntary movement', () => {
      expect(
        collect({ carefully: true, effects: [effect()], movementKind: 'VOLUNTARY', path: walk })
      ).toHaveLength(1)
      expect(
        collect({ carefully: true, effects: [field], movementKind: 'FORCED', path: walk })
      ).toHaveLength(1)
    })

    it('measures the share of a segment the footprint spends inside geometry', () => {
      const geometry = effectiveSpatialGeometry(field, [])
      expect(
        spatialSegmentShareInside({
          geometries: [geometry!],
          token: token(ids.targetToken, -5),
          from: walk[0]!,
          to: walk[1]!
        })
      ).toBeCloseTo(0.4)
      expect(
        spatialSegmentShareInside({
          geometries: [geometry!],
          token: token(ids.targetToken, -5),
          from: { x: -5, y: 10 },
          to: { x: 5, y: 10 }
        })
      ).toBe(0)
    })
  })

  it('uses the full occupied footprint for polygon CROSS and EXIT contacts', () => {
    const area = effect({
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: {
          kind: 'POLYGON',
          points: [
            { x: -1, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 }
          ]
        }
      }
    })
    const cross = collect({
      effects: [area],
      movementKind: 'FORCED',
      path: [
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ]
    })
    const exit = collect({
      effects: [area],
      movementKind: 'FORCED',
      path: [
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ]
    })

    expect(cross[0]).toMatchObject({ trigger: 'CROSS' })
    expect(cross[0]?.contact.x).toBeCloseTo(-2)
    expect(exit[0]).toMatchObject({ trigger: 'EXIT' })
    expect(exit[0]?.contact.x).toBeCloseTo(2)
  })

  it('uses endpoint-only teleport ENTER and EXIT and never creates an intermediate cross', () => {
    const cross = collect({
      movementKind: 'TELEPORT',
      path: [
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ]
    })
    const exit = collect({
      movementKind: 'TELEPORT',
      path: [
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ]
    })
    const enter = collect({
      movementKind: 'TELEPORT',
      path: [
        { x: -5, y: 0 },
        { x: 0, y: 0 }
      ]
    })

    expect(cross).toEqual([])
    expect(exit).toMatchObject([{ trigger: 'EXIT', pathDistance: 0 }])
    expect(enter).toMatchObject([{ trigger: 'ENTER', contact: { x: 0, y: 0 } }])
  })

  it('fails closed for a teleport with extra waypoints rather than deriving a noncanonical distance', () => {
    expect(
      collect({
        movementKind: 'TELEPORT',
        path: [
          { x: -5, y: 0 },
          { x: 99, y: 99 },
          { x: 0, y: 0 }
        ]
      })
    ).toEqual([])
  })

  it('evaluates a moving token aura against stationary targets', () => {
    const aura = effect({
      anchorKind: 'TOKEN',
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 }
      },
      sourceTokenId: ids.sourceToken
    })
    const candidates = collectSpatialMovementCandidates({
      actorIdByTokenId: new Map([
        [ids.sourceToken, ids.sourceActor],
        [ids.targetToken, ids.targetActor]
      ]),
      effects: [aura],
      movementKind: 'FORCED',
      movingTokenId: ids.sourceToken,
      path: [
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ],
      tokens: [token(ids.sourceToken, -5), token(ids.targetToken, 0)]
    })

    expect(candidates).toMatchObject([
      { sourceMoved: true, targetActorId: ids.targetActor, trigger: 'CROSS' }
    ])
    expect(candidates[0]?.contact.x).toBeCloseTo(-2)
    expect(candidates[0]?.contact.x).toBeCloseTo(-5 + (candidates[0]?.pathDistance ?? 0))
  })

  it('retains valid source-relative movement between opposite absolute scene bounds', () => {
    const maximum = VTT_SCENE_LIMITS.coordinateMagnitude
    const aura = effect({
      anchorKind: 'TOKEN',
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 }
      },
      sourceTokenId: ids.sourceToken
    })
    const candidates = collectSpatialMovementCandidates({
      actorIdByTokenId: new Map([
        [ids.sourceToken, ids.sourceActor],
        [ids.targetToken, ids.targetActor]
      ]),
      effects: [aura],
      movementKind: 'VOLUNTARY',
      movingTokenId: ids.sourceToken,
      path: [
        { x: -maximum, y: 0 },
        { x: maximum, y: 0 }
      ],
      tokens: [token(ids.sourceToken, -maximum), token(ids.targetToken, maximum)]
    })

    expect(candidates).toMatchObject([{ sourceMoved: true, trigger: 'ENTER' }])
    expect(candidates[0]?.contact.x).toBeCloseTo(maximum - 2)
    expect(Math.abs(candidates[0]?.contact.x ?? Infinity)).toBeLessThanOrEqual(maximum)
  })

  it('translates token-local geometry from its current source token and leaves fixed geometry absolute', () => {
    const local = effect({
      anchorKind: 'TOKEN',
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 1, y: 0 }, radius: 2 }
      },
      sourceTokenId: ids.sourceToken
    })
    const fixed = effect({ effectId: ids.effectTwo })
    const tokens = [token(ids.sourceToken, 10)]

    expect(effectiveSpatialGeometry(local, tokens)).toEqual({
      kind: 'CIRCLE',
      center: { x: 11, y: 0 },
      radius: 2
    })
    expect(effectiveSpatialGeometry(fixed, tokens)).toEqual({
      kind: 'CIRCLE',
      center: { x: 0, y: 0 },
      radius: 1
    })
  })

  it('fails closed for a missing source token and filters unsupported movement or trigger kinds', () => {
    const missingSource = effect({
      anchorKind: 'TOKEN',
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 }
      },
      sourceTokenId: ids.sourceToken
    })
    const filtered = effect({ movementKinds: ['VOLUNTARY'], triggerModes: ['EXIT'] })
    expect(
      collect({
        effects: [missingSource],
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 0, y: 0 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        effects: [filtered],
        movementKind: 'FORCED',
        path: [
          { x: 0, y: 0 },
          { x: 5, y: 0 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        effects: [filtered],
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ]
      })
    ).toEqual([])
  })

  it('orders equal-distance candidates by ordinal text, without locale collation', () => {
    const candidates = collect({
      effects: [effect({ effectId: ids.effectTwo }), effect()],
      movementKind: 'VOLUNTARY',
      path: [
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ]
    })
    expect(candidates.map((candidate) => candidate.effectId)).toEqual([ids.effect, ids.effectTwo])
  })

  it('reports no contact for a path that only touches the zone tangentially (user ruling 2026-10-14, D103)', () => {
    expect(
      collect({
        movementKind: 'VOLUNTARY',
        path: [
          { x: 0, y: 2 },
          { x: 5, y: 2 }
        ]
      })
    ).toEqual([])
  })

  it('reports no contact when a path slides along a polygon zone edge or grazes its corner', () => {
    const square = effect({
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: {
          kind: 'POLYGON',
          points: [
            { x: -1, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 }
          ]
        }
      }
    })
    expect(
      collect({
        effects: [square],
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 2 },
          { x: 5, y: 2 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        effects: [square],
        movementKind: 'VOLUNTARY',
        path: [
          { x: 3, y: 1 },
          { x: 1, y: 3 }
        ]
      })
    ).toEqual([])
  })

  it('reports a CROSS when a path clips the interior of a polygon zone corner', () => {
    const square = effect({
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: {
          kind: 'POLYGON',
          points: [
            { x: -1, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 }
          ]
        }
      }
    })
    expect(
      collect({
        effects: [square],
        movementKind: 'VOLUNTARY',
        path: [
          { x: 3, y: 0.5 },
          { x: 0.5, y: 3 }
        ]
      })
    ).toMatchObject([{ trigger: 'CROSS' }])
  })

  it('reports no contact for a teleport that lands touching a zone edge', () => {
    expect(
      collect({
        movementKind: 'TELEPORT',
        path: [
          { x: -5, y: 0 },
          { x: 2, y: 0 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        movementKind: 'TELEPORT',
        path: [
          { x: -5, y: 0 },
          { x: 1.5, y: 0 }
        ]
      })
    ).toMatchObject([{ trigger: 'ENTER' }])
  })

  it('fails closed before geometry for out-of-range scene coordinates or token dimensions', () => {
    expect(
      collect({
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: VTT_SCENE_LIMITS.coordinateMagnitude + 1, y: 0 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ],
        tokens: [
          {
            ...token(ids.targetToken, -5),
            width: VTT_SCENE_LIMITS.coordinateMagnitude + 1
          }
        ]
      })
    ).toEqual([])
  })

  it('fails closed for sub-minimum physical geometry or footprints', () => {
    const subMinimum = VTT_SPATIAL_LIMITS.minimumDistance / 2
    expect(
      collect({
        effects: [
          effect({
            geometry: {
              frame: 'SCENE_ABSOLUTE',
              shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: subMinimum }
            }
          })
        ],
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ],
        tokens: [{ ...token(ids.targetToken, -5), width: subMinimum }]
      })
    ).toEqual([])
  })
})

describe('spatialGeometryOverlapsTokenFootprint', () => {
  const circle = { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 } as const
  const square = {
    kind: 'POLYGON',
    points: [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 }
    ]
  } as const
  const touches = (
    geometry: Parameters<typeof spatialGeometryOverlapsTokenFootprint>[0]['geometry'],
    x: number,
    y = 0
  ) => spatialGeometryOverlapsTokenFootprint({ geometry, token: token(ids.targetToken, x, y) })

  it('does not catch a footprint that only touches a radius zone edge', () => {
    expect(touches(circle, 2)).toBe(false)
    expect(touches(circle, 0, 2)).toBe(false)
  })

  it('does not catch a footprint that only touches a polygon zone edge or corner', () => {
    expect(touches(square, 2)).toBe(false)
    expect(touches(square, 2, 2)).toBe(false)
  })

  it('catches a footprint that overlaps a zone by any positive area', () => {
    expect(touches(circle, 1.5)).toBe(true)
    expect(touches(square, 1.5)).toBe(true)
    expect(touches(square, 1.5, 1.5)).toBe(true)
    expect(touches(square, 0)).toBe(true)
  })

  describe('a concave L-shaped zone', () => {
    // Two arms along the x and y axes; the notch is x > 2 and y > 2, inside the convex hull only.
    const lShape = {
      kind: 'POLYGON',
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 6 },
        { x: 0, y: 6 }
      ]
    } as const

    it('does not catch a footprint in the notch, inside the hull but outside the polygon', () => {
      expect(touches(lShape, 3.5, 3.5)).toBe(false)
    })

    it('catches a footprint that overlaps an arm', () => {
      expect(touches(lShape, 5, 1)).toBe(true)
      expect(touches(lShape, 1, 5)).toBe(true)
      expect(touches(lShape, 1, 1)).toBe(true)
    })

    it('does not catch a footprint that only touches the inner corner and its edges', () => {
      expect(touches(lShape, 3, 3)).toBe(false)
    })

    it('catches a footprint that overlaps the notch and an arm', () => {
      expect(touches(lShape, 3, 2)).toBe(true)
    })
  })

  it('catches a footprint that fully contains a zone', () => {
    expect(
      spatialGeometryOverlapsTokenFootprint({
        geometry: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 0.25 },
        token: { ...token(ids.targetToken, 0), height: 4, width: 4 }
      })
    ).toBe(true)
  })
})

describe('token footprint path crossings', () => {
  it('uses both occupied footprints and excludes a destination that remains occupied', () => {
    const moving = token(ids.sourceToken, -5)
    const blocker = token(ids.targetToken, 0)

    expect(
      collectTokenFootprintPathCrossings({
        movingToken: moving,
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ],
        stationaryTokens: [blocker]
      })
    ).toMatchObject([
      {
        entry: { x: -2, y: 0 },
        entryPathDistance: 3,
        exit: { x: 2, y: 0 },
        exitPathDistance: 7,
        stationaryTokenId: ids.targetToken
      }
    ])

    expect(
      collectTokenFootprintPathCrossings({
        movingToken: moving,
        path: [
          { x: -5, y: 0 },
          { x: 0, y: 0 }
        ],
        stationaryTokens: [blocker]
      })
    ).toEqual([])
  })

  it('uses a large moving footprint across waypoint segments', () => {
    const moving = { ...token(ids.sourceToken, -5, -5), height: 4, width: 4 }
    const crossings = collectTokenFootprintPathCrossings({
      movingToken: moving,
      path: [
        { x: -5, y: -5 },
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ],
      stationaryTokens: [token(ids.targetToken, 0)]
    })

    expect(crossings[0]?.entry).toEqual({ x: -3, y: 0 })
    expect(crossings[0]?.entryPathDistance).toBeCloseTo(7)
    expect(crossings[0]?.exit).toEqual({ x: 3, y: 0 })
    expect(crossings[0]?.exitPathDistance).toBeCloseTo(13)
  })

  it.each([
    {
      expected: { entryDistance: 0, exitDistance: 200 },
      path: [
        { x: 450, y: 0 },
        { x: 650, y: 0 }
      ],
      title: 'crosses from the near footprint edge to the far footprint edge'
    },
    {
      expected: { entryDistance: 300, exitDistance: 500 },
      path: [
        { x: 150, y: 0 },
        { x: 650, y: 0 }
      ],
      title: 'reports a far-edge endpoint as the exit'
    },
    {
      expected: null,
      path: [
        { x: 150, y: 0 },
        { x: 450, y: 0 }
      ],
      title: 'does not report an approach ending at the near footprint edge'
    },
    {
      expected: null,
      path: [
        { x: -5, y: 2 },
        { x: 5, y: 2 }
      ],
      title: 'does not report an edge tangent'
    },
    {
      expected: null,
      path: [
        { x: -5, y: -1 },
        { x: -1, y: -5 }
      ],
      title: 'does not report a corner tangent'
    }
  ])('$title', ({ expected, path }) => {
    const crossings = collectTokenFootprintPathCrossings({
      movingToken: { ...token(ids.sourceToken, path[0]!.x, path[0]!.y), height: 100, width: 100 },
      path,
      stationaryTokens: [{ ...token(ids.targetToken, 550), height: 100, width: 100 }]
    })

    if (!expected) {
      expect(crossings).toEqual([])
      return
    }
    expect(crossings).toMatchObject([
      {
        entryPathDistance: expected.entryDistance,
        exitPathDistance: expected.exitDistance,
        stationaryTokenId: ids.targetToken
      }
    ])
  })

  it('orders simultaneous crossings by stationary token identity and fails closed on invalid input', () => {
    const moving = token(ids.sourceToken, -5)
    const lowerId = token(ids.effect, 0)
    const higherId = token(ids.effectTwo, 0)

    expect(
      collectTokenFootprintPathCrossings({
        movingToken: moving,
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ],
        stationaryTokens: [higherId, lowerId]
      }).map((crossing) => crossing.stationaryTokenId)
    ).toEqual([ids.effect, ids.effectTwo])

    expect(
      collectTokenFootprintPathCrossings({
        movingToken: moving,
        path: [
          { x: -4, y: 0 },
          { x: 5, y: 0 }
        ],
        stationaryTokens: [lowerId]
      })
    ).toEqual([])
  })
})

describe('sceneDistanceAsCoordinateLength', () => {
  it('turns a distance into coordinate length by cell on a square grid and by pixels per unit gridless', () => {
    expect(
      sceneDistanceAsCoordinateLength(
        {
          kind: 'SQUARE',
          cellSize: 100,
          diagonalPolicy: 'EQUAL',
          distancePerCell: 5,
          origin: { x: 0, y: 0 },
          unit: 'FEET'
        },
        20
      )
    ).toBe(400)
    expect(
      sceneDistanceAsCoordinateLength({ kind: 'GRIDLESS', pixelsPerUnit: 8, unit: 'FEET' }, 20)
    ).toBe(160)
  })
})

describe('pointAreaInSceneCoordinates', () => {
  const feetGrid: SceneGrid = {
    kind: 'SQUARE',
    cellSize: 100,
    diagonalPolicy: 'EQUAL',
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  }
  const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

  it('turns an authored radius and cube edge into Scene coordinates', () => {
    expect(pointAreaInSceneCoordinates({ kind: 'RADIUS', radius: feet(20) }, feetGrid)).toEqual({
      kind: 'RADIUS',
      radius: 400
    })
    expect(pointAreaInSceneCoordinates({ kind: 'CUBE', edgeLength: feet(15) }, feetGrid)).toEqual({
      kind: 'CUBE',
      edgeLength: 300
    })
  })

  it('converts the authored unit into the Scene unit', () => {
    const metersGrid: SceneGrid = { ...feetGrid, distancePerCell: 1.5, unit: 'METERS' }
    const area = pointAreaInSceneCoordinates({ kind: 'RADIUS', radius: feet(20) }, metersGrid)
    expect(area?.kind === 'RADIUS' && area.radius).toBeCloseTo(((20 * 0.3048) / 1.5) * 100)
  })

  it('has no area when the size is scaled or empty', () => {
    const scaled = {
      ...feet(20),
      scaling: { kind: 'BREAKPOINT', breakpoints: [] }
    }
    expect(pointAreaInSceneCoordinates({ kind: 'RADIUS', radius: scaled }, feetGrid)).toBeNull()
    expect(pointAreaInSceneCoordinates({ kind: 'RADIUS', radius: feet(0) }, feetGrid)).toBeNull()
  })

  it('reads a feet size as 5-foot squares on a SQUARES Scene', () => {
    expect(
      pointAreaInSceneCoordinates(
        { kind: 'CUBE', edgeLength: feet(15) },
        { ...feetGrid, distancePerCell: 1, unit: 'SQUARES' }
      )
    ).toEqual({ kind: 'CUBE', edgeLength: 300 })
  })
})

describe('spatialTokensInsideArea', () => {
  const near = token('00000000-0000-4000-8000-0000000000a1', 10)
  const edge = token('00000000-0000-4000-8000-0000000000a2', 21)
  const far = token('00000000-0000-4000-8000-0000000000a3', 40)

  it('catches every footprint sharing area with a radius area, sorted by id', () => {
    const inside = token('00000000-0000-4000-8000-0000000000a4', 20.5)
    expect(
      spatialTokensInsideArea({
        origin: { x: 0, y: 0 },
        shape: { kind: 'RADIUS', radius: 20 },
        tokens: [far, inside, near]
      })
    ).toEqual([near.id, inside.id])
  })

  // User ruling 2026-10-14, D103: touching the edge of an area never catches (SPELLS-7 caught it).
  it('does not catch a footprint that only touches the edge of a radius area', () => {
    expect(
      spatialTokensInsideArea({
        origin: { x: 0, y: 0 },
        shape: { kind: 'RADIUS', radius: 20 },
        tokens: [edge]
      })
    ).toEqual([])
  })

  it('centers a cube on the point', () => {
    expect(
      spatialTokensInsideArea({
        origin: { x: 0, y: 0 },
        shape: { kind: 'CUBE', edgeLength: 20 },
        tokens: [near, edge, far]
      })
    ).toEqual([near.id])
  })

  it('catches nothing for an invalid shape', () => {
    expect(
      spatialTokensInsideArea({
        origin: { x: 0, y: 0 },
        shape: { kind: 'RADIUS', radius: -1 },
        tokens: [near]
      })
    ).toEqual([])
  })
})

// SPELLS-22, D114: "within N feet of you" is measured from the edge of the caster's space, by the
// D103 rule: a footprint is caught when it shares positive area with the space grown by the radius.
describe('spatialTokensWithinSpaceRadius', () => {
  const casterId = '00000000-0000-4000-8000-0000000000c0'
  const at = (suffix: string, x: number, y = 0, size = 2): SpatialSceneToken => ({
    height: size,
    id: `00000000-0000-4000-8000-0000000000${suffix}`,
    position: { x, y },
    width: size
  })
  const caster = (size = 2): SpatialSceneToken => ({ ...at('c0', 0, 0, size), id: casterId })
  const within = (radius: number, tokens: SpatialSceneToken[], size = 2) =>
    spatialTokensWithinSpaceRadius({
      radius,
      tokens: [caster(size), ...tokens],
      casterTokenId: casterId
    })

  it('catches a footprint that reaches into the radius from the caster’s edge', () => {
    const inside = at('a1', 11.9)
    expect(within(10, [inside])).toEqual([inside.id])
  })

  it('does not catch a footprint that only touches the grown edge', () => {
    expect(within(10, [at('a1', 12)])).toEqual([])
  })

  it('rounds the grown corners instead of squaring them', () => {
    const diagonalInside = at('a1', 9, 9)
    const diagonalOutside = at('a2', 9.2, 9.2)
    expect(within(10, [diagonalInside, diagonalOutside])).toEqual([diagonalInside.id])
  })

  it('measures a Huge caster’s reach from its space edge', () => {
    const reached = at('a1', 13.9)
    expect(within(10, [reached], 6)).toEqual([reached.id])
    expect(within(10, [at('a2', 14)], 6)).toEqual([])
    expect(within(10, [reached])).toEqual([])
  })

  it('never catches the caster and sorts by token id', () => {
    const [a, b] = [at('b2', -5), at('b1', 5)]
    expect(within(10, [a, b])).toEqual([b.id, a.id])
  })

  it('catches nothing for an invalid radius', () => {
    expect(within(0, [at('a1', 2)])).toEqual([])
    expect(within(-1, [at('a1', 2)])).toEqual([])
  })

  it('needs the caster’s token', () => {
    expect(() =>
      spatialTokensWithinSpaceRadius({ radius: 10, tokens: [at('a1', 2)], casterTokenId: casterId })
    ).toThrow('caster')
  })
})

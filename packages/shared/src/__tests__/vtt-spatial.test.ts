import { describe, expect, it } from 'vitest'

import {
  pointAreaInSceneCoordinates,
  collectSpatialMovementCandidates,
  collectSpatialTurnCandidates,
  collectSpatialMeleeRetaliationCandidates,
  recordZoneApplications,
  zoneApplicationKey,
  collectTokenFootprintPathCrossings,
  effectiveSpatialGeometry,
  spatialGeometryOverlapsTokenFootprint,
  spatialSegmentShareInside,
  type SpatialEffectInstance,
  spatialTokensInsideArea,
  spatialTokensWithinSpaceRadius,
  type SpatialSceneToken,
  undirectedAreaGeometry,
  VTT_SPATIAL_LIMITS,
  wallAreaBoundsInSceneCoordinates,
  wallOutline,
  wallSideBandGeometry
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
    'actorIdByTokenId' | 'effects' | 'grid' | 'tokens' | 'movingTokenId' | 'turnSequence'
  > & {
    readonly grid?: SceneGrid
    readonly movingTokenId?: string
    readonly turnSequence?: number
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
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
    ...input,
    turnSequence: input.turnSequence ?? 1
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
          turnSequence: 1,
          grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
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

  describe('applications per turn', () => {
    const walk = [
      { x: -5, y: 0 },
      { x: 5, y: 0 }
    ]
    const key = zoneApplicationKey(ids.effect, ids.targetActor)

    it.each([
      ['has no limit', undefined, { turnSequence: 3, count: 9 }, 1],
      ['is spent this turn', 1, { turnSequence: 3, count: 1 }, 0],
      ['has one application left this turn', 2, { turnSequence: 3, count: 1 }, 1],
      ['was only spent on an earlier turn', 1, { turnSequence: 2, count: 1 }, 1]
    ])('an effect whose limit %s', (_name, maxApplicationsPerTurn, entry, caught) => {
      expect(
        collect({
          effects: [effect({ maxApplicationsPerTurn })],
          movementKind: 'VOLUNTARY',
          path: walk,
          turnSequence: 3,
          zoneApplications: { [key]: entry }
        })
      ).toHaveLength(caught)
    })

    it('catches a creature once per move by a zone that triggers on enter, exit and cross', () => {
      const through = collect({
        effects: [effect({ maxApplicationsPerTurn: 1 })],
        movementKind: 'VOLUNTARY',
        path: [walk[0]!, { x: 0, y: 0 }, walk[1]!]
      })
      expect(through).toHaveLength(1)
    })

    it('counts a creature against the zone it was caught by, not other creatures or zones', () => {
      const spent = { turnSequence: 3, count: 1 }
      for (const stale of [
        zoneApplicationKey(ids.effect, ids.sourceActor),
        zoneApplicationKey(ids.sourceActor, ids.targetActor)
      ])
        expect(
          collect({
            effects: [effect({ maxApplicationsPerTurn: 1 })],
            movementKind: 'VOLUNTARY',
            path: walk,
            turnSequence: 3,
            zoneApplications: { [stale]: spent }
          })
        ).toHaveLength(1)
    })

    it('records each settled trigger against the current turn and drops entries from earlier turns', () => {
      const earlier = { turnSequence: 2, count: 4 }
      const other = zoneApplicationKey(ids.effect, ids.sourceActor)
      expect(recordZoneApplications({ [other]: earlier }, 3, [])).toEqual({ [other]: earlier })
      const recorded = recordZoneApplications(
        { [other]: earlier, [key]: { turnSequence: 3, count: 1 } },
        3,
        [
          { effectId: ids.effect, targetActorId: ids.targetActor },
          { effectId: ids.effect, targetActorId: ids.sourceActor }
        ]
      )
      expect(recorded).toEqual({
        [key]: { turnSequence: 3, count: 2 },
        [other]: { turnSequence: 3, count: 1 }
      })
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
      turnSequence: 1,
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
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
      turnSequence: 1,
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
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

  it('reports how the mover meets a zone whatever the zone subscribes to', () => {
    const exitOnly = effect({ triggerModes: ['EXIT'] })
    expect(
      collect({
        effects: [exitOnly],
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ]
      }).map((candidate) => candidate.trigger)
    ).toEqual(['CROSS'])
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

describe('spatial turn candidates', () => {
  const key = zoneApplicationKey(ids.effect, ids.targetActor)
  const collectTurn = (
    input: Partial<Parameters<typeof collectSpatialTurnCandidates>[0]> & {
      readonly targetAt?: number
    } = {}
  ) =>
    collectSpatialTurnCandidates({
      actorIdByTokenId: new Map([
        [ids.sourceToken, ids.sourceActor],
        [ids.targetToken, ids.targetActor]
      ]),
      effects: [effect({ turnTriggers: ['START_OF_TURN', 'END_OF_TURN'] })],
      targetTokenId: ids.targetToken,
      tokens: [token(ids.targetToken, input.targetAt ?? 0)],
      trigger: 'START_OF_TURN',
      turnSequence: 1,
      ...input
    })

  it('catches a creature inside the area at a trigger the effect has, with the effect facts', () => {
    expect(collectTurn()).toEqual([
      {
        effectId: ids.effect,
        sourceActorId: ids.sourceActor,
        targetActorId: ids.targetActor,
        trigger: 'START_OF_TURN'
      }
    ])
    expect(collectTurn({ trigger: 'END_OF_TURN' })).toHaveLength(1)
  })

  it.each([
    ['outside the area', { targetAt: 10 }],
    [
      'a creature the effect never catches',
      {
        effects: [
          effect({ turnTriggers: ['START_OF_TURN'], unaffectedActorIds: [ids.targetActor] })
        ]
      }
    ],
    [
      'an effect whose per-turn limit is spent',
      {
        effects: [effect({ turnTriggers: ['START_OF_TURN'], maxApplicationsPerTurn: 1 })],
        zoneApplications: { [key]: { turnSequence: 1, count: 1 } }
      }
    ]
  ])('catches nothing: %s', (_name, input) => {
    expect(collectTurn(input)).toEqual([])
  })

  it('reports a creature in a zone at any boundary, whatever the zone subscribes to', () => {
    expect(collectTurn({ effects: [effect()], trigger: 'END_OF_TURN' })).toEqual([
      {
        effectId: ids.effect,
        sourceActorId: ids.sourceActor,
        targetActorId: ids.targetActor,
        trigger: 'END_OF_TURN'
      }
    ])
  })

  describe('an effect that catches only a creature fully within it (SPELLS-20 T4b3a)', () => {
    const square = (offset: number) => ({
      frame: 'SCENE_ABSOLUTE' as const,
      shape: {
        kind: 'POLYGON' as const,
        points: [
          { x: -1 + offset, y: -1 },
          { x: 1 + offset, y: -1 },
          { x: 1 + offset, y: 1 },
          { x: -1 + offset, y: 1 }
        ]
      }
    })
    const circle = (radius: number) => ({
      frame: 'SCENE_ABSOLUTE' as const,
      shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius }
    })
    const fullyWithin = (geometry: SpatialEffectInstance['geometry']) =>
      collectTurn({
        effects: [effect({ geometry, turnTriggers: ['START_OF_TURN'], requiresFullyWithin: true })]
      })

    it.each([
      ['a circle that holds every corner of its space', circle(1.5), 1],
      ['a circle it pokes out of at the corners', circle(1.4), 0],
      ['a polygon whose edges are its space’s edges', square(0), 1],
      ['a polygon it is half out of', square(1), 0]
    ])('%s', (_name, geometry, caught) => {
      expect(fullyWithin(geometry)).toHaveLength(caught)
    })

    it('still catches a creature half out of an effect that needs only overlap', () => {
      expect(
        collectTurn({ effects: [effect({ geometry: square(1), turnTriggers: ['START_OF_TURN'] })] })
      ).toHaveLength(1)
    })
  })

  it('counts a limit spent on an earlier turn as unspent', () => {
    expect(
      collectTurn({
        effects: [effect({ turnTriggers: ['START_OF_TURN'], maxApplicationsPerTurn: 1 })],
        zoneApplications: { [key]: { turnSequence: 0, count: 1 } }
      })
    ).toHaveLength(1)
  })

  it('follows a token-anchored effect to its source token and orders effects by id', () => {
    const anchored = effect({
      anchorKind: 'TOKEN',
      effectId: ids.effectTwo,
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 3 }
      },
      sourceTokenId: ids.sourceToken,
      turnTriggers: ['START_OF_TURN']
    })
    const tokens = [token(ids.targetToken, 0), token(ids.sourceToken, 2)]
    const found = collectTurn({
      effects: [anchored, effect({ turnTriggers: ['START_OF_TURN'] })],
      tokens
    })
    expect(found.map((candidate) => candidate.effectId)).toEqual([ids.effect, ids.effectTwo])
    expect(
      collectTurn({
        effects: [anchored],
        tokens: [token(ids.targetToken, 0), token(ids.sourceToken, 20)]
      })
    ).toEqual([])
  })
})

describe('ring geometry (SPELLS-4.T1b, D154)', () => {
  const ring = (innerRadius = 9) =>
    ({ kind: 'RING', center: { x: 0, y: 0 }, outerRadius: 10, innerRadius }) as const
  const inRing = (x: number) =>
    spatialGeometryOverlapsTokenFootprint({ geometry: ring(), token: token(ids.targetToken, x) })

  it('catches a footprint that overlaps the band, even one reaching into the hollow', () => {
    expect(inRing(9.5)).toBe(true)
    expect(inRing(8)).toBe(true)
  })

  it('does not catch a footprint wholly inside the hollow, or one only touching the outer edge', () => {
    expect(inRing(0)).toBe(false)
    expect(inRing(7.9)).toBe(false)
    expect(inRing(11)).toBe(false)
  })

  it('raises a crossing where the mover leaves the hollow and the share of a walk in the band', () => {
    const geometry = { frame: 'SCENE_ABSOLUTE' as const, shape: ring() }
    const [cross] = collect({
      effects: [effect({ geometry })],
      movementKind: 'VOLUNTARY',
      path: [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ]
    })
    expect(cross).toMatchObject({ trigger: 'CROSS' })
    expect(cross?.contact.x).toBeCloseTo(Math.sqrt(80) - 1)
    expect(
      spatialSegmentShareInside({
        geometries: [ring()],
        token: token(ids.targetToken, -20),
        from: { x: -20, y: 0 },
        to: { x: 20, y: 0 }
      })
    ).toBeCloseTo((2 * (11 - (Math.sqrt(80) - 1))) / 40)
  })

  it('holds a creature fully within the band only when it shares no area with the hollow', () => {
    const fullyWithin = (x: number) =>
      collectSpatialTurnCandidates({
        actorIdByTokenId: new Map([[ids.targetToken, ids.targetActor]]),
        effects: [
          effect({
            geometry: { frame: 'SCENE_ABSOLUTE', shape: ring(7) },
            turnTriggers: ['START_OF_TURN'],
            requiresFullyWithin: true
          })
        ],
        targetTokenId: ids.targetToken,
        tokens: [token(ids.targetToken, x)],
        trigger: 'START_OF_TURN',
        turnSequence: 1
      })
    expect(fullyWithin(8.5)).toHaveLength(1)
    expect(fullyWithin(8)).toHaveLength(1)
    expect(fullyWithin(7.5)).toHaveLength(0)
  })

  it('refuses a ring whose hollow is not inside its outer circle', () => {
    expect(
      spatialGeometryOverlapsTokenFootprint({
        geometry: ring(10),
        token: token(ids.targetToken, 9.5)
      })
    ).toBe(false)
  })
})

describe('wall geometry (SPELLS-4.T1b, D154)', () => {
  const feetGrid: SceneGrid = {
    kind: 'SQUARE',
    cellSize: 100,
    diagonalPolicy: 'EQUAL',
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  }
  const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

  it('outlines a straight wall as a rectangle its thickness wide, centered on the segment', () => {
    expect(wallOutline({ x: 0, y: 0 }, { x: 0, y: 100 }, 20)).toEqual([
      { x: -10, y: 0 },
      { x: -10, y: 100 },
      { x: 10, y: 100 },
      { x: 10, y: 0 }
    ])
    expect(wallOutline({ x: 5, y: 5 }, { x: 5, y: 5 }, 20)).toBeNull()
  })

  it('places a wall or a ring from the area origin', () => {
    expect(
      undirectedAreaGeometry({ x: 0, y: 0 }, { kind: 'WALL', to: { x: 100, y: 0 }, thickness: 10 })
    ).toEqual({
      kind: 'POLYGON',
      points: [
        { x: 0, y: 5 },
        { x: 100, y: 5 },
        { x: 100, y: -5 },
        { x: 0, y: -5 }
      ]
    })
    expect(
      undirectedAreaGeometry({ x: 50, y: 50 }, { kind: 'RING', outerRadius: 200, innerRadius: 180 })
    ).toEqual({ kind: 'RING', center: { x: 50, y: 50 }, outerRadius: 200, innerRadius: 180 })
  })

  it('catches a token the wall crosses, not one beside it', () => {
    const geometry = undirectedAreaGeometry(
      { x: 0, y: 0 },
      { kind: 'WALL', to: { x: 100, y: 0 }, thickness: 1 }
    )
    if (!geometry) throw new Error('The wall must have an outline.')
    expect(
      spatialGeometryOverlapsTokenFootprint({ geometry, token: token(ids.targetToken, 50) })
    ).toBe(true)
    expect(
      spatialGeometryOverlapsTokenFootprint({ geometry, token: token(ids.targetToken, 200) })
    ).toBe(false)
  })

  it('turns an authored wall or ring into its Scene bounds', () => {
    expect(
      wallAreaBoundsInSceneCoordinates(
        { kind: 'WALL', maxLength: feet(60), thickness: feet(1) },
        feetGrid
      )
    ).toEqual({ maximum: 1200, thickness: 20 })
    expect(
      wallAreaBoundsInSceneCoordinates(
        { kind: 'RING', maxOuterRadius: feet(10), thickness: feet(5) },
        feetGrid
      )
    ).toEqual({ maximum: 200, thickness: 100 })
    expect(
      wallAreaBoundsInSceneCoordinates(
        { kind: 'RING', maxOuterRadius: feet(10), thickness: feet(0) },
        feetGrid
      )
    ).toBeNull()
  })

  describe('the band a zone reaches beside its wall (D154 amendment)', () => {
    const wall = { kind: 'WALL', to: { x: 0, y: 100 }, thickness: 20 } as const
    const ring = { kind: 'RING', outerRadius: 200, innerRadius: 180 } as const
    const center = { x: 50, y: 50 }

    it('widens a straight wall by the distance on the side of travel picked', () => {
      // Travelling down the Scene (y grows downward), the right is toward smaller x.
      expect(wallSideBandGeometry({ x: 0, y: 0 }, wall, 'RIGHT', 200)).toEqual({
        kind: 'POLYGON',
        points: [
          { x: -210, y: 0 },
          { x: -210, y: 100 },
          { x: 10, y: 100 },
          { x: 10, y: 0 }
        ]
      })
      expect(wallSideBandGeometry({ x: 0, y: 0 }, wall, 'LEFT', 200)).toEqual({
        kind: 'POLYGON',
        points: [
          { x: -10, y: 0 },
          { x: -10, y: 100 },
          { x: 210, y: 100 },
          { x: 210, y: 0 }
        ]
      })
    })

    it('widens a ring outward, or inward until it fills to the center', () => {
      expect(wallSideBandGeometry(center, ring, 'OUTSIDE', 200)).toEqual({
        kind: 'RING',
        center,
        outerRadius: 400,
        innerRadius: 180
      })
      expect(wallSideBandGeometry(center, ring, 'INSIDE', 100)).toEqual({
        kind: 'RING',
        center,
        outerRadius: 200,
        innerRadius: 80
      })
      expect(wallSideBandGeometry(center, ring, 'INSIDE', 200)).toEqual({
        kind: 'CIRCLE',
        center,
        radius: 200
      })
    })

    it('has no band on a side the wall does not have, or beside a wall of no length', () => {
      expect(wallSideBandGeometry(center, ring, 'LEFT', 200)).toBeNull()
      expect(wallSideBandGeometry({ x: 0, y: 0 }, wall, 'OUTSIDE', 200)).toBeNull()
      expect(
        wallSideBandGeometry({ x: 0, y: 100 }, { ...wall, to: { x: 0, y: 100 } }, 'LEFT', 200)
      ).toBeNull()
    })

    it('catches a token on the side picked and spares one on the other', () => {
      const band = wallSideBandGeometry(
        { x: 0, y: 0 },
        { ...wall, to: { x: 0, y: 400 } },
        'RIGHT',
        200
      )
      if (!band) throw new Error('The band must have an outline.')
      expect(
        spatialGeometryOverlapsTokenFootprint({
          geometry: band,
          token: token(ids.targetToken, -150, 200)
        })
      ).toBe(true)
      expect(
        spatialGeometryOverlapsTokenFootprint({
          geometry: band,
          token: token(ids.targetToken, 150, 200)
        })
      ).toBe(false)
    })
  })
})

describe('spatial melee retaliation candidates (D153)', () => {
  const sourceZone = (overrides: Partial<SpatialEffectInstance> = {}) =>
    effect({
      anchorKind: 'TOKEN',
      sourceTokenId: ids.sourceToken,
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 3 }
      },
      triggerModes: [],
      retaliatesMeleeHits: true,
      ...overrides
    })
  const collect = (
    input: Partial<Parameters<typeof collectSpatialMeleeRetaliationCandidates>[0]> & {
      readonly attackerAt?: number
    } = {}
  ) =>
    collectSpatialMeleeRetaliationCandidates({
      actorIdByTokenId: new Map([
        [ids.sourceToken, ids.sourceActor],
        [ids.targetToken, ids.targetActor]
      ]),
      effects: [sourceZone()],
      attackerTokenId: ids.targetToken,
      hitTokenId: ids.sourceToken,
      tokens: [token(ids.sourceToken, 0), token(ids.targetToken, input.attackerAt ?? 3)],
      ...input
    })

  it('catches the attacker inside the hit creature’s retaliating zone, the zone’s source its source', () => {
    expect(collect()).toEqual([
      { effectId: ids.effect, sourceActorId: ids.sourceActor, targetActorId: ids.targetActor }
    ])
  })

  it.each([
    ['an attacker outside the zone', { attackerAt: 10 }],
    ['a zone that does not retaliate', { effects: [sourceZone({ retaliatesMeleeHits: false })] }],
    [
      'a zone anchored to another token',
      { effects: [sourceZone({ sourceTokenId: ids.targetToken, sourceActorId: ids.targetActor })] }
    ],
    ['a suppressed zone', { effects: [sourceZone({ suppressed: true })] }],
    [
      'an attacker the zone never catches',
      { effects: [sourceZone({ unaffectedActorIds: [ids.targetActor] })] }
    ],
    ['an attacker hitting itself', { hitTokenId: ids.targetToken }]
  ])('catches no one for %s', (_name, input) => {
    expect(collect(input)).toEqual([])
  })

  it('reports the attacker in a zone on the hit creature whatever the zone subscribes to', () => {
    expect(
      collect({
        effects: [sourceZone({ retaliatesMeleeHits: undefined, triggerModes: ['ENTER'] })]
      })
    ).toEqual([
      { effectId: ids.effect, sourceActorId: ids.sourceActor, targetActorId: ids.targetActor }
    ])
  })
})

describe('spatial candidates per distance moved (SPELLS-4.T1h, D156)', () => {
  const field = effect({
    distanceStep: 5,
    geometry: {
      frame: 'SCENE_ABSOLUTE',
      shape: {
        kind: 'POLYGON',
        points: [
          { x: 0, y: -30 },
          { x: 30, y: -30 },
          { x: 30, y: 30 },
          { x: 0, y: 30 }
        ]
      }
    },
    triggerModes: ['ENTER', 'CROSS']
  })
  const walk = (to: number, from = 10) => [
    { x: from, y: 0 },
    { x: to, y: 0 }
  ]
  const steps = (candidates: ReturnType<typeof collect>) =>
    candidates.map((candidate) => ({ step: candidate.step, x: candidate.contact.x }))

  it('raises one ENTER candidate per whole step the footprint travels inside, where it completes', () => {
    // The 2-wide footprint first overlaps at x = -1, so the walk to 11 travels 12 inside.
    const entering = collect({ effects: [field], movementKind: 'VOLUNTARY', path: walk(11, -10) })

    expect(entering.map((candidate) => candidate.trigger)).toEqual(['ENTER', 'ENTER'])
    expect(steps(entering)).toEqual([
      { step: 1, x: expect.closeTo(4) },
      { step: 2, x: expect.closeTo(9) }
    ])
  })

  it('counts a move that starts inside, and forced movement alike', () => {
    for (const movementKind of ['VOLUNTARY', 'FORCED'] as const)
      expect(steps(collect({ effects: [field], movementKind, path: walk(25) }))).toEqual([
        { step: 1, x: expect.closeTo(15) },
        { step: 2, x: expect.closeTo(20) },
        { step: 3, x: expect.closeTo(25) }
      ])
  })

  it('floors a partial step, completing one short of it by at most a tenth of a step', () => {
    const near = collect({ effects: [field], movementKind: 'VOLUNTARY', path: walk(24.6) })
    const short = collect({ effects: [field], movementKind: 'VOLUNTARY', path: walk(24.4) })

    expect(steps(near)).toEqual([
      { step: 1, x: expect.closeTo(15) },
      { step: 2, x: expect.closeTo(20) },
      { step: 3, x: expect.closeTo(24.6) }
    ])
    expect(short.map((candidate) => candidate.step)).toEqual([1, 2])
  })

  it('measures steps by the Scene grid, as movement cost does', () => {
    const equalDiagonals: SceneGrid = {
      kind: 'SQUARE',
      cellSize: 1,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 1,
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    }
    const diagonal = collect({
      effects: [field],
      grid: equalDiagonals,
      movementKind: 'VOLUNTARY',
      path: [
        { x: 10, y: 0 },
        { x: 25, y: 15 }
      ]
    })

    // 15 diagonal squares cost 15 under equal diagonals, though they span 21.2 in the plane.
    expect(diagonal.map((candidate) => candidate.step)).toEqual([1, 2, 3])
  })

  it('keeps each step apart from the once-per-movement contact of another zone', () => {
    const once = effect({ effectId: ids.effectTwo, triggerModes: ['ENTER', 'CROSS'] })
    const candidates = collect({
      effects: [field, once],
      movementKind: 'VOLUNTARY',
      path: walk(15, -10)
    })

    expect(
      candidates.map((candidate) => [candidate.effectId, candidate.trigger, candidate.step])
    ).toEqual([
      [ids.effectTwo, 'CROSS', undefined],
      [ids.effect, 'ENTER', 1],
      [ids.effect, 'ENTER', 2],
      [ids.effect, 'ENTER', 3]
    ])
  })

  it('counts the distance a moving source zone sweeps over a still creature', () => {
    const aura = effect({
      anchorKind: 'TOKEN',
      distanceStep: 5,
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: {
          kind: 'POLYGON',
          points: [
            { x: -10, y: -10 },
            { x: 10, y: -10 },
            { x: 10, y: 10 },
            { x: -10, y: 10 }
          ]
        }
      },
      sourceTokenId: ids.sourceToken,
      triggerModes: ['ENTER']
    })
    const swept = collect({
      effects: [aura],
      movingTokenId: ids.sourceToken,
      movementKind: 'VOLUNTARY',
      path: walk(19, 0),
      tokens: [token(ids.sourceToken, 0, 0), token(ids.targetToken, 20, 0)]
    })

    // The target's footprint is inside once the source is within 11 of it: 10 of the 19 moved.
    expect(swept).toMatchObject([
      { sourceMoved: true, step: 1, targetActorId: ids.targetActor },
      { sourceMoved: true, step: 2, targetActorId: ids.targetActor }
    ])
    expect(swept.map((candidate) => candidate.contact.x)).toEqual([
      expect.closeTo(14),
      expect.closeTo(19)
    ])
  })
})

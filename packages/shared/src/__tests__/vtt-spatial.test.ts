import { describe, expect, it } from 'vitest'

import {
  collectSpatialMovementCandidates,
  collectTokenFootprintPathCrossings,
  effectiveSpatialGeometry,
  type SpatialEffectInstance,
  type SpatialSceneToken,
  VTT_SPATIAL_LIMITS
} from '../domains/vtt/spatial.js'
import { VTT_SCENE_LIMITS } from '../domains/vtt/scene.js'

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

  it('reports the last inclusive tangential full-footprint boundary as the exit contact', () => {
    const candidates = collect({
      movementKind: 'VOLUNTARY',
      path: [
        { x: 0, y: 2 },
        { x: 5, y: 2 }
      ]
    })
    expect(candidates).toMatchObject([{ trigger: 'EXIT' }])
    expect(candidates[0]?.contact).toEqual({ x: 1, y: 2 })
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

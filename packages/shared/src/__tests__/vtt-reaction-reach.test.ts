import { describe, expect, it } from 'vitest'

import {
  collectReactionReachCandidates,
  type ReactionReachSource
} from '../domains/vtt/reactionReach.js'
import type { SceneGrid, ScenePoint, SceneToken } from '../domains/vtt/scene.js'

const ids = {
  moverActor: 'actor-mover',
  moverToken: 'token-mover',
  reactorActor: 'actor-reactor',
  reactorToken: 'token-reactor',
  reactorTwoActor: 'actor-reactor-two',
  reactorTwoToken: 'token-reactor-two'
} as const

const gridless: SceneGrid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
const square = (diagonalPolicy: 'ALTERNATING' | 'EQUAL' | 'EUCLIDEAN'): SceneGrid => ({
  cellSize: 10,
  diagonalPolicy,
  distancePerCell: 5,
  kind: 'SQUARE',
  origin: { x: 0, y: 0 },
  unit: 'FEET'
})

function token(
  id: string,
  position: ScenePoint,
  width = 2,
  height = 2
): Pick<SceneToken, 'height' | 'id' | 'position' | 'width'> {
  return { height, id, position, width }
}

function source(overrides: Partial<ReactionReachSource> = {}): ReactionReachSource {
  return {
    reach: 1,
    reactorTokenId: ids.reactorToken,
    sourceId: 'source-one',
    stage: 'ENTER_REACH',
    ...overrides
  }
}

function collect(input: {
  readonly actorIdByTokenId?: ReadonlyMap<string, string>
  readonly grid?: SceneGrid
  readonly movementKind?: 'FORCED' | 'TELEPORT' | 'VOLUNTARY'
  readonly path: readonly ScenePoint[]
  readonly sources?: readonly ReactionReachSource[]
  readonly tokens?: readonly Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>[]
}) {
  return collectReactionReachCandidates({
    actorIdByTokenId:
      input.actorIdByTokenId ??
      new Map([
        [ids.moverToken, ids.moverActor],
        [ids.reactorToken, ids.reactorActor],
        [ids.reactorTwoToken, ids.reactorTwoActor]
      ]),
    grid: input.grid ?? gridless,
    movementKind: input.movementKind ?? 'VOLUNTARY',
    movingTokenId: ids.moverToken,
    path: input.path,
    sources: input.sources ?? [source()],
    tokens: input.tokens ?? [
      token(ids.moverToken, input.path[0]!),
      token(ids.reactorToken, { x: 0, y: 0 })
    ]
  })
}

describe('reaction reach contact collection', () => {
  it('uses exact GRIDLESS rounded-rectangle contacts for enter, leave, and an outside-to-outside crossing', () => {
    const candidates = collect({
      path: [
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ],
      sources: [source(), source({ sourceId: 'source-leave', stage: 'BEFORE_LEAVE_REACH' })]
    })

    expect(candidates).toMatchObject([
      { sourceId: 'source-one', stage: 'ENTER_REACH' },
      { sourceId: 'source-leave', stage: 'BEFORE_LEAVE_REACH' }
    ])
    expect(candidates[0]?.contact).toEqual({ x: -3, y: 0 })
    expect(candidates[0]?.pathDistance).toBe(2)
    expect(candidates[1]?.contact).toEqual({ x: 3, y: 0 })
    expect(candidates[1]?.pathDistance).toBe(8)
  })

  it('treats the exact full-footprint boundary as inside and ignores an outside tangency', () => {
    const boundaryExit = collect({
      path: [
        { x: 3, y: 0 },
        { x: 5, y: 0 }
      ],
      sources: [source({ stage: 'BEFORE_LEAVE_REACH' })]
    })
    const tangent = collect({
      path: [
        { x: -4 - Math.sqrt(2), y: 0 },
        { x: 0, y: -4 - Math.sqrt(2) }
      ]
    })

    expect(boundaryExit).toMatchObject([{ contact: { x: 3, y: 0 }, pathDistance: 0 }])
    expect(tangent).toEqual([])
  })

  it('uses full large rectangular footprints rather than token centers', () => {
    const candidates = collect({
      path: [
        { x: -10, y: 0 },
        { x: 10, y: 0 }
      ],
      tokens: [
        token(ids.moverToken, { x: -10, y: 0 }, 6, 2),
        token(ids.reactorToken, { x: 0, y: 0 }, 4, 8)
      ]
    })

    expect(candidates).toMatchObject([{ contact: { x: -6, y: 0 }, pathDistance: 4 }])
  })

  it.each([
    { diagonalPolicy: 'EQUAL' as const, expected: { x: -47, y: -42.3 } },
    { diagonalPolicy: 'ALTERNATING' as const, expected: { x: -37, y: -33.3 } },
    { diagonalPolicy: 'EUCLIDEAN' as const, expected: { x: -30, y: -27 } }
  ])(
    'uses exact $diagonalPolicy square-grid reach transition points while preserving geometric path ordering',
    ({ diagonalPolicy, expected }) => {
      const candidates = collect({
        grid: square(diagonalPolicy),
        path: [
          { x: -60, y: -54 },
          { x: 0, y: 0 }
        ],
        sources: [source({ reach: 20 })]
      })

      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.stage).toBe('ENTER_REACH')
      expect(candidates[0]?.contact.x).toBeCloseTo(expected.x)
      expect(candidates[0]?.contact.y).toBeCloseTo(expected.y)
      expect(candidates[0]?.pathDistance).toBeCloseTo(Math.hypot(expected.x + 60, expected.y + 54))
    }
  )

  it('does not duplicate a contact at a shared waypoint and treats forced movement identically', () => {
    const path = [
      { x: -5, y: 0 },
      { x: -3, y: 0 },
      { x: 0, y: 0 }
    ] as const
    const voluntary = collect({ path })
    const forced = collect({ movementKind: 'FORCED', path })

    expect(voluntary).toEqual(forced)
    expect(voluntary).toMatchObject([{ contact: { x: -3, y: 0 }, pathDistance: 2 }])
  })

  it('uses endpoint-only teleport reach transitions without inspecting its interior', () => {
    const cross = collect({
      movementKind: 'TELEPORT',
      path: [
        { x: -5, y: 0 },
        { x: 5, y: 0 }
      ],
      sources: [source(), source({ sourceId: 'leave', stage: 'BEFORE_LEAVE_REACH' })]
    })
    const enter = collect({
      movementKind: 'TELEPORT',
      path: [
        { x: -5, y: 0 },
        { x: 0, y: 0 }
      ]
    })
    const exit = collect({
      movementKind: 'TELEPORT',
      path: [
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ],
      sources: [source({ stage: 'BEFORE_LEAVE_REACH' })]
    })

    expect(cross).toEqual([])
    expect(enter).toMatchObject([{ contact: { x: 0, y: 0 }, pathDistance: 5 }])
    expect(exit).toMatchObject([{ contact: { x: 0, y: 0 }, pathDistance: 0 }])
  })

  it('sorts same-distance sources deterministically without coalescing them', () => {
    const candidates = collect({
      path: [
        { x: -5, y: 0 },
        { x: 0, y: 0 }
      ],
      sources: [
        source({ sourceId: 'b', stage: 'BEFORE_LEAVE_REACH' }),
        source({ sourceId: 'a' }),
        source({ sourceId: 'b-enter' })
      ]
    })

    expect(candidates.map((candidate) => candidate.sourceId)).toEqual(['a', 'b-enter'])
  })

  it('fails closed for invalid source/token/path input', () => {
    const path = [
      { x: -5, y: 0 },
      { x: 0, y: 0 }
    ] as const
    expect(collect({ path, sources: [source(), source()] })).toEqual([])
    expect(collect({ path, sources: [source({ reactorTokenId: ids.moverToken })] })).toEqual([])
    expect(collect({ path, sources: [source({ reactorTokenId: 'missing-reactor' })] })).toEqual([])
    expect(collect({ path, sources: [source({ reach: Number.NaN })] })).toEqual([])
    expect(
      collect({
        path,
        tokens: [token(ids.moverToken, { x: -4, y: 0 }), token(ids.reactorToken, { x: 0, y: 0 })]
      })
    ).toEqual([])
    expect(
      collect({
        path,
        actorIdByTokenId: new Map([
          [ids.moverToken, ''],
          [ids.reactorToken, ids.reactorActor]
        ]),
        tokens: [token(ids.moverToken, path[0]!), token(ids.reactorToken, { x: 0, y: 0 })]
      })
    ).toEqual([])
    expect(
      collect({
        path,
        movementKind: 'TELEPORT',
        sources: [source()],
        tokens: [token(ids.moverToken, path[0]!), token(ids.reactorToken, { x: 0, y: 0 })]
      })
    ).toHaveLength(1)
    expect(
      collect({
        movementKind: 'TELEPORT',
        path: [path[0]!, { x: -2, y: 0 }, path[1]!]
      })
    ).toEqual([])
    expect(
      collect({
        path,
        tokens: [token(ids.moverToken, path[0]!), token(ids.reactorToken, { x: 0, y: 0 }, 0)]
      })
    ).toEqual([])
  })

  it('accepts an exact authoritative path origin and rejects malformed grid or movement kinds', () => {
    const path = [
      { x: -5, y: 0 },
      { x: 0, y: 0 }
    ] as const
    expect(collect({ path })).toHaveLength(1)
    expect(
      collect({
        grid: { kind: 'HEX', unit: 'FEET' } as unknown as SceneGrid,
        path
      })
    ).toEqual([])
    expect(
      collect({
        grid: { ...square('EQUAL'), diagonalPolicy: 'INVALID' } as unknown as SceneGrid,
        path
      })
    ).toEqual([])
    expect(collect({ movementKind: 'INVALID' as unknown as 'VOLUNTARY', path })).toEqual([])
  })

  it('keeps exact square threshold enumeration at the Scene bound and fails closed over it', () => {
    const unitSquare: SceneGrid = {
      cellSize: 1,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 1,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    }
    const atCap = collect({
      grid: unitSquare,
      path: [
        { x: -258, y: 0 },
        { x: 0, y: 0 }
      ],
      sources: [source({ reach: 255 })]
    })
    const overCap = collect({
      grid: unitSquare,
      path: [
        { x: -260, y: 0 },
        { x: 0, y: 0 }
      ],
      sources: [source({ reach: 256 })]
    })

    expect(atCap).toMatchObject([{ contact: { x: -257.5, y: 0 }, pathDistance: 0.5 }])
    expect(overCap).toEqual([])
  })
})

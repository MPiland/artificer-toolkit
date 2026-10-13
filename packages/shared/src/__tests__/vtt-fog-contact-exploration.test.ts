import { describe, expect, it } from 'vitest'

import {
  collectTokenFootprintPathCrossings,
  deriveSceneCommandFogLayer,
  isScenePointExplored,
  planSceneCommandExploration,
  type SceneExplorationState,
  type SceneFogLayer,
  type ScenePoint,
  type SceneToken
} from '../domains/vtt/index.js'

const ids = {
  blocker: '00000000-0000-4000-8000-000000000001',
  hero: '00000000-0000-4000-8000-000000000002',
  map: '00000000-0000-4000-8000-000000000003',
  player: '00000000-0000-4000-8000-000000000004'
} as const

function token(input: Pick<SceneToken, 'id' | 'position'> & Partial<SceneToken>): SceneToken {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: 50,
    hidden: false,
    label: 'Token',
    locked: false,
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 50,
    ...input
  }
}

const start = { x: 25, y: 50 }
const end = { x: 975, y: 50 }

/**
 * A 1000 x 100 map (10 px per foot) with a 5 ft sighted hero at the west edge and a hostile-sized
 * blocker at x = 500 on the hero's eastward path.
 */
function scene(
  fogMode: SceneExplorationState['fogMode']
): Omit<SceneExplorationState, 'fogLayers'> {
  return {
    map: { assetId: ids.map, height: 100, tileManifestAssetId: null, width: 1_000 },
    grid: {
      kind: 'SQUARE',
      cellSize: 50,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    tokens: [
      token({
        id: ids.hero,
        position: start,
        controlledByUserIds: [ids.player],
        vision: {
          enabled: true,
          brightRange: 0,
          dimRange: 5,
          angleDegrees: 360,
          directionDegrees: 0
        }
      }),
      token({ id: ids.blocker, position: { x: 500, y: 50 } })
    ],
    barriers: [],
    doorStates: {},
    fogMode
  }
}

function movedTo(state: Omit<SceneExplorationState, 'fogLayers'>, position: ScenePoint) {
  return {
    ...state,
    tokens: state.tokens.map((candidate) =>
      candidate.id === ids.hero ? { ...candidate, position } : candidate
    )
  }
}

function explored(layer: SceneFogLayer, point: ScenePoint): boolean {
  return isScenePointExplored(
    { fogLayers: [layer], fogMode: 'PER_PLAYER', map: scene('PER_PLAYER').map },
    ids.player,
    point
  )
}

describe('command fog exploration for a move paused at a passage contact', () => {
  it('explores up to the contact and nothing the unwalked remainder would reveal', () => {
    const prior = scene('PER_PLAYER')
    const [crossing] = collectTokenFootprintPathCrossings({
      movingToken: prior.tokens[0]!,
      path: [start, end],
      stationaryTokens: [prior.tokens[1]!]
    })
    // The footprints first touch when the hero's centre is one footprint width from the blocker.
    expect(crossing).toMatchObject({ entry: { x: 450, y: 50 }, entryPathDistance: 425 })
    const contact = crossing!.entry
    const walked = [start, contact]

    const delta = { kind: 'TOKEN_MOVED' as const, tokenId: ids.hero, position: contact }
    const plan = planSceneCommandExploration(prior, movedTo(prior, contact), delta)
    expect(plan.tokenIds).toEqual([ids.hero])
    expect(plan.owners).toEqual([ids.player])

    const layer = deriveSceneCommandFogLayer(plan, {
      ownerUserId: ids.player,
      existing: null,
      movement: { tokenId: ids.hero, path: walked }
    })
    if (!layer) throw new Error('Expected the walked segment to explore fog.')
    expect({ ownerUserId: layer.ownerUserId, width: layer.width, height: layer.height }).toEqual({
      ownerUserId: ids.player,
      width: 512,
      height: 51
    })
    expect(explored(layer, start)).toBe(true)
    expect(explored(layer, contact)).toBe(true)
    // 45 px past the contact is inside the hero's 50 px sight from the contact...
    expect(explored(layer, { x: 495, y: 50 })).toBe(true)
    // ...but 100 px past it and the requested end are not.
    expect(explored(layer, { x: 550, y: 50 })).toBe(false)
    expect(explored(layer, end)).toBe(false)

    // The whole requested path would have explored its end, so the pause is what withholds it.
    const whole = deriveSceneCommandFogLayer(
      planSceneCommandExploration(prior, movedTo(prior, end), { ...delta, position: end }),
      {
        ownerUserId: ids.player,
        existing: null,
        movement: { tokenId: ids.hero, path: [start, end] }
      }
    )
    if (!whole) throw new Error('Expected the whole path to explore fog.')
    expect(explored(whole, end)).toBe(true)

    // Resuming from the contact keeps the paused exploration and adds the remainder.
    const resumed = deriveSceneCommandFogLayer(
      planSceneCommandExploration(prior, movedTo(prior, end), { ...delta, position: end }),
      {
        ownerUserId: ids.player,
        existing: layer,
        movement: { tokenId: ids.hero, path: [contact, end] }
      }
    )
    if (!resumed) throw new Error('Expected the remainder to explore fog.')
    expect([start, contact, end].map((point) => explored(resumed, point))).toEqual([
      true,
      true,
      true
    ])
  })

  it('plans no owners or tokens with fog off, even for a sighted controlled token', () => {
    const prior = scene('OFF')
    const delta = { kind: 'TOKEN_MOVED' as const, tokenId: ids.hero, position: end }
    const moved = movedTo(prior, end)
    expect(planSceneCommandExploration(prior, moved, delta)).toEqual({
      state: moved,
      tokenIds: [],
      owners: []
    })
  })
})

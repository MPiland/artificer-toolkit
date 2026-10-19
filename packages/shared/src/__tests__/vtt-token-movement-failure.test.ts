import { describe, expect, it } from 'vitest'

import {
  sceneTokenMovementFailure,
  type CampaignSceneState,
  type SceneBarrier,
  type ScenePoint
} from '../domains/vtt/index.js'

const tokenId = '00000000-0000-4000-8000-000000000001'
const barrierId = '00000000-0000-4000-8000-000000000002'

const MISSING_OR_LOCKED = 'The token is missing or locked.'
const NOT_FROM_ORIGIN = 'Token movement must follow a path from its current position.'
const OUT_OF_BOUNDS = 'Token movement must remain within the map bounds.'
const BLOCKED = 'Token movement crosses a blocking barrier.'

type MovementState = Pick<CampaignSceneState, 'map' | 'tokens' | 'barriers' | 'doorStates'>

/** A 100 x 50 map with one unlocked token at (5, 10) and a vertical barrier line at x = 10. */
function scene(
  input: {
    barriers?: SceneBarrier[]
    doorStates?: MovementState['doorStates']
    locked?: boolean
  } = {}
): MovementState {
  return {
    map: {
      assetId: '00000000-0000-4000-8000-000000000003',
      height: 50,
      tileManifestAssetId: null,
      width: 100
    },
    tokens: [
      {
        assetId: null,
        controlledByUserIds: [],
        height: 1,
        hidden: false,
        id: tokenId,
        label: 'Hero',
        locked: input.locked ?? false,
        position: { x: 5, y: 10 },
        rotationDegrees: 0,
        senses: [],
        vision: null,
        width: 1
      }
    ],
    barriers: input.barriers ?? [],
    doorStates: input.doorStates ?? {}
  }
}

const line = { a: { x: 10, y: 0 }, b: { x: 10, y: 20 }, id: barrierId }
const wall = (blocksMovement: boolean): SceneBarrier => ({
  ...line,
  kind: 'WALL',
  blocksLight: true,
  blocksMovement
})
const door = (initialState: 'OPEN' | 'CLOSED' | 'LOCKED'): SceneBarrier => ({
  ...line,
  kind: 'DOOR',
  blocksLightWhenClosed: true,
  blocksMovementWhenClosed: true,
  initialState,
  openAngleDegrees: 90
})

const origin = { x: 5, y: 10 }
const acrossLine: ScenePoint[] = [origin, { x: 15, y: 10 }]

function failure(state: MovementState, path: readonly ScenePoint[], id = tokenId) {
  return sceneTokenMovementFailure(state, id, path.at(-1) ?? origin, path)
}

describe('sceneTokenMovementFailure', () => {
  it('accepts a multi-segment path from the token to the requested position', () => {
    const path = [origin, { x: 5, y: 40 }, { x: 60, y: 40 }]
    expect(sceneTokenMovementFailure(scene(), tokenId, { x: 60, y: 40 }, path)).toBeNull()
  })

  it('accepts a zero-length path that stays on the token and refuses an empty path', () => {
    expect(sceneTokenMovementFailure(scene(), tokenId, origin, [origin])).toBeNull()
    expect(sceneTokenMovementFailure(scene(), tokenId, origin, [])).toBe(NOT_FROM_ORIGIN)
  })

  it('refuses a missing or locked token before reading the path', () => {
    expect(failure(scene(), [], '00000000-0000-4000-8000-000000000099')).toBe(MISSING_OR_LOCKED)
    expect(failure(scene({ locked: true }), [origin, { x: 6, y: 10 }])).toBe(MISSING_OR_LOCKED)
  })

  it('refuses a path that does not start on the token or end at the requested position', () => {
    expect(
      failure(scene(), [
        { x: 6, y: 10 },
        { x: 8, y: 10 }
      ])
    ).toBe(NOT_FROM_ORIGIN)
    expect(
      sceneTokenMovementFailure(scene(), tokenId, { x: 9, y: 10 }, [origin, { x: 8, y: 10 }])
    ).toBe(NOT_FROM_ORIGIN)
  })

  it('keeps every path point inside the inclusive map bounds', () => {
    expect(failure(scene(), [origin, { x: 100, y: 50 }])).toBeNull()
    expect(failure(scene(), [origin, { x: 100.5, y: 10 }])).toBe(OUT_OF_BOUNDS)
    expect(failure(scene(), [origin, { x: 5, y: 50.5 }])).toBe(OUT_OF_BOUNDS)
    // An intermediate point outside the map fails even when both ends are inside.
    expect(failure(scene(), [origin, { x: -1, y: 10 }, { x: 5, y: 12 }])).toBe(OUT_OF_BOUNDS)
    expect(failure(scene(), [origin, { x: 5, y: -1 }, { x: 5, y: 12 }])).toBe(OUT_OF_BOUNDS)
  })

  it('reports the bounds failure before a barrier crossing on the same path', () => {
    expect(
      failure(scene({ barriers: [wall(true)] }), [origin, { x: 15, y: 10 }, { x: 15, y: 60 }])
    ).toBe(OUT_OF_BOUNDS)
  })

  it('refuses a segment crossing a movement-blocking wall and allows a wall that does not block', () => {
    expect(failure(scene({ barriers: [wall(true)] }), acrossLine)).toBe(BLOCKED)
    expect(failure(scene({ barriers: [wall(false)] }), acrossLine)).toBeNull()
    // Going around the end of the wall is a valid route.
    expect(
      failure(scene({ barriers: [wall(true)] }), [origin, { x: 5, y: 30 }, { x: 15, y: 30 }])
    ).toBeNull()
    // Only the second segment crosses.
    expect(
      failure(scene({ barriers: [wall(true)] }), [origin, { x: 5, y: 15 }, { x: 15, y: 15 }])
    ).toBe(BLOCKED)
  })

  it('blocks a closed or locked door and passes an open one, preferring the live door state', () => {
    expect(failure(scene({ barriers: [door('CLOSED')] }), acrossLine)).toBe(BLOCKED)
    expect(failure(scene({ barriers: [door('LOCKED')] }), acrossLine)).toBe(BLOCKED)
    expect(failure(scene({ barriers: [door('OPEN')] }), acrossLine)).toBeNull()
    expect(
      failure(
        scene({ barriers: [door('CLOSED')], doorStates: { [barrierId]: 'OPEN' } }),
        acrossLine
      )
    ).toBeNull()
    expect(
      failure(
        scene({ barriers: [door('OPEN')], doorStates: { [barrierId]: 'LOCKED' } }),
        acrossLine
      )
    ).toBe(BLOCKED)
  })

  it('blocks a one-way barrier in its blocked direction only and never blocks terrain', () => {
    const oneWay: SceneBarrier = {
      ...line,
      kind: 'ONE_WAY',
      blocksLight: false,
      blocksMovement: true,
      blockedDirection: 'LEFT_TO_RIGHT'
    }
    const eastOrigin = { x: 15, y: 10 }
    const fromEast = { ...scene({ barriers: [oneWay] }) }
    fromEast.tokens = fromEast.tokens.map((token) => ({ ...token, position: eastOrigin }))
    // For a line drawn from (10, 0) down to (10, 20), its left side is x > 10 in screen space.
    expect(failure(fromEast, [eastOrigin, { x: 5, y: 10 }])).toBe(BLOCKED)
    expect(failure(scene({ barriers: [oneWay] }), acrossLine)).toBeNull()
    expect(
      failure(scene({ barriers: [{ ...oneWay, blockedDirection: 'RIGHT_TO_LEFT' }] }), acrossLine)
    ).toBe(BLOCKED)
    expect(
      failure(
        scene({ barriers: [{ ...line, kind: 'TERRAIN', movementCostMultiplier: 2 }] }),
        acrossLine
      )
    ).toBeNull()
  })

  it('lets a token whose passage passes blocking barriers cross walls and locked doors (SPELLS-33.T6k1)', () => {
    const passing = (state: MovementState): MovementState => ({
      ...state,
      tokens: state.tokens.map((token) => ({ ...token, passesBlockingBarriers: true }))
    })
    expect(failure(passing(scene({ barriers: [wall(true)] })), acrossLine)).toBeNull()
    expect(failure(passing(scene({ barriers: [door('LOCKED')] })), acrossLine)).toBeNull()
    // Passage never lifts the map bounds.
    expect(failure(passing(scene()), [origin, { x: 100.5, y: 10 }])).toBe(OUT_OF_BOUNDS)
  })
})

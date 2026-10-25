import { describe, expect, it } from 'vitest'

import {
  applySceneDelta,
  applySceneGeometryDelta,
  type CampaignSceneState,
  type SceneToken
} from '../domains/vtt/index.js'

const token: SceneToken = {
  assetId: null,
  controlledByUserIds: [],
  height: 1,
  hidden: false,
  id: 'token-1',
  label: 'Token',
  locked: false,
  position: { x: 1, y: 2 },
  rotationDegrees: 0,
  senses: [],
  vision: null,
  width: 1
}

const door = {
  a: { x: 0, y: 0 },
  b: { x: 0, y: 10 },
  blocksLightWhenClosed: true,
  blocksMovementWhenClosed: true,
  id: 'door-1',
  initialState: 'CLOSED',
  kind: 'DOOR',
  openAngleDegrees: 90
} as const

const wall = {
  a: { x: 10, y: 0 },
  b: { x: 10, y: 10 },
  blocksLight: true,
  blocksMovement: true,
  id: 'wall-1',
  kind: 'WALL'
} as const

function narrowState() {
  return {
    barriers: [door, wall],
    doorStates: { [door.id]: 'OPEN' as const },
    tokens: [token]
  }
}

function fullState(): CampaignSceneState {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT',
    daylight: false,
    barriers: [door, wall],
    campaignId: 'campaign-1',
    darknessZones: [],
    definitionId: 'definition-1',
    definitionVersion: 1,
    doorStates: { [door.id]: 'OPEN' },
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    grid: {
      cellSize: 1,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: 'scene-1',
    lights: [],
    map: { assetId: 'map-1', height: 100, tileManifestAssetId: null, width: 100 },
    measurements: [],
    name: 'Scene',
    tokens: [token],
    version: 0,
    visionRevealMode: 'ON_DRAG'
  }
}

function geometry(state: CampaignSceneState | ReturnType<typeof narrowState>) {
  return { barriers: state.barriers, doorStates: state.doorStates, tokens: state.tokens }
}

describe('applySceneGeometryDelta', () => {
  it('matches the full reducer for every geometry delta on a narrow state', () => {
    const replacementToken = { ...token, id: 'token-2' }
    const replacementDoor = { ...door, id: 'door-2', initialState: 'LOCKED' as const }
    const deltas = [
      { kind: 'TOKEN_UPSERTED', token: replacementToken },
      { kind: 'TOKEN_REMOVED', tokenId: token.id },
      { kind: 'TOKEN_MOVED', position: { x: 3, y: 4 }, tokenId: token.id },
      { kind: 'TOKEN_MOVED', position: { x: 3, y: 4 }, rotationDegrees: 90, tokenId: token.id },
      { kind: 'TOKEN_FACING_SET', rotationDegrees: 180, tokenId: token.id },
      {
        kind: 'TOKEN_MOVE_UNDONE',
        position: { x: 5, y: 6 },
        tokenId: token.id,
        undoneCommandId: 'command-1'
      },
      {
        kind: 'TOKEN_MOVE_UNDONE',
        position: { x: 5, y: 6 },
        rotationDegrees: 270,
        tokenId: token.id,
        undoneCommandId: 'command-1'
      },
      { barrierId: door.id, kind: 'DOOR_STATE_SET', state: 'LOCKED' },
      { barrier: replacementDoor, kind: 'BARRIER_UPSERTED' },
      { barrierId: wall.id, kind: 'BARRIER_REMOVED' }
    ] as const

    for (const delta of deltas) {
      const full = applySceneDelta(fullState(), delta, 1)
      const narrow = applySceneGeometryDelta(narrowState(), delta)
      expect(geometry(narrow)).toEqual(geometry(full))
    }
  })

  it('turns a token only when a move or facing change names a facing (ATTACK-12)', () => {
    const facing = (delta: Parameters<typeof applySceneGeometryDelta>[1]) =>
      applySceneGeometryDelta(narrowState(), delta).tokens[0]?.rotationDegrees
    expect(facing({ kind: 'TOKEN_MOVED', position: { x: 3, y: 4 }, tokenId: token.id })).toBe(0)
    expect(
      facing({
        kind: 'TOKEN_MOVED',
        position: { x: 3, y: 4 },
        rotationDegrees: 90,
        tokenId: token.id
      })
    ).toBe(90)
    expect(facing({ kind: 'TOKEN_FACING_SET', rotationDegrees: 180, tokenId: token.id })).toBe(180)
    expect(
      applySceneGeometryDelta(narrowState(), {
        kind: 'TOKEN_FACING_SET',
        rotationDegrees: 180,
        tokenId: token.id
      }).tokens[0]?.position
    ).toEqual(token.position)
  })

  it('preserves a door state on door upsert and removes it on conversion or removal', () => {
    const state = narrowState()
    const converted = applySceneGeometryDelta(state, {
      barrier: { ...wall, id: door.id },
      kind: 'BARRIER_UPSERTED'
    })
    expect(converted.doorStates).toEqual({})

    const replaced = applySceneGeometryDelta(state, {
      barrier: { ...door, initialState: 'CLOSED' },
      kind: 'BARRIER_UPSERTED'
    })
    expect(replaced.doorStates).toEqual({ [door.id]: 'OPEN' })

    expect(
      applySceneGeometryDelta(state, { barrierId: door.id, kind: 'BARRIER_REMOVED' }).doorStates
    ).toEqual({})
  })

  it('rejects movement for missing tokens and state changes for non-doors', () => {
    expect(() =>
      applySceneGeometryDelta(narrowState(), {
        kind: 'TOKEN_MOVED',
        position: { x: 3, y: 4 },
        tokenId: 'missing'
      })
    ).toThrow('Cannot move a token that is not in the scene.')
    expect(() =>
      applySceneGeometryDelta(narrowState(), {
        kind: 'TOKEN_MOVE_UNDONE',
        position: { x: 3, y: 4 },
        tokenId: 'missing',
        undoneCommandId: 'command-1'
      })
    ).toThrow('Cannot undo movement for a token that is not in the scene.')
    expect(() =>
      applySceneGeometryDelta(narrowState(), {
        kind: 'TOKEN_FACING_SET',
        rotationDegrees: 90,
        tokenId: 'missing'
      })
    ).toThrow('Cannot turn a token that is not in the scene.')
    expect(() =>
      applySceneGeometryDelta(narrowState(), {
        barrierId: wall.id,
        kind: 'DOOR_STATE_SET',
        state: 'OPEN'
      })
    ).toThrow('Cannot set state for a barrier that is not a door.')
  })

  it('does not mutate its input state', () => {
    const state = narrowState()
    const before = structuredClone(state)

    applySceneGeometryDelta(state, {
      kind: 'TOKEN_MOVED',
      position: { x: 8, y: 9 },
      tokenId: token.id
    })
    applySceneGeometryDelta(state, {
      barrier: { ...door, initialState: 'LOCKED' },
      kind: 'BARRIER_UPSERTED'
    })

    expect(state).toEqual(before)
  })
})

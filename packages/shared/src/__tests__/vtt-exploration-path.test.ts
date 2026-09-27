import { describe, expect, it } from 'vitest'

import {
  deriveSceneTokenPathExplorationPatch,
  isScenePointExplored,
  type SceneExplorationState
} from '../domains/vtt/index.js'

const playerId = '00000000-0000-4000-8000-000000000001'
const tokenId = '00000000-0000-4000-8000-000000000002'

function corridor(sight: number): SceneExplorationState {
  return {
    map: { assetId: 'map', height: 100, tileManifestAssetId: null, width: 500 },
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
    tokens: [
      {
        assetId: null,
        controlledByUserIds: [playerId],
        height: 1,
        hidden: false,
        id: tokenId,
        label: 'Scout',
        locked: false,
        position: { x: 0, y: 50 },
        rotationDegrees: 0,
        vision: {
          angleDegrees: 360,
          brightRange: 0,
          dimRange: sight,
          directionDegrees: 0,
          enabled: true
        },
        width: 1
      }
    ],
    barriers: [],
    doorStates: {},
    fogMode: 'PER_PLAYER',
    fogLayers: []
  }
}

describe('token path exploration', () => {
  it('explores continuously along a straight two-point move with short sight', () => {
    const state = corridor(50)
    const layer = deriveSceneTokenPathExplorationPatch(state, {
      ownerUserId: playerId,
      path: [
        { x: 0, y: 50 },
        { x: 500, y: 50 }
      ],
      tokenId
    })
    if (!layer) throw new Error('Expected newly explored cells.')
    const explored = { ...state, fogLayers: [layer] }
    for (let x = 0; x <= 500; x += 10) {
      expect(isScenePointExplored(explored, playerId, { x, y: 50 }), `x=${x}`).toBe(true)
    }
    // Between samples the swept band keeps the sight radius, less at most one fog cell.
    for (const y of [5, 95]) {
      expect(isScenePointExplored(explored, playerId, { x: 260, y }), `y=${y}`).toBe(true)
    }
  })
})

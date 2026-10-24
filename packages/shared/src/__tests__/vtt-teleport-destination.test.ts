import { describe, expect, it } from 'vitest'

import {
  createUniformSceneFogLayer,
  selectTeleportAllowance,
  type SceneExplorationState,
  type SceneToken
} from '../domains/vtt/index.js'

const ids = {
  blocker: '00000000-0000-4000-8000-000000000001',
  hero: '00000000-0000-4000-8000-000000000002',
  map: '00000000-0000-4000-8000-000000000003',
  player: '00000000-0000-4000-8000-000000000004',
  mistyStep: '00000000-0000-4000-8000-0000000000a1',
  dimensionDoor: '00000000-0000-4000-8000-0000000000a2'
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

/** A 1000 x 100 map of 5 ft squares (50 px) with the hero at the west edge and a blocker at x = 500. */
function scene(fogMode: SceneExplorationState['fogMode'] = 'OFF'): SceneExplorationState {
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
      token({ id: ids.hero, position: { x: 25, y: 50 }, controlledByUserIds: [ids.player] }),
      token({ id: ids.blocker, position: { x: 500, y: 50 } })
    ],
    barriers: [],
    doorStates: {},
    fogMode,
    fogLayers: []
  }
}

const misty = {
  castCommandId: ids.mistyStep,
  maxFeet: 30,
  destinationKind: 'VISIBLE' as const,
  consumedByCommandId: null as string | null
}
const door = {
  castCommandId: ids.dimensionDoor,
  maxFeet: 500,
  destinationKind: 'SPECIFIED_POINT' as const,
  consumedByCommandId: null as string | null
}

const select = (
  destination: { x: number; y: number },
  allowances: readonly (typeof misty | typeof door)[],
  state: SceneExplorationState = scene(),
  occupiesSpace: (tokenId: string) => boolean = () => true
) =>
  selectTeleportAllowance({
    scene: state,
    moverTokenId: ids.hero,
    viewerUserId: ids.player,
    destination,
    allowances,
    occupiesSpace
  })

describe('selecting the teleport allowance a destination spends', () => {
  it('takes the allowance when the destination is in range, free and seen', () => {
    // 300 px is 6 squares, 30 ft: exactly Misty Step's range.
    expect(select({ x: 325, y: 50 }, [misty])).toEqual({
      allowed: true,
      castCommandId: ids.mistyStep
    })
  })

  it('refuses a teleport with no allowance', () => {
    expect(select({ x: 125, y: 50 }, [])).toEqual({ allowed: false, reason: 'NO_ALLOWANCE' })
    expect(select({ x: 125, y: 50 }, [{ ...misty, consumedByCommandId: ids.blocker }])).toEqual({
      allowed: false,
      reason: 'NO_ALLOWANCE'
    })
  })

  it('refuses a destination past every allowance’s range', () => {
    expect(select({ x: 375, y: 50 }, [misty])).toEqual({ allowed: false, reason: 'OUT_OF_RANGE' })
  })

  it('takes the smallest allowance that covers the distance, in any order', () => {
    expect(select({ x: 125, y: 50 }, [door, misty])).toMatchObject({
      allowed: true,
      castCommandId: ids.mistyStep
    })
    expect(select({ x: 375, y: 50 }, [misty, door])).toMatchObject({
      allowed: true,
      castCommandId: ids.dimensionDoor
    })
  })

  it('refuses an occupied destination, hidden or not, but not the mover’s own footprint', () => {
    expect(select({ x: 500, y: 50 }, [door])).toEqual({ allowed: false, reason: 'OCCUPIED' })
    const hiddenBlocker = {
      ...scene(),
      tokens: scene().tokens.map((candidate) =>
        candidate.id === ids.blocker ? { ...candidate, hidden: true } : candidate
      )
    }
    expect(select({ x: 500, y: 50 }, [door], hiddenBlocker)).toEqual({
      allowed: false,
      reason: 'OCCUPIED'
    })
    expect(select({ x: 60, y: 50 }, [misty])).toMatchObject({ allowed: true })
  })

  it('arrives on a token that does not occupy its space, and lets such a mover arrive on any (SPELLS-4.T2v2a3c)', () => {
    const notBlocker = (tokenId: string) => tokenId !== ids.blocker
    expect(select({ x: 500, y: 50 }, [door], scene(), notBlocker)).toMatchObject({
      allowed: true
    })
    const notHero = (tokenId: string) => tokenId !== ids.hero
    expect(select({ x: 500, y: 50 }, [door], scene(), notHero)).toMatchObject({ allowed: true })
  })

  describe('with fog of war', () => {
    const fogged = (explored: boolean) => {
      const state = scene('PER_PLAYER')
      return {
        ...state,
        fogLayers: [createUniformSceneFogLayer(state, { explored, ownerUserId: ids.player })]
      }
    }

    it('refuses an unseen destination for a visible-destination allowance', () => {
      expect(select({ x: 125, y: 50 }, [misty], fogged(false))).toEqual({
        allowed: false,
        reason: 'UNSEEN'
      })
      expect(select({ x: 125, y: 50 }, [misty], fogged(true))).toMatchObject({ allowed: true })
    })

    it('lets a specified-point allowance reach an unseen destination', () => {
      expect(select({ x: 125, y: 50 }, [door], fogged(false))).toMatchObject({
        allowed: true,
        castCommandId: ids.dimensionDoor
      })
    })

    it('skips the unseen visible allowance for the specified-point one that covers the distance', () => {
      expect(select({ x: 125, y: 50 }, [misty, door], fogged(false))).toMatchObject({
        allowed: true,
        castCommandId: ids.dimensionDoor
      })
    })
  })
})

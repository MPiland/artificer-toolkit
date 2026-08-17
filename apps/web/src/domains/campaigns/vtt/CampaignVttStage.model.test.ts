import type { EncounterSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { describe, expect, it } from 'vitest'
import { canMoveSceneToken, createSceneBarrier, nudgeSceneToken } from './CampaignVttStage.model'

const currentUserId = '00000000-0000-4000-8000-000000000001'

function scene(): EncounterSceneStateDto {
  return {
    annotations: [],
    barriers: [],
    campaignId: '00000000-0000-4000-8000-000000000002',
    darknessZones: [],
    definitionId: '00000000-0000-4000-8000-000000000003',
    definitionVersion: 1,
    doorStates: {},
    encounterId: '00000000-0000-4000-8000-000000000004',
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    visionRevealMode: 'ON_DROP',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'ALTERNATING',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: '00000000-0000-4000-8000-000000000005',
    lights: [],
    map: {
      assetId: '00000000-0000-4000-8000-000000000006',
      height: 400,
      tileManifestAssetId: null,
      width: 600
    },
    measurements: [],
    name: 'Accessible movement test',
    tokens: [
      {
        actorId: null,
        assetId: null,
        controlledByUserIds: [currentUserId],
        height: 50,
        hidden: false,
        id: '00000000-0000-4000-8000-000000000007',
        label: 'Ember',
        locked: false,
        position: { x: 75, y: 75 },
        rotationDegrees: 0,
        vision: null,
        width: 50
      }
    ],
    version: 4
  }
}

describe('Campaign VTT accessible scene controls', () => {
  it('creates each barrier with its renderer-neutral default behavior', () => {
    const a = { x: 10, y: 10 }
    const b = { x: 20, y: 20 }

    expect(createSceneBarrier('WINDOW', a, b)).toMatchObject({
      blocksLight: false,
      blocksMovement: true,
      kind: 'WINDOW'
    })
    expect(createSceneBarrier('ONE_WAY', a, b)).toMatchObject({
      blockedDirection: 'LEFT_TO_RIGHT',
      blocksLight: true,
      blocksMovement: true,
      kind: 'ONE_WAY'
    })
    expect(createSceneBarrier('TERRAIN', a, b)).toMatchObject({
      kind: 'TERRAIN',
      movementCostMultiplier: 2
    })
  })

  it('uses the same token-control rule for a player and the GM', () => {
    const token = scene().tokens[0]!

    expect(canMoveSceneToken(token, currentUserId, 'PLAYER')).toBe(true)
    expect(canMoveSceneToken(token, crypto.randomUUID(), 'PLAYER')).toBe(false)
    expect(canMoveSceneToken(token, crypto.randomUUID(), 'OWNER')).toBe(true)
    expect(canMoveSceneToken({ ...token, locked: true }, currentUserId, 'OWNER')).toBe(false)
  })

  it('nudges one grid step and keeps the token inside the map', () => {
    const current = scene()
    const token = current.tokens[0]!

    expect(nudgeSceneToken(current, token, 'RIGHT')).toEqual({ x: 125, y: 75 })
    expect(nudgeSceneToken(current, { ...token, position: { x: 25, y: 25 } }, 'UP')).toEqual({
      x: 25,
      y: 25
    })
  })

  it('rejects a nudge through a wall or closed door and allows an open door', () => {
    const current = scene()
    const token = current.tokens[0]!
    const wall = {
      ...current,
      barriers: [
        {
          a: { x: 100, y: 0 },
          b: { x: 100, y: 400 },
          blocksLight: true,
          blocksMovement: true,
          id: 'wall',
          kind: 'WALL' as const
        }
      ]
    }
    expect(nudgeSceneToken(wall, token, 'RIGHT')).toEqual(token.position)

    const door = {
      ...current,
      barriers: [
        {
          a: { x: 100, y: 0 },
          b: { x: 100, y: 400 },
          blocksLightWhenClosed: true,
          blocksMovementWhenClosed: true,
          id: 'door',
          initialState: 'CLOSED' as const,
          kind: 'DOOR' as const,
          openAngleDegrees: 90
        }
      ]
    }
    expect(nudgeSceneToken(door, token, 'RIGHT')).toEqual(token.position)
    expect(nudgeSceneToken({ ...door, doorStates: { door: 'OPEN' } }, token, 'RIGHT')).toEqual({
      x: 125,
      y: 75
    })
  })
})

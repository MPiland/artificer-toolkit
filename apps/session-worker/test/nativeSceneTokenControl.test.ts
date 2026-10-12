import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { expect, it } from 'vitest'

import { canPreviewSceneTokenDrag } from '../src/nativeRoomSceneCommand.js'

const playerId = '00000000-0000-4000-8000-000000000201'
const tokenId = '00000000-0000-4000-8000-000000000202'

function token(
  overrides: Partial<CampaignSceneStateDto['tokens'][number]> = {}
): CampaignSceneStateDto['tokens'][number] {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: 5,
    hidden: false,
    id: tokenId,
    label: 'Scout',
    locked: false,
    position: { x: 10, y: 10 },
    rotationDegrees: 0,
    senses: [],
    vision: {
      angleDegrees: 360,
      brightRange: 0,
      dimRange: 0,
      directionDegrees: 0,
      enabled: false
    },
    width: 5,
    ...overrides
  }
}

const player = { role: 'PLAYER' as const, userId: playerId }

it('lets a player preview a bound token only when they control its actor', () => {
  // The Scene token lists the player, but its bound actor is another player's Character.
  expect(
    canPreviewSceneTokenDrag({
      ...player,
      token: token({ controlledByUserIds: [playerId] }),
      originBoundTokenControl: [{ tokenId, controlled: false }]
    })
  ).toBe(false)
  // Control granted through the actor, with no Scene token controllers.
  expect(
    canPreviewSceneTokenDrag({
      ...player,
      token: token(),
      originBoundTokenControl: [{ tokenId, controlled: true }]
    })
  ).toBe(true)
})

it('keeps Scene token control for unbound tokens and refuses locked or hidden ones', () => {
  expect(
    canPreviewSceneTokenDrag({
      ...player,
      token: token({ controlledByUserIds: [playerId] }),
      originBoundTokenControl: []
    })
  ).toBe(true)
  expect(
    canPreviewSceneTokenDrag({ ...player, token: token(), originBoundTokenControl: null })
  ).toBe(false)
  expect(
    canPreviewSceneTokenDrag({
      ...player,
      token: token({ controlledByUserIds: [playerId], hidden: true }),
      originBoundTokenControl: null
    })
  ).toBe(false)
  expect(
    canPreviewSceneTokenDrag({
      role: 'OWNER',
      userId: playerId,
      token: token({ locked: true }),
      originBoundTokenControl: null
    })
  ).toBe(false)
  expect(
    canPreviewSceneTokenDrag({
      role: 'OWNER',
      userId: playerId,
      token: token(),
      originBoundTokenControl: null
    })
  ).toBe(true)
})

import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  applySceneGeometryDelta,
  resolveSquareGridCover,
  type CampaignSceneState,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * SPELLS-14.T1: cover tiers come from the room's live Scene, its walls and its creatures, under
 * the SRD System's cover data. A wolf standing in the line gives half cover and is named; once it
 * walks away the line is clear, while a target behind a wall keeps total cover.
 */

const ATTACKER_ID = testUuid(0xc01)
const BLOCKER_ID = testUuid(0xc02)
const TARGET_ID = testUuid(0xc03)
const WALLED_ID = testUuid(0xc04)
const BLOCKER_START: ScenePoint = { x: 350, y: 150 }

const tokenIdOf = (actorId: string) => `f${actorId.slice(1)}`

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function coverRoom() {
  return movementRoom({
    actors: [ATTACKER_ID, BLOCKER_ID, TARGET_ID, WALLED_ID].map((id) =>
      srdCreatureActor({ id, creature: plainWolf })
    ),
    moverActorId: BLOCKER_ID,
    positions: {
      [ATTACKER_ID]: { x: 150, y: 150 },
      [BLOCKER_ID]: BLOCKER_START,
      [TARGET_ID]: { x: 550, y: 150 },
      [WALLED_ID]: { x: 550, y: 550 }
    },
    sceneOverrides: {
      barriers: [
        {
          a: { x: 450, y: 250 },
          b: { x: 450, y: 800 },
          blocksLight: true,
          blocksMovement: true,
          id: 'wall',
          kind: 'WALL'
        }
      ]
    }
  })
}

type Room = Awaited<ReturnType<typeof coverRoom>>

/** The Scene the room last synced to the GM. */
function syncedScene(room: Room) {
  const sync = [...room.base.messages].reverse().find((message) => message.type === 'STATE_SYNC')
  if (sync?.type !== 'STATE_SYNC' || !sync.state.scene)
    throw new Error('The room has sent the GM no Scene.')
  return sync.state.scene
}

/** The attacker's cover against `actorId` in `scene`, under the SRD System's cover rules. */
function coverAgainst(scene: CampaignSceneState, actorId: string) {
  const tokenOf = (id: string) => {
    const token = scene.tokens.find((candidate) => candidate.id === tokenIdOf(id))
    if (!token) throw new Error(`The Scene holds no token for ${id}.`)
    return token
  }
  if (!srdSystemRecord.cover) throw new Error('The SRD System authors no cover rules.')
  return resolveSquareGridCover({
    creatures: scene.tokens,
    origin: { kind: 'TOKEN', token: tokenOf(ATTACKER_ID) },
    rules: srdSystemRecord.cover,
    state: scene,
    target: tokenOf(actorId)
  })
}

describe('Cover from the live Scene (SPELLS-14.T1)', () => {
  it('gives half cover behind a creature, clears when it walks away, and total cover behind a wall', async () => {
    const room = await coverRoom()
    const before = syncedScene(room)

    expect(coverAgainst(before, TARGET_ID)).toMatchObject({
      tier: { code: 'HALF', bonus: 2, blocksTargeting: false },
      wallBlockedLines: 0,
      creatureTokenIds: [tokenIdOf(BLOCKER_ID)]
    })
    expect(coverAgainst(before, WALLED_ID)).toMatchObject({
      tier: { code: 'TOTAL', blocksTargeting: true },
      wallBlockedLines: 4
    })

    const moved = await room.move([BLOCKER_START, { x: 350, y: 350 }])
    if (
      moved.type !== 'COMMAND_COMMITTED' ||
      moved.delta?.scope !== 'SCENE' ||
      moved.delta.result.delta.kind !== 'TOKEN_MOVED'
    )
      throw new Error(`The move did not commit: ${JSON.stringify(moved)}`)
    const after = applySceneGeometryDelta(before, moved.delta.result.delta)

    expect(coverAgainst(after, TARGET_ID)).toMatchObject({
      tier: null,
      blockedLines: 0,
      creatureTokenIds: []
    })
    expect(coverAgainst(after, WALLED_ID)?.tier?.code).toBe('TOTAL')
  })
})

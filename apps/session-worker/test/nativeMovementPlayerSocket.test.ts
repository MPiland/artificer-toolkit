import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

const CHARACTER_ACTOR_ID = testUuid(0x200)
const REACTOR_ID = testUuid(0x201)
const CHARACTER_ID = testUuid(0x400)
const CHARACTER_START: ScenePoint = { x: 150, y: 150 }
const EAST = [CHARACTER_START, { x: 750, y: 150 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The room's player owns the Character; a HOSTILE Wolf the GM controls guards its path east. */
function characterRoom() {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    moverActorId: CHARACTER_ACTOR_ID,
    positions: { [REACTOR_ID]: { x: 150, y: 50 }, [CHARACTER_ACTOR_ID]: CHARACTER_START }
  })
}

it("moves a player's own Character from the player's socket and raises the Wolf's reaction", async () => {
  const room = await characterRoom()
  const player = await room.asPlayer()

  const walk = await player.move(EAST)

  expect(walk.type).toBe('COMMAND_COMMITTED')
  expect(await room.pending()).toMatchObject({
    context: { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
  })
  expect(await room.receipts()).toContainEqual(
    expect.objectContaining({ commandId: walk.commandId, actorUserId: room.base.playerId })
  )
})

it("refuses the player's answer to a decision about a creature the GM controls, and takes the GM's", async () => {
  const room = await characterRoom()
  await (await room.asPlayer()).move(EAST)

  const refused = await (await room.asPlayer()).respond({ kind: 'DECLINE' })
  expect(refused.type).toBe('COMMAND_REJECTED')
  expect(await room.pending()).not.toBeNull()

  const answered = await room.respond({ kind: 'DECLINE' })
  expect(answered.type).toBe('COMMAND_COMMITTED')
  expect(await room.pending()).toBeNull()
})

import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

const CHARACTER_ACTOR_ID = testUuid(0x200)
const WOLF_ID = testUuid(0x201)
const CHARACTER_ID = testUuid(0x400)
const CHARACTER_START: ScenePoint = { x: 150, y: 150 }
const WOLF_START: ScenePoint = { x: 150, y: 550 }
const EAST = (start: ScenePoint): readonly ScenePoint[] => [start, { x: start.x + 200, y: start.y }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The GM's Wolf and the room's player's Character share the Scene; the Wolf is the current actor. */
function wolfRoom() {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: reactionWolf }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    moverActorId: WOLF_ID,
    otherPlayerControlledActorIds: [],
    positions: { [WOLF_ID]: WOLF_START, [CHARACTER_ACTOR_ID]: CHARACTER_START }
  })
}

/** The Character, owned by the room's player, is the current actor; a second player is seated. */
function characterRoom() {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: reactionWolf }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    moverActorId: CHARACTER_ACTOR_ID,
    otherPlayerControlledActorIds: [],
    positions: { [WOLF_ID]: WOLF_START, [CHARACTER_ACTOR_ID]: CHARACTER_START }
  })
}

type Room = Awaited<ReturnType<typeof wolfRoom>>

/** What the room holds after a refused move: the Run's version, its receipts and any pending decision. */
async function stored(room: Room) {
  return {
    runVersion: await runInDurableObject(room.base.stub, async (_instance, context) => {
      return new RoomEncounterStore(context.storage).documents('encounterRuns')[0]!.version
    }),
    receipts: await room.receipts(),
    pending: await room.pending()
  }
}

it("refuses a player's move of a creature the GM controls and writes nothing", async () => {
  const room = await wolfRoom()
  const before = await stored(room)

  const refused = await (await room.asPlayer()).move(EAST(WOLF_START))

  expect(refused).toMatchObject({
    type: 'COMMAND_REJECTED',
    code: 'DOMAIN_REJECTED',
    reason: 'NOT_ACTOR_CONTROLLER'
  })
  expect(await stored(room)).toEqual(before)
})

it("refuses a second player's move of another player's Character and writes nothing", async () => {
  const room = await characterRoom()
  const before = await stored(room)

  const refused = await (await room.asPlayer('OTHER_PLAYER')).move(EAST(CHARACTER_START))

  expect(refused).toMatchObject({
    type: 'COMMAND_REJECTED',
    code: 'DOMAIN_REJECTED',
    reason: 'NOT_ACTOR_CONTROLLER'
  })
  expect(await stored(room)).toEqual(before)
})

it("takes the controller's own move of the same Character", async () => {
  const room = await characterRoom()

  const walk = await (await room.asPlayer()).move(EAST(CHARACTER_START))

  expect(walk.type).toBe('COMMAND_COMMITTED')
})

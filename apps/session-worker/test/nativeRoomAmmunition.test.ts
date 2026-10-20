import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { arrows } from '@artificer-toolkit/source-data/srd/equipment/arrows.js'
import { longbow } from '@artificer-toolkit/source-data/srd/equipment/longbow.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const ARCHER_ACTOR_ID = testUuid(0xa10)
const ARCHER_ID = testUuid(0xa11)
const WOLF_ID = testUuid(0xa12)

/** No Scene measures the Longbow's range (D11); every shot acknowledges that. */
const RANGE: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Fighter with an equipped Longbow and two Arrows, in a Campaign that tracks ammunition. */
function archerRoom(trackAmmunition: boolean) {
  return actionRoom({
    autoRoll: 'BOTH',
    trackAmmunition,
    rolls: Array.from({ length: 24 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
    actors: [
      {
        ...characterActor({ id: ARCHER_ACTOR_ID, characterId: ARCHER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: ARCHER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterEquipment: [longbow, arrows],
    characterPlay: { carriedQuantity: 2 },
    characterAction: (action) => action.label.includes('Longbow')
  })
}

type Room = Awaited<ReturnType<typeof archerRoom>>

/** The pieces of Arrows the room offers the Longbow attack, none when the stack is used up. */
async function arrowsLeft(room: Room) {
  const choices = await room.actionChoices()
  const shot = choices.actions.find(({ id }) => id === room.actionId)
  return shot?.ammunition?.map(({ quantity }) => quantity) ?? []
}

const shoot = (room: Room, warnings: Parameters<Room['startAction']>[1] = RANGE) =>
  room.startAction(WOLF_ID, warnings)

/** The wolf's turn passes and the archer acts again. */
async function nextRound(room: Room) {
  await room.advanceTurn()
  await room.advanceTurn()
}

describe('a Longbow fired in a Campaign that tracks ammunition (ATTACK-19.4)', () => {
  it('draws a piece per shot, refuses at none, and gives a piece back on undo', async () => {
    const room = await archerRoom(true)
    expect(await arrowsLeft(room)).toEqual([2])

    const first = await shoot(room)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    expect(await arrowsLeft(room)).toEqual([1])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await arrowsLeft(room)).toEqual([2])

    expect((await shoot(room)).answer.type).toBe('COMMAND_COMMITTED')
    await nextRound(room)
    expect((await shoot(room)).answer.type).toBe('COMMAND_COMMITTED')
    expect(await arrowsLeft(room)).toEqual([])

    await nextRound(room)
    const refused = await shoot(room)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('RESOURCE_UNAVAILABLE')
    expect(await arrowsLeft(room)).toEqual([])
  })
})

describe('a Longbow fired in a Campaign that does not track ammunition (ATTACK-19.4)', () => {
  it('counts nothing and never runs out', async () => {
    const room = await archerRoom(false)
    for (let shot = 0; shot < 3; shot += 1) {
      const fired = await shoot(room)
      expect(fired.answer.type, JSON.stringify(fired.answer)).toBe('COMMAND_COMMITTED')
      await nextRound(room)
    }
    expect(await arrowsLeft(room)).toEqual([2])
  })
})

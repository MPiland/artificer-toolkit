import {
  srdCreatureActor,
  creatureFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const MOUND_ID = testUuid(0xf00)
const MEDIUM_ID = testUuid(0xf01)
const LARGE_ID = testUuid(0xf02)

/** No Scene measures the attacks' reach (D11); every attack acknowledges that. */
const RANGE: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

/** A hit (18) and no damage dice above their minimum, per Slam. */
const HIT = [18, 0, 0]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

async function moundRoom(targetCreature: string, targetId: string) {
  const mound = seededSrdCreature('Shambling Mound')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: MOUND_ID, creature: mound }),
      srdCreatureActor({ id: targetId, creature: seededSrdCreature(targetCreature) })
    ],
    ownerFeatureId: creatureFeature(mound, 'Slam').id,
    autoRoll: 'GAME_MASTER',
    rolls: [...HIT, ...HIT, ...HIT, 0, 0, 0, 0]
  })
  const offered = async () => (await room.actionChoices()).actions
  const engulf = async () => (await offered()).find(({ label }) => label === 'Engulf')
  return { room, engulf }
}

const undo = async (room: Awaited<ReturnType<typeof moundRoom>>['room']) =>
  room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })

describe('a Shambling Mound’s two Slams in the room (D93, D105)', () => {
  it('grapples a Medium target both slams hit (escape DC 14), then offers Engulf on it only, and undoes once', async () => {
    const { room, engulf } = await moundRoom('Veteran', MEDIUM_ID)
    // Engulf is offered from the start, but the drawer lists only held creatures and the user holds none.
    expect((await engulf())?.target).toMatchObject({ kind: 'ACTOR', heldBySource: true })
    expect((await room.actionChoices()).releases).toEqual([])

    const first = await room.startAction(MEDIUM_ID, RANGE)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    // A lone Slam never grapples: the first of the two has no earlier hit to gate on.
    expect((await room.heldRelationships()) ?? []).toHaveLength(0)

    const second = await room.startAction(MEDIUM_ID, RANGE)
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')
    const holds = (await room.heldRelationships()) ?? []
    expect(holds).toHaveLength(1)
    expect(holds[0]).toMatchObject({ heldActorId: MEDIUM_ID })

    const offeredEngulf = await engulf()
    if (!offeredEngulf) throw new Error('The Mound offers no Engulf.')
    expect(offeredEngulf.target).toMatchObject({ kind: 'ACTOR', heldBySource: true })
    expect((await room.actionChoices()).releases.map(({ heldActorId }) => heldActorId)).toEqual([
      MEDIUM_ID
    ])

    const engulfed = await room.startAction(MEDIUM_ID, RANGE, null, null, offeredEngulf.id)
    expect(engulfed.answer.type, JSON.stringify(engulfed.answer)).toBe('COMMAND_COMMITTED')

    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const again = await undo(room)
    expect(again.type).not.toBe('COMMAND_COMMITTED')
  })

  it('does not grapple a Large target both slams hit, and Engulf is refused on a creature it does not hold', async () => {
    const { room, engulf } = await moundRoom('Ogre', LARGE_ID)
    for (let index = 0; index < 2; index += 1) {
      const slam = await room.startAction(LARGE_ID, RANGE)
      expect(slam.answer.type, JSON.stringify(slam.answer)).toBe('COMMAND_COMMITTED')
    }
    expect((await room.heldRelationships()) ?? []).toHaveLength(0)

    const offeredEngulf = await engulf()
    if (!offeredEngulf) throw new Error('The Mound offers no Engulf.')
    const refused = await room.startAction(LARGE_ID, RANGE, null, null, offeredEngulf.id)
    expect(refused.answer.type).not.toBe('COMMAND_COMMITTED')
  })
})

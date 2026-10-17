import { runInDurableObject } from 'cloudflare:test'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * D99: the GM ends one of a held Character's active effects from its Sheet. The end settles the
 * Character as every other effect end does (QUALITY-1.T1): the conditions only that effect held end
 * with it.
 */

const HOLDER_ID = testUuid(0x220)
const CHARACTER_ID = testUuid(0x420)

afterEach(() => {
  closeTrackedSockets()
})

const invisible = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INVISIBLE')!

type Room = Awaited<ReturnType<typeof movementRoom>>

function invisibleRoom() {
  return movementRoom({
    actors: [characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID })],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    characterPlay: {
      currentHitPoints: 5,
      conditions: [{ conditionTypeId: invisible.id, label: 'Invisible' }]
    },
    seed: seedModifierGrant({
      sourceActorId: HOLDER_ID,
      holderActorId: HOLDER_ID,
      lifecycle: {},
      ownedConditionId: invisible.id
    })
  })
}

async function characterPlay(room: Room) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return { streamVersion: row.streamVersion, play: readCharacterPlay(row) }
  })
}

describe('a Sheet effect end in the room (D99)', () => {
  it('releases the condition only the ended effect held (QUALITY-1.T1)', async () => {
    const room = await invisibleRoom()
    const [effect, ...others] = (await readRoomHistory(room.base.stub)).characterEffects
    expect(others).toEqual([])
    const before = await characterPlay(room)
    expect(before.play.conditions?.map(({ conditionTypeId }) => conditionTypeId)).toEqual([
      invisible.id
    ])
    const commandId = crypto.randomUUID()

    const answer = await room.send(commandId, {
      scope: 'CHARACTER_SHEET',
      characterId: CHARACTER_ID,
      encounterId: room.encounterId,
      command: {
        type: 'END_ACTIVE_EFFECT',
        commandId,
        expectedVersion: before.streamVersion,
        effectId: effect!.id
      }
    })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(room.base.stub)).characterEffects).toEqual([])
    const after = await characterPlay(room)
    expect(after.play.conditions ?? []).toEqual([])
    expect(after.play.hitpoints.current).toBe(5)
  })
})

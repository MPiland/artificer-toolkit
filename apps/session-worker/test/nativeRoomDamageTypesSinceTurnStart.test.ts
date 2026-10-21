import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { revertLastAction } from './placedZoneRoomReads.js'
import { readActorDamageTypesTaken, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-33 T4i1b1: the damage types a creature took since its turn began are recorded by the one
 * mechanics write that lands the damage, and the command's undo takes exactly those entries back.
 */

const CASTER_ID = testUuid(0x2350)
const HIT_ID = testUuid(0x2351)
const SPARED_ID = testUuid(0x2352)
const FIRE_ID = srdSystemRecord.damageTypes.find(({ code }) => code === 'FIRE')?.id

afterEach(() => {
  closeTrackedSockets()
})

function fireRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf('FIRE') }),
      srdCreatureActor({ id: HIT_ID, creature: plainWolf }),
      srdCreatureActor({ id: SPARED_ID, creature: plainWolf })
    ],
    ownerFeatureId: fireballWolf('FIRE').features?.find((feature) => feature.label === 'Bite')?.id
  })
}

async function record(room: Awaited<ReturnType<typeof fireRoom>>, actorId: string) {
  return readActorDamageTypesTaken(await readRoomHistory(room.room.base.stub), actorId)
}

describe('the damage types a creature took since its turn began (SPELLS-33 T4i1b1)', () => {
  it('records the fire a hit creature took under the casting command and nothing for a spared one', async () => {
    const room = await fireRoom()
    expect(await record(room, HIT_ID)).toEqual([])

    await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room, { [SPARED_ID]: 20 })

    const history = await readRoomHistory(room.room.base.stub)
    const [entry] = readActorDamageTypesTaken(history, HIT_ID)
    expect(entry?.damageTypeId).toBe(FIRE_ID)
    expect(history.commands.some(({ commandId }) => commandId === entry?.commandId)).toBe(true)
    expect(readActorDamageTypesTaken(history, SPARED_ID)).toEqual([])
  })

  it('takes exactly the undone command’s entries back', async () => {
    const room = await fireRoom()
    await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room)
    expect(await record(room, HIT_ID)).toHaveLength(1)

    await revertLastAction(room)

    expect(await record(room, HIT_ID)).toEqual([])
  })
})

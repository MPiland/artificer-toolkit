import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-33.T6e3a: a creature's passive damage trigger gives it a timed grant in the commit of the
 * action that damaged it, and undoing that action takes the grant away again.
 */

const BITER_ID = testUuid(0x6e30)
const GOLEM_ID = testUuid(0x6e31)

afterEach(() => {
  closeTrackedSockets()
})

/** A biter whose failed-save Bite deals fire (or cold) damage to the Flesh Golem. */
function golemRoom(damageTypeCode: 'FIRE' | 'COLD') {
  const biter = biteWolf('SAVE', { save: { ability: 'DEXTERITY', damageTypeCode } })
  return actionRoom({
    actors: [
      srdCreatureActor({ id: BITER_ID, creature: biter, disposition: 'HOSTILE' }),
      srdCreatureActor({
        id: GOLEM_ID,
        creature: srdByLabel(SRD.creatures, 'Flesh Golem'),
        disposition: 'FRIENDLY'
      })
    ],
    ownerFeatureId: creatureFeature(biter, 'Bite').id,
    autoRoll: 'BOTH',
    fallbackRoll: 0
  })
}

async function golemEffects(room: Awaited<ReturnType<typeof golemRoom>>) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.filter(({ targetActorId }) => targetActorId === GOLEM_ID)
}

describe('a passive damage trigger giving its holder a timed grant (SPELLS-33.T6e3a)', () => {
  it('gives the golem its grant from fire damage, and takes it back when the action is undone', async () => {
    const room = await golemRoom('FIRE')
    expect(await golemEffects(room)).toEqual([])

    const { answer } = await room.startAction(GOLEM_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const granted = await golemEffects(room)
    expect(granted).toHaveLength(1)
    expect(granted[0]).toMatchObject({ targetActorId: GOLEM_ID })

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await golemEffects(room)).toEqual([])
  })

  it('gives the golem nothing from damage of another type', async () => {
    const room = await golemRoom('COLD')
    const { answer } = await room.startAction(GOLEM_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await golemEffects(room)).toEqual([])
  })
})

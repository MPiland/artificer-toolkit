import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves, areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-33.T6e3c: an area that damages a creature with a passive damage trigger gives it the timed
 * grant in its own outcome, and undoing the area takes the grant away again.
 */

const CASTER_ID = testUuid(0x6e32)
const GOLEM_ID = testUuid(0x6e33)

afterEach(() => {
  closeTrackedSockets()
})

/** A caster whose point area deals fire (or cold) damage to the Flesh Golem it catches. */
function golemRoom(damageTypeCode: 'FIRE' | 'COLD') {
  const caster = fireballWolf(damageTypeCode)
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: caster }),
      srdCreatureActor({
        id: GOLEM_ID,
        creature: srdByLabel(SRD.creatures, 'Flesh Golem'),
        disposition: 'FRIENDLY'
      })
    ],
    ownerFeatureId: caster.features?.find((feature) => feature.label === 'Bite')?.id
  })
}

type Room = Awaited<ReturnType<typeof golemRoom>>

async function golemEffects(room: Room) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.filter(({ targetActorId }) => targetActorId === GOLEM_ID)
}

async function cast(room: Room) {
  await room.startAreaAction({ x: 50, y: 150 })
  await answerAllSaves(room, {})
}

describe('an area giving a damaged creature its passive damage grant (SPELLS-33.T6e3c)', () => {
  it('gives the golem its grant from fire damage, receipts it, and takes it back on undo', async () => {
    const room = await golemRoom('FIRE')
    expect(await golemEffects(room)).toEqual([])

    await cast(room)

    const granted = await golemEffects(room)
    expect(granted).toHaveLength(1)
    const history = await readRoomHistory(room.room.base.stub)
    const receipted = areaReceipts(history).children.flatMap(({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ? outputs.grantEffectTransitions : []
    )
    expect(receipted.map(({ activeEffectId }) => activeEffectId)).toEqual([granted[0]!.id])

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

    await cast(room)

    expect(await golemEffects(room)).toEqual([])
  })
})

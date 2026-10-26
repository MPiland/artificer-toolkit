import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  STANDING_WARD_EFFECT_ID,
  standingWardFeature
} from '@artificer-toolkit/rules-runtime/testing/standingWardFeature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.2: a Creature's standing ward has no duration. Its rest turns it on, its holder's attack
 * on an enemy ends it, undo gives it back, and once ended it stays ended until the rest it returns on.
 */

const HOLDER_ID = testUuid(0x5f0)
const TARGET_ID = testUuid(0x5f1)

const { availableAtLevel: _level, ...ward } = standingWardFeature('LONG_REST')
const weapon = biteWolf('ATTACK')
const wardedWolf: CreatureAuthored = { ...weapon, features: [...(weapon.features ?? []), ward] }

afterEach(() => {
  closeTrackedSockets()
})

function wardRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: HOLDER_ID, creature: wardedWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf, disposition: 'HOSTILE' })
    ],
    ownerFeatureId: creatureFeature(wardedWolf, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [14],
    fallbackRoll: 0
  })
}
type Room = Awaited<ReturnType<typeof wardRoom>>

/** The authored effects its holder holds now. */
async function wards(room: Room) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.map(
    ({ definitionJson }) =>
      (JSON.parse(definitionJson) as { authoredEffectId: string }).authoredEffectId
  )
}

async function rest(room: Room, restKind: 'SHORT' | 'LONG') {
  return room.send({
    type: 'CREATURE_REST',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    restKind,
    actorIds: [HOLDER_ID]
  })
}

async function undo(room: Room) {
  return room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
}

describe('a Creature’s standing effect (SPELLS-31.2)', () => {
  it('a long rest turns it on, and undoing the rest turns it off', async () => {
    const room = await wardRoom()
    expect(await wards(room)).toEqual([])

    const rested = await rest(room, 'LONG')
    expect(rested.type, JSON.stringify(rested)).toBe('COMMAND_COMMITTED')
    expect(await wards(room)).toEqual([STANDING_WARD_EFFECT_ID])

    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wards(room)).toEqual([])
  })

  it('its holder’s attack ends it, and undo gives it back', async () => {
    const room = await wardRoom()
    await rest(room, 'LONG')

    const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await wards(room)).toEqual([])

    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wards(room)).toEqual([STANDING_WARD_EFFECT_ID])
  })

  it('once ended it stays ended through a short rest, until the long rest it returns on', async () => {
    const room = await wardRoom()
    await rest(room, 'LONG')
    await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(await wards(room)).toEqual([])

    expect((await rest(room, 'SHORT')).type).toBe('COMMAND_REJECTED')
    expect(await wards(room)).toEqual([])

    expect((await rest(room, 'LONG')).type).toBe('COMMAND_COMMITTED')
    expect(await wards(room)).toEqual([STANDING_WARD_EFFECT_ID])
  })

  it('a rest while it holds the ward makes no second one', async () => {
    const room = await wardRoom()
    await rest(room, 'LONG')
    expect((await rest(room, 'LONG')).type).toBe('COMMAND_REJECTED')
    expect(await wards(room)).toEqual([STANDING_WARD_EFFECT_ID])
  })
})

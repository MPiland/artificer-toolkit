import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SOURCE_ID = testUuid(0xb00)
const OGRE_ID = testUuid(0xb01)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

async function moraleRoom(optionalCombatKinds: readonly ('MORALE' | 'DISARM')[]) {
  const ogre = seededSrdCreature('Ogre')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: ogre }),
      srdCreatureActor({ id: OGRE_ID, creature: ogre })
    ],
    ownerFeatureId: creatureFeature(ogre, 'Greatclub').id,
    optionalCombatKinds,
    rolls: [0]
  })
}

async function storedMorale(room: Awaited<ReturnType<typeof moraleRoom>>) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(({ id }) => id === OGRE_ID)
  const actor = readStoredRunActor(row!)
  return actor.kind === 'CHARACTER' ? undefined : actor.morale
}

async function moraleSave(room: Awaited<ReturnType<typeof moraleRoom>>) {
  return room.send({
    type: 'MORALE_SAVE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: OGRE_ID,
    triggerKind: 'INDIVIDUAL_SURPRISED',
    leaderActorId: null,
    overwhelmingOpposition: false,
    escapePossible: true,
    roll: { kind: 'AUTO_ROLL' },
    visibility: 'PUBLIC'
  })
}

describe('Morale in the native room (ENCOUNTER-6.1, 6.2)', () => {
  it('records a GM-declared check on the actor, then the GM’s confirmed outcome', async () => {
    const room = await moraleRoom(['MORALE'])
    const saved = await moraleSave(room)
    expect(saved.type, JSON.stringify(saved)).toBe('COMMAND_COMMITTED')
    const checked = await storedMorale(room)
    expect(checked).toMatchObject({
      triggerKind: 'INDIVIDUAL_SURPRISED',
      scope: 'SUBJECT',
      rollerActorId: OGRE_ID,
      disposition: null,
      firedTriggerKinds: ['INDIVIDUAL_SURPRISED']
    })
    expect(checked?.save?.rawFaces).toEqual([1])

    const confirmed = await room.send({
      type: 'CONFIRM_MORALE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: OGRE_ID,
      disposition: 'SURRENDER'
    })
    expect(confirmed.type, JSON.stringify(confirmed)).toBe('COMMAND_COMMITTED')
    expect(await storedMorale(room)).toMatchObject({ disposition: 'SURRENDER' })
  })

  it('refuses a check while the Morale rule is not on', async () => {
    const room = await moraleRoom(['DISARM'])
    const refused = await moraleSave(room)
    expect(refused.type).not.toBe('COMMAND_COMMITTED')
    expect(await storedMorale(room)).toBeUndefined()
  })
})

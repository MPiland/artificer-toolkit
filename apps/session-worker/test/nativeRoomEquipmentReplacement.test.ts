import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources
} from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const FIGHTER_ACTOR_ID = testUuid(0xd00)
const FIGHTER_ID = testUuid(0xd01)
const OGRE_ID = testUuid(0xd02)

/** The Ogre's Greatclub with a new identity: a current Equipment its Feature actions still fit. */
const compatibleGreatclub = {
  ...greatclub,
  id: testUuid(0xd10),
  label: 'Encounter Greatclub'
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Fighter and a seeded SRD Ogre. The Fighter carries `compatibleGreatclub`, which publishes it
 * (with the Club every room publishes) into the room's R2 content: the source a replacement reads.
 */
async function equipmentRoom() {
  const ogre = srdCreatureActor({ id: OGRE_ID, creature: seededSrdCreature('Ogre') })
  const room = await movementRoom({
    actors: [characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }), ogre],
    moverActorId: FIGHTER_ACTOR_ID,
    characterEquipment: [compatibleGreatclub]
  })
  const heldEntryId = snapshotCreatureEquipmentLoadout(ogre).find(
    (entry) => entry.useState === 'MAIN_HAND'
  )?.id
  if (!heldEntryId) throw new Error('The Ogre holds no main-hand item.')
  const stub = room.base.stub

  async function storedOgre() {
    const { actors } = await readRoomHistory(stub)
    const row = actors.find(({ id }) => id === OGRE_ID)
    if (!row) throw new Error('The stored Run holds no Ogre.')
    const actor = readStoredRunActor(row)
    if (actor.kind !== 'CREATURE') throw new Error('Expected a Creature actor.')
    return actor
  }
  const runVersion = async () => (await readRoomHistory(stub)).runs[0]!.version

  return {
    heldEntryId,
    storedOgre,
    runVersion,
    async replace(input: { equipmentId: string; actorId?: string; commandId?: string }) {
      const commandId = input.commandId ?? crypto.randomUUID()
      return room.send(commandId, {
        scope: 'ENCOUNTER',
        command: {
          type: 'REPLACE_CREATURE_EQUIPMENT',
          encounterId: room.encounterId,
          commandId,
          expectedVersion: await runVersion(),
          actorId: input.actorId ?? OGRE_ID,
          loadoutEntryId: heldEntryId,
          equipmentId: input.equipmentId
        }
      })
    }
  }
}

describe('REPLACE_CREATURE_EQUIPMENT in the room with R2-seeded Equipment (ROOM-6.10)', () => {
  it('pins the published replacement, advances the Run once, and replays without a second write', async () => {
    const room = await equipmentRoom()
    const before = await room.storedOgre()
    const versionBefore = await room.runVersion()
    const commandId = crypto.randomUUID()

    const answer = await room.replace({ equipmentId: compatibleGreatclub.id, commandId })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await room.runVersion()).toBe(versionBefore + 1)
    const after = await room.storedOgre()
    expect(snapshotCreatureEquipmentLoadout(after)).toMatchObject([
      { id: room.heldEntryId, equipmentId: compatibleGreatclub.id, useState: 'MAIN_HAND' }
    ])
    const [source] = snapshotCreatureEquipmentSources(after)
    expect(source).toMatchObject({
      loadoutEntryId: room.heldEntryId,
      equipmentId: compatibleGreatclub.id,
      payload: { id: compatibleGreatclub.id, label: compatibleGreatclub.label }
    })
    expect(source!.sourceChecksum).toBe(checksumRuleDocument(source!.payload))
    expect(after.currentHitPoints).toBe(before.currentHitPoints)

    const replay = await room.replace({ equipmentId: compatibleGreatclub.id, commandId })
    expect(replay.type, JSON.stringify(replay)).toBe('COMMAND_COMMITTED')
    expect(await room.runVersion()).toBe(versionBefore + 1)
  })

  it.each([
    { label: 'an Equipment the content does not publish', equipmentId: testUuid(0xd99) },
    {
      label: 'a published Equipment the Feature action does not fit',
      equipmentId: club.id
    }
  ])('refuses $label without a write', async ({ equipmentId }) => {
    const room = await equipmentRoom()
    const before = await room.storedOgre()
    const versionBefore = await room.runVersion()

    const answer = await room.replace({ equipmentId })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(await room.runVersion()).toBe(versionBefore)
    expect(await room.storedOgre()).toEqual(before)
  })

  it('refuses a Character actor', async () => {
    const room = await equipmentRoom()
    const versionBefore = await room.runVersion()

    const answer = await room.replace({
      actorId: FIGHTER_ACTOR_ID,
      equipmentId: compatibleGreatclub.id
    })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(await room.runVersion()).toBe(versionBefore)
  })
})

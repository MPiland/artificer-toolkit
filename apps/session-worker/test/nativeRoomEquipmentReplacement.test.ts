import { readStoredActorSnapshot } from '@artificer-toolkit/encounter-persistence/actorSnapshots'
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
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
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
 * and a Dagger (with the Club every room publishes) into the room's R2 content: the sources a
 * replacement reads.
 */
async function equipmentRoom() {
  const ogre = srdCreatureActor({ id: OGRE_ID, creature: seededSrdCreature('Ogre') })
  const room = await movementRoom({
    actors: [characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }), ogre],
    moverActorId: FIGHTER_ACTOR_ID,
    positions: { [FIGHTER_ACTOR_ID]: { x: 150, y: 150 }, [OGRE_ID]: { x: 250, y: 150 } },
    characterEquipment: [compatibleGreatclub, dagger]
  })
  const heldEntryId = snapshotCreatureEquipmentLoadout(ogre).find(
    (entry) => entry.useState === 'MAIN_HAND'
  )?.id
  if (!heldEntryId) throw new Error('The Ogre holds no main-hand item.')
  const stub = room.base.stub

  /** The Ogre as the room stores it, with the snapshot its record names. */
  async function storedOgre() {
    const { actors } = await readRoomHistory(stub)
    const row = actors.find(({ id }) => id === OGRE_ID)
    if (!row) throw new Error('The stored Run holds no Ogre.')
    const actor = readStoredRunActor(row)
    if (actor.kind !== 'CREATURE') throw new Error('Expected a Creature actor.')
    const snapshotRow = await runInDurableObject(stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage)
        .documents('encounterActorSnapshots')
        .find(({ checksum }) => checksum === actor.snapshotChecksum)
    )
    if (!snapshotRow) throw new Error('The Ogre’s snapshot is not stored.')
    return { ...actor, snapshot: readStoredActorSnapshot(snapshotRow) }
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
    const loadoutBefore = snapshotCreatureEquipmentLoadout(before)
    expect(snapshotCreatureEquipmentLoadout(after)).toEqual(
      loadoutBefore.map((entry) =>
        entry.id === room.heldEntryId ? { ...entry, equipmentId: compatibleGreatclub.id } : entry
      )
    )
    const source = snapshotCreatureEquipmentSources(after).find(
      ({ loadoutEntryId }) => loadoutEntryId === room.heldEntryId
    )
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
      equipmentId: dagger.id
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

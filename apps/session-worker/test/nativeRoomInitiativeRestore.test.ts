import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readSheetStreamVersion } from './placedZoneRoomReads.js'

/**
 * SPELLS-31 T5o: the ROLL_INITIATIVE passive RESTORE_RESOURCE outcome (SRD Monk Perfect Self, SRD
 * Bard Superior Inspiration) through the public START command of the real local room, read back
 * from the Character's own Sheet usage.
 */

const ACTOR_ID = testUuid(0x31a0)
const CHARACTER_ID = testUuid(0x31a1)
const WOLF_ID = testUuid(0x31a2)

afterEach(closeTrackedSockets)

/**
 * A level 20 Character of `characterClass` beside a Wolf, in a Run that has not started. The
 * Character starts with `used` of its class resource spent, and its low Dexterity keeps it from tying the Wolf, so no tie-break holds initiative open.
 */
function preparedRoom(characterClass: ClassAuthored, featureLabel: string | null, used: number) {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
      {
        ...characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      }
    ],
    characterClassFeatures: featureLabel
      ? [srdByLabel(characterClass.features ?? [], featureLabel)]
      : [],
    characterPlay: {
      characterClass,
      classLevel: 20,
      resourceUsage: [
        {
          owner: { kind: 'AUTHORED_GRANT', resourceGrantId: resourceGrantId(characterClass) },
          used
        }
      ],
      abilityScores: { DEXTERITY: 8, CHARISMA: 14 }
    },
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    status: 'PREPARED',
    autoRoll: 'EVERYONE',
    fallbackRoll: 10
  })
}
/** The id of the grant a Character's reconciliation records for the Class's own resource (the Builder's). */
const resourceGrantId = (characterClass: ClassAuthored) =>
  `resource:${characterClass.id}:${characterClass.resources!.id}`
type Room = Awaited<ReturnType<typeof preparedRoom>>

/** What the Character's Sheet holds as spent from the class resource `resourceId`. */
function usedOf(room: Room, characterClass: ClassAuthored) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === CHARACTER_ID)
    if (!play) throw new Error('Missing room Character play state.')
    const usage = readCharacterPlay(play).resourceUsage.find(
      ({ owner }) =>
        owner.kind === 'AUTHORED_GRANT' && owner.resourceGrantId === resourceGrantId(characterClass)
    )
    return usage?.used ?? 0
  })
}

async function start(room: Room, commandId = crypto.randomUUID()) {
  const command = {
    type: 'START',
    encounterId: room.room.encounterId,
    commandId,
    expectedVersion: await room.version()
  }
  const answer = await room.send(command)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return command
}

describe('a Character rolling initiative at the Run start (SPELLS-31 T5o)', () => {
  it('raises a Monk with no ki left to 4 ki (Perfect Self)', async () => {
    const room = await preparedRoom(monk, 'Perfect Self', 20)
    expect(await usedOf(room, monk)).toBe(20)

    await start(room)

    expect(await usedOf(room, monk)).toBe(16)
  })

  it('raises a Bard with no Bardic Inspiration left to 1 use (Superior Inspiration)', async () => {
    const room = await preparedRoom(bard, 'Superior Inspiration', 20)
    expect(await usedOf(room, bard)).toBe(20)

    await start(room)

    // A Charisma of 14 gives two uses; one is left.
    expect(await usedOf(room, bard)).toBe(1)
  })

  it('leaves a Monk with ki remaining untouched, writing nothing a Monk without Perfect Self would not', async () => {
    const without = await preparedRoom(monk, null, 5)
    await start(without)
    const baseline = await readSheetStreamVersion(without, CHARACTER_ID)
    closeTrackedSockets()

    const withFeature = await preparedRoom(monk, 'Perfect Self', 5)
    await start(withFeature)

    expect(await usedOf(withFeature, monk)).toBe(5)
    // The Run start itself advances the Sheet stream; the restore adds no write to it.
    expect(await readSheetStreamVersion(withFeature, CHARACTER_ID)).toBe(baseline)
  })
})

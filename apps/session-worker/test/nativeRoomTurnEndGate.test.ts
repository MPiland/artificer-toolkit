import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { blink } from '@artificer-toolkit/source-data/srd/spells/blink.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2h2 (D178): the SRD Blink, cast through a real room. A d20 at the end of the caster's
 * turn at 11 or higher takes the caster out of play until the start of their next turn; a lower
 * roll leaves them in play.
 */

const CHARACTER_ACTOR_ID = testUuid(0x7f4)
const CHARACTER_ID = testUuid(0x7f5)
const WOLF_ID = testUuid(0x7f6)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The Character (first in the order) who prepares Blink, then a Wolf. `roll` is the raw die draw,
 * zero-based: the turn-end d20 shows `roll + 1`.
 */
async function blinkRoom(roll: number) {
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    autoRoll: 'BOTH',
    rolls: [roll],
    fallbackRoll: 3,
    characterSpellcasting: { spells: [blink], prepared: [blink.id] },
    characterAction: (action) => action.label.startsWith(blink.label)
  })
  const cast = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
  return room
}

type BlinkRoom = Awaited<ReturnType<typeof blinkRoom>>

const characterAbsence = (room: BlinkRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('encounterRunActors')
      .find(({ id }) => id === CHARACTER_ACTOR_ID)
    if (!row) throw new Error('Expected the Character in the stored Run.')
    return readStoredRunActor(row).absence ?? null
  })

const heldEffectCount = async (room: BlinkRoom) =>
  (await readRoomHistory(room.room.base.stub)).characterEffects.length

describe('the SRD Blink in the room (SPELLS-4.T2h2)', () => {
  it('holds only the spell, and the caster in play, until the first turn ends', async () => {
    const room = await blinkRoom(14)
    expect(await heldEffectCount(room)).toBe(1)
    expect(await characterAbsence(room)).toBeNull()
  }, 120000)

  it('takes the caster out of play, still taking their turn, on an 11 or higher until their next turn starts', async () => {
    const room = await blinkRoom(14)
    await room.advanceTurn()
    expect(await characterAbsence(room)).toBe('EFFECT_KEEPS_TURN')
    expect(await heldEffectCount(room)).toBe(2)

    // The Wolf's turn ends and the caster's next turn starts: the absence ends, the spell remains.
    await room.advanceTurn()
    expect(await characterAbsence(room)).toBeNull()
    expect(await heldEffectCount(room)).toBe(1)
  }, 120000)

  it('leaves the caster in play on a roll under 11', async () => {
    const room = await blinkRoom(9)
    await room.advanceTurn()
    expect(await characterAbsence(room)).toBeNull()
    expect(await heldEffectCount(room)).toBe(1)
  }, 120000)
})

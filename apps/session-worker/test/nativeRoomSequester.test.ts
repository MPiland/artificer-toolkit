import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { sequester } from '@artificer-toolkit/source-data/srd/spells/sequester.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2a4 (D156): the SRD Sequester cast through a real room. The willing creature it touches
 * is Invisible until the spell is dispelled, through any number of turns, and the first damage it
 * takes ends the spell.
 */

const CHARACTER_ACTOR_ID = testUuid(0x7d0)
const CHARACTER_ID = testUuid(0x7d1)
const ALLY_ID = testUuid(0x7d2)
const WOLF_ID = testUuid(0x7d3)

/** No Scene measures the touch range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
/** A Wolf whose Bite hits for 3 damage. */
const attacker = biteWolf('ATTACK', { damage: 3 })

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Character (first in the order) who prepares Sequester, a friendly Wolf, then a hostile one. */
async function sequesterRoom() {
  const enemy = srdCreatureActor({ id: WOLF_ID, creature: attacker })
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: ALLY_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
      enemy
    ],
    autoRoll: 'BOTH',
    // An invisible target is attacked with disadvantage: two d20s, both the same, a hit.
    rolls: [14, 14],
    fallbackRoll: 0,
    characterSpellcasting: { spells: [sequester], prepared: [sequester.id] },
    characterAction: (action) => action.label.startsWith(sequester.label)
  })
  return { room, biteActionId: room.featureActionId(enemy, creatureFeature(attacker, 'Bite').id) }
}

async function allyInvisible(room: Awaited<ReturnType<typeof sequesterRoom>>['room']) {
  const history = await readRoomHistory(room.room.base.stub)
  return readActorConditionIds(history, ALLY_ID).includes(INVISIBLE_ID)
}

describe('the SRD Sequester in the room (SPELLS-4.T2a4)', () => {
  it('keeps the creature it touches Invisible as the rounds pass, until it takes damage', async () => {
    const { room, biteActionId } = await sequesterRoom()
    const cast = await room.startAction(ALLY_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await allyInvisible(room)).toBe(true)

    // A full round passes, and the hostile Wolf's turn opens.
    for (let turn = 0; turn < 5; turn += 1) await room.advanceTurn()
    expect(await allyInvisible(room)).toBe(true)

    const bite = await room.startAction(ALLY_ID, RANGE, null, null, biteActionId, WOLF_ID)
    expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')

    expect(await allyInvisible(room)).toBe(false)
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toEqual([])
  }, 120000)
})

import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { mageArmor } from '@artificer-toolkit/source-data/srd/spells/mage-armor.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionContext } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2a3 (D156): spells converted from closed rules to core options hold their grant in an
 * Encounter, where it counts against the creatures that act on its holder.
 */

const CHARACTER_ACTOR_ID = testUuid(0xa30)
const CHARACTER_ID = testUuid(0xa31)
const WOLF_ID = testUuid(0xa32)

/** No Scene measures the touch range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Character (first in the order) who prepares Mage Armor, then a Wolf whose Bite attacks. */
async function mageArmorRoom() {
  const wolf = biteWolf('ATTACK')
  const wolfActor = srdCreatureActor({ id: WOLF_ID, creature: wolf })
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      wolfActor
    ],
    characterSpellcasting: { spells: [mageArmor], prepared: [mageArmor.id] },
    characterAction: (action) => action.label.startsWith(mageArmor.label)
  })
  return { room, biteActionId: room.featureActionId(wolfActor, creatureFeature(wolf, 'Bite').id) }
}

/** On the Wolf's turn, the armor class its Bite at the Character must beat. */
async function biteArmorClass({ room, biteActionId }: Awaited<ReturnType<typeof mageArmorRoom>>) {
  await room.advanceTurn()
  const bite = await room.startAction(CHARACTER_ACTOR_ID, [], null, null, biteActionId, WOLF_ID)
  expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
  const context = await readPendingActionContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
    throw new Error('Expected the pending attack d20.')
  return context.d20Policy.dc
}

describe('room Mage Armor (SPELLS-4.T2a3)', () => {
  it('sets the unarmored Character’s armor class to 13 + Dexterity against a Wolf’s Bite', async () => {
    // Unarmored, the Character's armor class is 10 + Dexterity; Mage Armor makes the base 13.
    const unarmored = await biteArmorClass(await mageArmorRoom())

    const fixture = await mageArmorRoom()
    const cast = await fixture.room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')

    expect(await biteArmorClass(fixture)).toBe(unarmored + 3)
  }, 120000)
})

import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { guidingBolt } from '@artificer-toolkit/source-data/srd/spells/guiding-bolt.js'
import { mageArmor } from '@artificer-toolkit/source-data/srd/spells/mage-armor.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-4.T2a3 (D156): spells converted from closed rules to core options hold their grant in an
 * Encounter, where it counts against the creatures that act on its holder.
 */

const CHARACTER_ACTOR_ID = testUuid(0xa30)
const CHARACTER_ID = testUuid(0xa31)
const WOLF_ID = testUuid(0xa32)
const FIRST_ALLY_ID = testUuid(0xa33)
const SECOND_ALLY_ID = testUuid(0xa34)

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

type ActionRoom = Awaited<ReturnType<typeof actionRoom>>

/** Rolls and settles every roll the pending action asks for, in the mode the rules derived. */
async function settlePendingAction(room: ActionRoom) {
  const { stub } = room.room.base
  for (
    let decision = await readPendingActionDecision(stub);
    decision;
    decision = await readPendingActionDecision(stub)
  ) {
    expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(stub)).evidenceRolls.at(-1)
    if (!held || !('request' in decision.pending)) throw new Error('The roll was not held.')
    const settled = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: decision.pending.request.requestId,
      rollId: held.id
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
  }
}

describe('room Guiding Bolt (SPELLS-4.T2a3)', () => {
  it('gives the next attack against its target advantage, and the attack after it none', async () => {
    const wolf = biteWolf('ATTACK')
    const allies = [FIRST_ALLY_ID, SECOND_ALLY_ID].map((id) =>
      srdCreatureActor({ id, creature: wolf, disposition: 'FRIENDLY' })
    )
    const room = await actionRoom({
      // Guiding Bolt's d20 shows 19 and hits; every later die shows its minimum, so the bites miss.
      rolls: [18],
      fallbackRoll: 0,
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        ...allies,
        srdCreatureActor({ id: WOLF_ID, creature: wolf })
      ],
      characterSpellcasting: { spells: [guidingBolt], prepared: [guidingBolt.id] },
      characterAction: (action) => action.label.startsWith(guidingBolt.label)
    })
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)

    /** On the next ally's turn, the mode its Bite at the marked Wolf rolls in; the Bite then settles. */
    const biteRollMode = async (ally: (typeof allies)[number]) => {
      await room.advanceTurn()
      const bite = await room.startAction(
        WOLF_ID,
        [],
        null,
        null,
        room.featureActionId(ally, creatureFeature(wolf, 'Bite').id),
        ally.id
      )
      expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Bite d20.')
      const { rollMode } = decision.pending.request
      await settlePendingAction(room)
      return rollMode
    }
    // Both Bites come before the end of the caster's next turn; the first, a miss, uses the mark up.
    expect(await biteRollMode(allies[0]!)).toBe('ADVANTAGE')
    expect(await biteRollMode(allies[1]!)).toBe('NORMAL')
  }, 120000)
})

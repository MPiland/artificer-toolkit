import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { beaconOfHope } from '@artificer-toolkit/source-data/srd/spells/beacon-of-hope.js'
import { massHealingWord } from '@artificer-toolkit/source-data/srd/spells/mass-healing-word.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2n1 through the room: a creature under the SRD Beacon of Hope regains the maximum of
 * every healing die, and one without it rolls them.
 */

const CHARACTER_ACTOR_ID = testUuid(0x940)
const CHARACTER_ID = testUuid(0x942)
const HEALED_ID = testUuid(0x941)
const STARTING_HIT_POINTS = 1
/** The raw die is its face less one: a 1 on the d4 unless healing takes its maximum. */
const LOW_ROLL = 0
const SPELLCASTING_MODIFIER = 1

afterEach(() => {
  closeTrackedSockets()
})

/** The healed hit points after the Character casts Mass Healing Word, with or without Beacon of Hope. */
async function healedHitPoints(beacon: boolean) {
  const [grant] = beaconOfHope.effects ?? []
  if (!grant) throw new Error('The SRD Beacon of Hope has no effect.')
  const room = await actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({
        id: HEALED_ID,
        creature: plainWolf,
        currentHitPoints: STARTING_HIT_POINTS
      })
    ],
    characterSpellcasting: { spells: [massHealingWord], prepared: [massHealingWord.id] },
    characterPlay: { currentHitPoints: 1 },
    characterAction: (action) => action.label === 'Mass Healing Word (3rd level)',
    rolls: [LOW_ROLL],
    fallbackRoll: LOW_ROLL,
    ...(beacon && {
      seed: seedModifierGrant({
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: HEALED_ID,
        lifecycle: {},
        effect: grant,
        sourceLabel: beaconOfHope.label
      })
    })
  })
  const { answer } = await room.startActorsAction([HEALED_ID], ['TARGET_RANGE_UNCHECKED'], false)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return readActorHitPoints(await readRoomHistory(room.room.base.stub), HEALED_ID)
}

describe('Beacon of Hope maximizes the healing a creature receives (SPELLS-4.T2n1)', () => {
  it('rolls the healing die for a creature without the spell', async () => {
    expect(await healedHitPoints(false)).toBe(STARTING_HIT_POINTS + 1 + SPELLCASTING_MODIFIER)
  })

  it('heals the maximum of the die for a creature under the spell', async () => {
    expect(await healedHitPoints(true)).toBe(STARTING_HIT_POINTS + 4 + SPELLCASTING_MODIFIER)
  })
}, 120000)

import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { dispelEvilAndGood } from '@artificer-toolkit/source-data/srd/spells/dispel-evil-and-good.js'
import { holyAura } from '@artificer-toolkit/source-data/srd/spells/holy-aura.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-4.T2j2a: Holy Aura gives attack rolls against its holder disadvantage from any attacker;
 * Dispel Evil and Good does so only for celestials, elementals, fey, fiends and undead.
 */

const CHARACTER_ACTOR_ID = testUuid(0xd70)
const CHARACTER_ID = testUuid(0xd71)
const ATTACKER_ID = testUuid(0xd72)
const WARDED_ID = testUuid(0xd73)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const attackerOfType = (creatureType: string): CreatureAuthored => ({
  ...biteWolf('ATTACK'),
  creatureTypeId: creatureTypeId(creatureType)
})

/** Casts the spell at `holderId`, then returns the mode the attacker's Bite at it rolls in. */
async function biteRollMode(spell: typeof holyAura, holderId: string, attacker: CreatureAuthored) {
  const attackerActor = srdCreatureActor({
    id: ATTACKER_ID,
    creature: attacker,
    disposition: 'HOSTILE'
  })
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      attackerActor,
      srdCreatureActor({ id: WARDED_ID, creature: biteWolf('ATTACK'), disposition: 'FRIENDLY' })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label.startsWith(spell.label)
  })
  const cast =
    spell === holyAura
      ? await room.startActorsAction([holderId], ['TARGET_RANGE_UNCHECKED'])
      : await room.startAction(holderId, ['TARGET_RANGE_UNCHECKED'])
  expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
  await room.advanceTurn()
  const biteActionId = room.featureActionId(attackerActor, creatureFeature(attacker, 'Bite').id)
  const bite = await room.startAction(holderId, [], null, null, biteActionId, ATTACKER_ID)
  expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
  const prompt = await room.pendingDecision()
  if (prompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Bite d20.')
  return prompt.pending.request.rollMode
}

describe('room Holy Aura and Dispel Evil and Good (SPELLS-4.T2j2a)', () => {
  it('Holy Aura gives a humanoid’s attack on the holder disadvantage', async () => {
    expect(await biteRollMode(holyAura, WARDED_ID, attackerOfType('HUMANOID'))).toBe('DISADVANTAGE')
  }, 120000)

  it('Dispel Evil and Good gives a fiend’s attack on the holder disadvantage', async () => {
    expect(await biteRollMode(dispelEvilAndGood, CHARACTER_ACTOR_ID, attackerOfType('FIEND'))).toBe(
      'DISADVANTAGE'
    )
  }, 120000)

  it('Dispel Evil and Good leaves a humanoid’s attack on the holder normal', async () => {
    expect(
      await biteRollMode(dispelEvilAndGood, CHARACTER_ACTOR_ID, attackerOfType('HUMANOID'))
    ).toBe('NORMAL')
  }, 120000)
})

import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { protectionFromEvilAndGood } from '@artificer-toolkit/source-data/srd/spells/protection-from-evil-and-good.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-4.T2j1 (D179): Protection from Evil and Good gives attack rolls against its holder
 * disadvantage only when the attacker is a warded creature type.
 */

const CHARACTER_ACTOR_ID = testUuid(0xd60)
const CHARACTER_ID = testUuid(0xd61)
const ATTACKER_ID = testUuid(0xd62)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const attackerOfType = (creatureType: string): CreatureAuthored => ({
  ...biteWolf('ATTACK'),
  creatureTypeId: creatureTypeId(creatureType)
})

/** Casts the spell on its own caster, then returns the mode the attacker's Bite at the caster rolls in. */
async function biteRollMode(attacker: CreatureAuthored) {
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
      attackerActor
    ],
    characterSpellcasting: {
      spells: [protectionFromEvilAndGood],
      prepared: [protectionFromEvilAndGood.id]
    },
    characterAction: (action) => action.label.startsWith(protectionFromEvilAndGood.label)
  })
  const cast = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
  await room.advanceTurn()
  const biteActionId = room.featureActionId(attackerActor, creatureFeature(attacker, 'Bite').id)
  const bite = await room.startAction(CHARACTER_ACTOR_ID, [], null, null, biteActionId, ATTACKER_ID)
  expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
  const prompt = await room.pendingDecision()
  if (prompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Bite d20.')
  return prompt.pending.request.rollMode
}

describe('room Protection from Evil and Good (SPELLS-4.T2j1)', () => {
  it('gives a fiend’s attack on the holder disadvantage', async () => {
    expect(await biteRollMode(attackerOfType('FIEND'))).toBe('DISADVANTAGE')
  }, 120000)

  it('leaves a humanoid’s attack on the holder normal', async () => {
    expect(await biteRollMode(attackerOfType('HUMANOID'))).toBe('NORMAL')
  }, 120000)
})

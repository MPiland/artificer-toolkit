import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { foresight } from '@artificer-toolkit/source-data/srd/spells/foresight.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf, type BiteKind } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-4.T2a2 (D156 class A): SRD Foresight is authored from core Modifier Grants. In combat its
 * target has advantage on its saving throws, and creatures attacking it have disadvantage.
 */

const CASTER_ID = testUuid(0x8f0)
const CHARACTER_ID = testUuid(0x8f1)
const ATTACKING_WOLF_ID = testUuid(0x8f2)
const SAVE_WOLF_ID = testUuid(0x8f3)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const wolves = {
  ATTACK: srdCreatureActor({ id: ATTACKING_WOLF_ID, creature: biteWolf('ATTACK') }),
  SAVE: srdCreatureActor({ id: SAVE_WOLF_ID, creature: biteWolf('SAVE') })
} satisfies Record<BiteKind, unknown>

/** A Character who knows Foresight, then kind's Wolf. */
function foresightRoom(kind: BiteKind) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      wolves[kind]
    ],
    characterSpellcasting: { spells: [foresight], prepared: [foresight.id] },
    characterAction: (action) => action.label.startsWith('Foresight')
  })
}

type ForesightRoom = Awaited<ReturnType<typeof foresightRoom>>

/** Ends the current turn, then `kind`'s Wolf Bites the caster: the roll mode the room asks for. */
async function biteModeAgainstCaster(room: ForesightRoom, kind: BiteKind) {
  await room.advanceTurn()
  const wolf = wolves[kind]
  const bite = biteWolf(kind).features?.find((feature) => feature.label === 'Bite')
  if (!bite) throw new Error('The Wolf has a Bite.')
  const { answer } = await room.startAction(
    CASTER_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    room.featureActionId(wolf, bite.id),
    wolf.id
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (!('request' in decision.pending) || !('rollMode' in decision.pending.request))
    throw new Error('The Bite asks for a d20 roll.')
  return decision.pending.request.rollMode
}

describe('room Foresight (SPELLS-4.T2a2, D156)', () => {
  it.each([
    { kind: 'ATTACK' as const, roll: 'an attack against its target', mode: 'DISADVANTAGE' },
    { kind: 'SAVE' as const, roll: 'its target’s saving throw', mode: 'ADVANTAGE' }
  ])(
    'rolls $roll with $mode, and plainly without the spell',
    async ({ kind, mode }) => {
      const plain = await foresightRoom(kind)
      expect(await biteModeAgainstCaster(plain, kind)).toBe('NORMAL')

      const room = await foresightRoom(kind)
      const { answer } = await room.startAction(CASTER_ID, ['TARGET_RANGE_UNCHECKED'])
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect(await biteModeAgainstCaster(room, kind)).toBe(mode)
    },
    120000
  )
})

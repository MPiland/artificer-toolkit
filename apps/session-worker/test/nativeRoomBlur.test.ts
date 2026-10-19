import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { blur } from '@artificer-toolkit/source-data/srd/spells/blur.js'
import {
  SRD_TRUESIGHT_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-4.T2k1 (D156): Blur gives attack rolls against its caster disadvantage, except from an
 * attacker that sees the caster by Blindsight or Truesight.
 */

const CHARACTER_ACTOR_ID = testUuid(0xb10)
const CHARACTER_ID = testUuid(0xb11)
const WOLF_ID = testUuid(0xb12)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const truesightWolf = (): CreatureAuthored => ({
  ...biteWolf('ATTACK'),
  senses: [
    {
      senseDefinitionId: SRD_TRUESIGHT_SENSE_ID,
      range: { id: 'truesight-range', rangeKind: 'DISTANCE', amount: 120, unit: 'FEET' }
    }
  ]
})

/** The Character (first in the order) with Blur prepared, then a Wolf whose Bite attacks it. */
async function blurRoom(wolf: CreatureAuthored) {
  const wolfActor = srdCreatureActor({ id: WOLF_ID, creature: wolf, disposition: 'HOSTILE' })
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      wolfActor
    ],
    characterSpellcasting: { spells: [blur], prepared: [blur.id] },
    characterAction: (action) => action.label.startsWith(blur.label)
  })
  return { room, biteActionId: room.featureActionId(wolfActor, creatureFeature(wolf, 'Bite').id) }
}

/** Optionally casts Blur, then on the Wolf's turn the mode its Bite at the Character rolls in. */
async function biteRollMode(wolf: CreatureAuthored, { castBlur }: { castBlur: boolean }) {
  const { room, biteActionId } = await blurRoom(wolf)
  if (castBlur) {
    const cast = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
  }
  await room.advanceTurn()
  const bite = await room.startAction(CHARACTER_ACTOR_ID, [], null, null, biteActionId, WOLF_ID)
  expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
  const prompt = await room.pendingDecision()
  if (prompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Bite d20.')
  return prompt.pending.request.rollMode
}

describe('room Blur (SPELLS-4.T2k1)', () => {
  it('rolls a Wolf’s Bite at the Character normally without the spell', async () => {
    expect(await biteRollMode(biteWolf('ATTACK'), { castBlur: false })).toBe('NORMAL')
  }, 120000)

  it('gives the Bite disadvantage once the Character casts Blur', async () => {
    expect(await biteRollMode(biteWolf('ATTACK'), { castBlur: true })).toBe('DISADVANTAGE')
  }, 120000)

  it('leaves the Bite of a Wolf that sees the Character by Truesight normal', async () => {
    expect(await biteRollMode(truesightWolf(), { castBlur: true })).toBe('NORMAL')
  }, 120000)
})

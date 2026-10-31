import {
  characterActor,
  creatureFeature,
  creatureHoldingOnFailedSave,
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { crocodile } from '@artificer-toolkit/source-data/srd/creatures/crocodile.js'
import { mummy } from '@artificer-toolkit/source-data/srd/creatures/mummy.js'

const SOURCE_ID = testUuid(0x7b0)
const CHARACTER_ACTOR_ID = testUuid(0x7b1)
const CHARACTER_ID = testUuid(0x7b2)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The Mummy's Dreadful Glare save at the Character, holding it on a failure like the Crocodile's
 * Bite: the Character's save is asked, and the hold is the Character's only when the save fails.
 */
async function saveRoom() {
  const creature = creatureHoldingOnFailedSave({
    creature: installedSrdCreature(mummy),
    featureLabel: 'Dreadful Glare',
    holder: installedSrdCreature(crocodile),
    holderFeatureLabel: 'Bite'
  })
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(creature, 'Dreadful Glare').id,
    autoRoll: 'GAME_MASTER',
    fallbackRoll: 0
  })
}

describe('a hold gated on a failed save in the room (SPELLS-33.T6n4)', () => {
  it('holds the Character that fails the save', async () => {
    const room = await saveRoom()
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Character’s save.')
    expect(decision.pending.rollerActorId).toBe(CHARACTER_ACTOR_ID)
    await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: decision.pending.request.requestId,
      rawFaces: decision.pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: decision.pending.request.rollMode
    })

    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
  })

  it('leaves the Character that makes the save unheld', async () => {
    const room = await saveRoom()
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Character’s save.')
    await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: decision.pending.request.requestId,
      rawFaces: decision.pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: decision.pending.request.rollMode
    })

    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(0)
  })
})

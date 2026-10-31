import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SOURCE_ID = testUuid(0x7b0)
const CHARACTER_ACTOR_ID = testUuid(0x7b1)
const CHARACTER_ID = testUuid(0x7b2)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A creature's save action at the Character: the Character's save is asked, the creature's damage
 * dice roll automatically, and the hold is the Character's only when the save fails.
 */
async function saveRoom(creatureLabel: string, featureLabel: string) {
  const creature = seededSrdCreature(creatureLabel)
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(creature, featureLabel).id,
    autoRoll: 'GAME_MASTER',
    fallbackRoll: 0
  })
}

describe('a hold gated on a failed save in the room (SPELLS-33.T6n4)', () => {
  it.each([
    { creature: 'Water Elemental', feature: 'Whelm (Recharge 4-6)' },
    { creature: 'Gelatinous Cube', feature: 'Engulf' }
  ])(
    'holds the Character that fails the $creature $feature save',
    async ({ creature, feature }) => {
      const room = await saveRoom(creature, feature)
      const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected the Character’s save.')
      expect(decision.pending.rollerActorId).toBe(CHARACTER_ACTOR_ID)
      await room.resolve(decision, {
        kind: 'ENTER_DICE',
        requestId: decision.pending.request.requestId,
        rawFaces: decision.pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
        rollMode: decision.pending.request.rollMode
      })

      expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
    }
  )

  it.each([
    { creature: 'Water Elemental', feature: 'Whelm (Recharge 4-6)' },
    { creature: 'Gelatinous Cube', feature: 'Engulf' }
  ])(
    'leaves the Character that makes the $creature $feature save unheld',
    async ({ creature, feature }) => {
      const room = await saveRoom(creature, feature)
      const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected the Character’s save.')
      await room.resolve(decision, {
        kind: 'ENTER_DICE',
        requestId: decision.pending.request.requestId,
        rawFaces: decision.pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
        rollMode: decision.pending.request.rollMode
      })

      expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(0)
    }
  )
})

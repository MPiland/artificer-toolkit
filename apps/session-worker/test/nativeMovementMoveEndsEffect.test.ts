import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { endTriggerEffectSeed, INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5n: an effect that lasts until its holder moves (`ON_MOVE`) ends in the same commit as
 * the holder's voluntary move, with the condition it alone held.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe50)
const FIGHTER_ID = testUuid(0xe51)
const WOLF_ID = testUuid(0xe52)
const EFFECT_ID = testUuid(0x5651)
const WOLF_START: ScenePoint = { x: 450, y: 450 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

async function hiddenWolfMoves(endEvents: readonly ('ON_MOVE' | 'ON_TAKE_ACTION')[]) {
  const room = await movementRoom({
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, conditionIds: [INVISIBLE_ID] })
    ],
    moverActorId: WOLF_ID,
    positions: { [FIGHTER_ACTOR_ID]: { x: 1250, y: 1250 }, [WOLF_ID]: WOLF_START },
    seed: endTriggerEffectSeed({
      effectId: EFFECT_ID,
      holderActorId: WOLF_ID,
      sourceActorId: WOLF_ID,
      triggers: endEvents.map((code) => ({ event: 'LIFECYCLE', timing: 'END', code }))
    })
  })
  const moved = await room.move([WOLF_START, { x: 550, y: 450 }])
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  const history = await readRoomHistory(room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id),
    invisible: readActorConditionIds(history, WOLF_ID).includes(INVISIBLE_ID)
  }
}

describe('a voluntary move by the holder of an effect that lasts until it moves (SPELLS-31.T5n)', () => {
  it('ends the effect and its condition', async () => {
    expect(await hiddenWolfMoves(['ON_MOVE', 'ON_TAKE_ACTION'])).toEqual({
      effectIds: [],
      invisible: false
    })
  }, 60_000)

  it('keeps an effect that ends only when its holder takes an action', async () => {
    expect(await hiddenWolfMoves(['ON_TAKE_ACTION'])).toEqual({
      effectIds: [EFFECT_ID],
      invisible: true
    })
  }, 60_000)
})

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
import { reactionClub } from './reactionClubFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-27.T4b: an opportunity attack that damages the mover ends the damage-triggered effects the
 * mover holds, with the condition each alone held, in the same commit as the damage.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe40)
const FIGHTER_ID = testUuid(0xe41)
const WOLF_ID = testUuid(0xe42)
const EFFECT_ID = testUuid(0x5641)
const WOLF_START: ScenePoint = { x: 150, y: 150 }
const anyone = { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null } as const

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The invisible Wolf walks out of the Fighter's reach; the Fighter's opportunity attack rolls `attackRoll`. */
async function opportunityAttackRoom(attackRoll: number) {
  const room = await movementRoom({
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, conditionIds: [INVISIBLE_ID] })
    ],
    moverActorId: WOLF_ID,
    positions: { [FIGHTER_ACTOR_ID]: { x: 50, y: 150 }, [WOLF_ID]: WOLF_START },
    autoRoll: 'BOTH',
    characterEquipment: [reactionClub],
    // An invisible target is attacked with disadvantage: two d20s, both the same.
    rolls: [attackRoll, attackRoll],
    fallbackRoll: 0,
    seed: endTriggerEffectSeed({
      effectId: EFFECT_ID,
      holderActorId: WOLF_ID,
      sourceActorId: WOLF_ID,
      triggers: [anyone]
    })
  })
  const moved = await room.move([WOLF_START, { x: 450, y: 150 }])
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  return room
}

async function held(room: Awaited<ReturnType<typeof opportunityAttackRoom>>) {
  const history = await readRoomHistory(room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id),
    invisible: readActorConditionIds(history, WOLF_ID).includes(INVISIBLE_ID)
  }
}

describe('an opportunity attack against the holder of a damage-triggered effect (SPELLS-27.T4b)', () => {
  it('ends the effect and its condition when the attack damages the mover', async () => {
    const room = await opportunityAttackRoom(18)

    expect(await held(room)).toEqual({ effectIds: [], invisible: false })
  }, 60_000)

  it('keeps the effect when the attack misses', async () => {
    const room = await opportunityAttackRoom(1)

    expect(await held(room)).toEqual({ effectIds: [EFFECT_ID], invisible: true })
  }, 60_000)
})

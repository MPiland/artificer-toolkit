import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  oncePerTurnSneakAttack,
  withFixedRiderDice
} from '@artificer-toolkit/rules-runtime/testing/unconditionalSneakAttack'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xf00)
const FIGHTER_ID = testUuid(0xf01)
const WOLF_ID = testUuid(0xf02)

/** The 1d6 the rider adds, rolling a 3. */
const RIDER_DAMAGE = 3

const extraAttack = (() => {
  const feature = fighter.features?.find(({ label }) => label === 'Extra Attack')
  if (!feature) throw new Error('The SRD Fighter has no Extra Attack Feature.')
  return feature
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A level 5 Fighter with Extra Attack (two attacks a turn) and a homebrew once-per-turn 1d6 rider.
 * Each attack rolls a hit (d20 15) and a Club d4 of 1; a rider that is owed takes the next roll
 * (a 3 on its d6), so the queue lists the rider's roll only after the attacks that earn it.
 */
function fighterRoom(rolls: readonly number[]) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls,
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterPlay: { equipped: true, classLevel: 5 },
    characterClassFeatures: [
      extraAttack,
      withFixedRiderDice(oncePerTurnSneakAttack(testUuid(0xf10)), testUuid(0xf11), '1d6')
    ],
    characterAction: (action) => action.label.includes('Club')
  })
}

type Room = Awaited<ReturnType<typeof fighterRoom>>

async function wolfHitPoints(room: Room) {
  const wolf = vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WOLF_ID)
  if (wolf?.currentHitPoints === undefined) throw new Error('The Wolf holds no hit points.')
  return wolf.currentHitPoints
}

/** One Club attack on the Wolf, and the hit points it took. */
async function attackWolf(room: Room) {
  const before = await wolfHitPoints(room)
  const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return before - (await wolfHitPoints(room))
}

async function undo(room: Room) {
  const answer = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('a once-per-turn rider across the attacks of one turn, in the room (D119 f)', () => {
  it('adds its dice to the first hit only, and keeps the use spent when a later hit is undone', async () => {
    // Roll queue, in the order the attacks consume it: [d20, d4, d6] for the first attack (the
    // rider's d6 shows 3), [d20, d4] for the second and for its retry after the undo.
    const room = await fighterRoom([14, 0, 2, 14, 0, 14, 0])

    const first = await attackWolf(room)
    const second = await attackWolf(room)
    expect(first - second).toBe(RIDER_DAMAGE)

    await undo(room)
    expect(await attackWolf(room)).toBe(second)
  })

  it('gives the use back when the hit that spent it is undone', async () => {
    const room = await fighterRoom([14, 0, 2, 14, 0, 2])

    const first = await attackWolf(room)
    await undo(room)
    expect(await attackWolf(room)).toBe(first)
  })
})

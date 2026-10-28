import {
  srdCreatureActor,
  creatureFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { tokenPositions, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

/**
 * ATTACK-5.T1: Balor Whip, Kraken Lightning Storm and Purple Worm Tail Stinger run in the room from
 * the generic options their stat blocks author. A token is 100 px, a cell 5 ft.
 */

const SOURCE_ID = testUuid(0xc00)
const TARGET_ID = testUuid(0xc01)
const SECOND_TARGET_ID = testUuid(0xc02)
const SOURCE_AT: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

const hitPointsOf = async (room: Awaited<ReturnType<typeof monsterRoom>>, actorId = TARGET_ID) => {
  const row = vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === actorId)
  if (row?.currentHitPoints === undefined) throw new Error('The target holds no hit points.')
  return row.currentHitPoints
}

async function monsterRoom(input: {
  monster: string
  feature: string
  target: string
  targetAt: ScenePoint
  rolls: number[]
  /** A second creature standing at this point. */
  second?: { creature: string; at: ScenePoint }
}) {
  const monster = seededSrdCreature(input.monster)
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: monster }),
      srdCreatureActor({ id: TARGET_ID, creature: seededSrdCreature(input.target) }),
      ...(input.second
        ? [
            srdCreatureActor({
              id: SECOND_TARGET_ID,
              creature: seededSrdCreature(input.second.creature)
            })
          ]
        : [])
    ],
    positions: {
      [SOURCE_ID]: SOURCE_AT,
      [TARGET_ID]: input.targetAt,
      ...(input.second && { [SECOND_TARGET_ID]: input.second.at })
    },
    ownerFeatureId: creatureFeature(monster, input.feature).id,
    autoRoll: 'GAME_MASTER',
    rolls: input.rolls,
    fallbackRoll: 0
  })
}

describe('a Balor’s Whip in the room (ATTACK-5.2)', () => {
  it('pulls a target that fails its Strength save 25 feet toward the Balor', async () => {
    // A hit (19), the damage dice at their minimum (2d6 and 3d6), then a failed save (1).
    const room = await monsterRoom({
      monster: 'Balor',
      feature: 'Whip',
      target: 'Veteran',
      targetAt: { x: 750, y: 150 },
      rolls: [18, 0, 0, 0, 0, 0, 0]
    })
    const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    committed(answer)
    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 250, y: 150 })
    expect(tokenPositions(room)(SOURCE_ID)).toEqual(SOURCE_AT)
  })
})

describe('a Purple Worm’s Tail Stinger in the room (ATTACK-5.9)', () => {
  const stinger = async (saveFace: number) => {
    // A hit (19), the piercing dice at their minimum (3d6 + 9), the Constitution save, then 12d6 poison at 1s.
    const room = await monsterRoom({
      monster: 'Purple Worm',
      feature: 'Tail Stinger',
      target: 'Veteran',
      targetAt: { x: 350, y: 150 },
      rolls: [18, 0, 0, 0, saveFace]
    })
    const before = await hitPointsOf(room)
    const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    committed(answer)
    return before - (await hitPointsOf(room))
  }

  it('adds the full 12d6 poison when the target fails its Constitution save', async () => {
    expect(await stinger(0)).toBe(12 + 12)
  })

  it('adds half the poison when the target passes its Constitution save', async () => {
    expect(await stinger(19)).toBe(12 + 6)
  })
})

describe('a Kraken’s Lightning Storm in the room (ATTACK-5.8)', () => {
  const storm = async (saveFaces: [number, number], second = 'Bandit Captain') => {
    // Both targets' Dexterity saves roll first; every later die falls to the minimum (4d10 is 4, half 2).
    const room = await monsterRoom({
      monster: 'Kraken',
      feature: 'Lightning Storm',
      target: 'Veteran',
      targetAt: { x: 1350, y: 150 },
      // A Bandit Captain's +5 or an Assassin's +6 Dexterity save can meet the DC 23 on a natural 20; a Veteran's cannot.
      second: { creature: second, at: { x: 1350, y: 350 } },
      rolls: saveFaces
    })
    const before = [await hitPointsOf(room), await hitPointsOf(room, SECOND_TARGET_ID)]
    const { answer } = await room.startActorsAction([TARGET_ID, SECOND_TARGET_ID])
    committed(answer)
    return [
      before[0]! - (await hitPointsOf(room)),
      before[1]! - (await hitPointsOf(room, SECOND_TARGET_ID))
    ]
  }

  it('strikes each chosen target with a bolt, full damage on a failed Dexterity save', async () => {
    expect(await storm([0, 0])).toEqual([4, 4])
  })

  it('halves a bolt’s damage against a target that passes its save', async () => {
    expect(await storm([0, 19])).toEqual([4, 2])
  })

  // SPELLS-33.T5afp: the Assassin's Evasion takes none on a passed save for half and half on a failed one.
  it('halves the bolt against an Assassin with Evasion that fails its save', async () => {
    expect(await storm([0, 0], 'Assassin')).toEqual([4, 2])
  })

  it('spares an Assassin with Evasion that passes its save', async () => {
    expect(await storm([0, 19], 'Assassin')).toEqual([4, 0])
  })
})

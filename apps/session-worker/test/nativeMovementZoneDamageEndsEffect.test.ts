import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { endTriggerEffectSeed, INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readActorConditionIds, readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-14.T2b: the damage a zone deals a creature as it moves ends the damage-triggered effects
 * that creature holds, with the condition each alone held, in the move's own commit.
 */

const WOLF_ID = testUuid(0xe52)
const EFFECT_ID = testUuid(0x5651)
const WOLF_START: ScenePoint = { x: 150, y: 150 }
/** Each covers one cell of the row the Wolf walks along and deals 1 damage. */
const firstZone = { center: { x: 350, y: 150 }, radius: 50 }
const secondZone = { center: { x: 550, y: 150 }, radius: 50, variant: 1 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Wolf holds SRD Invisibility until it takes damage, then walks `path` past `zones`. */
async function zoneWalk(
  zones: NonNullable<Parameters<typeof movementRoom>[0]['spatialEffects']>,
  path: ScenePoint[]
) {
  const room = await movementRoom({
    actors: [srdCreatureActor({ id: WOLF_ID, creature: plainWolf, conditionIds: [INVISIBLE_ID] })],
    moverActorId: WOLF_ID,
    positions: { [WOLF_ID]: WOLF_START },
    autoRoll: 'GAME_MASTER',
    spatialEffects: zones,
    seed: endTriggerEffectSeed({
      effectId: EFFECT_ID,
      holderActorId: WOLF_ID,
      sourceActorId: WOLF_ID,
      triggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }]
    })
  })
  const hitPointsBefore = readActorHitPoints(await readRoomHistory(room.base.stub), WOLF_ID)
  const moved = await room.move(path)
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  const history = await readRoomHistory(room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id),
    invisible: readActorConditionIds(history, WOLF_ID).includes(INVISIBLE_ID),
    damageTaken: hitPointsBefore - readActorHitPoints(history, WOLF_ID)
  }
}

describe('zone damage against a mover holding a damage-triggered effect (QUALITY-14.T2b)', () => {
  it('ends the effect and its condition when a zone damages the mover', async () => {
    expect(await zoneWalk([firstZone], [WOLF_START, { x: 450, y: 150 }])).toEqual({
      effectIds: [],
      invisible: false,
      damageTaken: 1
    })
  }, 60_000)

  it('ends the effect once when two zones damage the mover in one move', async () => {
    expect(await zoneWalk([firstZone, secondZone], [WOLF_START, { x: 650, y: 150 }])).toEqual({
      effectIds: [],
      invisible: false,
      damageTaken: 2
    })
  }, 60_000)

  it('keeps the effect when the move crosses no zone', async () => {
    expect(await zoneWalk([firstZone], [WOLF_START, { x: 150, y: 350 }])).toEqual({
      effectIds: [EFFECT_ID],
      invisible: true,
      damageTaken: 0
    })
  }, 60_000)
})

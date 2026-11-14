import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-14.T2c: the damage a zone deals a creature as it moves owes that creature the repeat save
 * its effect offers on damage (D167), at the contact, like the damage of an action.
 */

const WOLF_ID = testUuid(0xe61)
const CASTER_ID = testUuid(0xe62)
const LAUGHTER_EFFECT_ID = testUuid(0x5661)
const WOLF_START: ScenePoint = { x: 150, y: 150 }
/** Each covers one cell of the row the Wolf walks along and deals 1 damage. */
const firstZone = { center: { x: 350, y: 150 }, radius: 50 }
const secondZone = { center: { x: 550, y: 150 }, radius: 50, variant: 1 }
const PAST_FIRST_ZONE = [WOLF_START, { x: 450, y: 150 }]
const PAST_BOTH_ZONES = [WOLF_START, { x: 650, y: 150 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Wolf holds SRD Hideous Laughter, cast by another Wolf, beside `zones`. */
function laughingRoom(
  zones: NonNullable<Parameters<typeof movementRoom>[0]['spatialEffects']>,
  dice: Pick<Parameters<typeof movementRoom>[0], 'autoRoll' | 'rolls' | 'fallbackRoll'>
) {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
      srdCreatureActor({ id: CASTER_ID, creature: plainWolf })
    ],
    moverActorId: WOLF_ID,
    positions: { [WOLF_ID]: WOLF_START, [CASTER_ID]: { x: 150, y: 950 } },
    spatialEffects: zones,
    ...dice,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedTimedCondition({
        encounterId,
        sourceActorId: CASTER_ID,
        holderActorId: WOLF_ID,
        spell: hideousLaughter,
        lifetimeScope: 'ENCOUNTER'
      })
      await effects.create({
        id: LAUGHTER_EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: WOLF_ID },
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
}

/** The repeat-save check outputs, one per check the Run settled. */
function repeatSaveChecks(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [execution.applicationOutputs]
      : []
  })
}

/** What the Run holds once the Wolf's move has committed. */
async function settled(room: Awaited<ReturnType<typeof laughingRoom>>, hitPointsBefore: number) {
  const history = await readRoomHistory(room.base.stub)
  return {
    outcomes: repeatSaveChecks(history).map(({ outcome }) => outcome),
    laughing: history.activeEffects.some(({ id }) => id === LAUGHTER_EFFECT_ID),
    damageTaken: hitPointsBefore - readActorHitPoints(history, WOLF_ID),
    pending: await room.pending()
  }
}

/** The Wolf walks `path`; every die the room rolls shows `face`. */
async function rolledWalk(
  zones: Parameters<typeof laughingRoom>[0],
  path: ScenePoint[],
  face: number,
  rolls?: readonly number[]
) {
  const room = await laughingRoom(zones, {
    autoRoll: 'GAME_MASTER',
    fallbackRoll: face - 1,
    ...(rolls ? { rolls } : {})
  })
  const hitPointsBefore = readActorHitPoints(await readRoomHistory(room.base.stub), WOLF_ID)
  const moved = await room.move(path)
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  return settled(room, hitPointsBefore)
}

describe('zone damage against a mover holding a damage repeat save (QUALITY-14.T2c)', () => {
  it('ends the effect when the mover makes the save its zone damage owes', async () => {
    expect(await rolledWalk([firstZone], PAST_FIRST_ZONE, 20)).toEqual({
      outcomes: ['SAVE_SUCCESS'],
      laughing: false,
      damageTaken: 1,
      pending: null
    })
  }, 60_000)

  it('keeps the effect when the mover fails the save', async () => {
    expect(await rolledWalk([firstZone], PAST_FIRST_ZONE, 1)).toEqual({
      outcomes: ['SAVE_FAILURE'],
      laughing: true,
      damageTaken: 1,
      pending: null
    })
  }, 60_000)

  it('owes one save per damaging contact while the effect lasts', async () => {
    expect(await rolledWalk([firstZone, secondZone], PAST_BOTH_ZONES, 1)).toEqual({
      outcomes: ['SAVE_FAILURE', 'SAVE_FAILURE'],
      laughing: true,
      damageTaken: 2,
      pending: null
    })
  }, 60_000)

  it('owes no save at a later contact once a made save ended the effect', async () => {
    expect(await rolledWalk([firstZone, secondZone], PAST_BOTH_ZONES, 20)).toEqual({
      outcomes: ['SAVE_SUCCESS'],
      laughing: false,
      damageTaken: 2,
      pending: null
    })
  }, 60_000)

  it('owes no save when the move crosses no zone', async () => {
    expect(await rolledWalk([firstZone], [WOLF_START, { x: 150, y: 350 }], 20)).toEqual({
      outcomes: [],
      laughing: true,
      damageTaken: 0,
      pending: null
    })
  }, 60_000)
})

describe('a zone damage repeat save nobody auto-rolls (QUALITY-14.T2c)', () => {
  /** The Wolf walks into the zone and the move waits on its save. */
  async function pausedAtSave() {
    const room = await laughingRoom([firstZone], {})
    const hitPointsBefore = readActorHitPoints(await readRoomHistory(room.base.stub), WOLF_ID)
    const moved = await room.move(PAST_FIRST_ZONE)
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    const asked = await room.pendingFor(true)
    if (asked?.kind !== 'D20_EVIDENCE')
      throw new Error(`Expected a repeat save, got ${asked?.kind}.`)
    // The damage trigger carries Advantage, and the damaged holder rolls.
    expect(asked).toMatchObject({
      rollerActorId: WOLF_ID,
      request: { min: 1, max: 20, rollMode: 'ADVANTAGE' }
    })
    // The save is not settled while the move waits.
    expect(repeatSaveChecks(await readRoomHistory(room.base.stub))).toEqual([])
    return { room, hitPointsBefore, request: asked.request }
  }

  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS', laughing: false },
    { face: 1, outcome: 'SAVE_FAILURE', laughing: true }
  ])(
    'settles the entered dice as $outcome and finishes the move',
    async (expected) => {
      const { room, hitPointsBefore, request } = await pausedAtSave()
      const answered = await room.respond({
        kind: 'ENTER_DICE',
        requestId: request.requestId,
        rawFaces: [expected.face, expected.face],
        rollMode: request.rollMode
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
      expect(await settled(room, hitPointsBefore)).toEqual({
        outcomes: [expected.outcome],
        laughing: expected.laughing,
        damageTaken: 1,
        pending: null
      })
    },
    60_000
  )
})

import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { CONCENTRATION_STATE_ID } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2d2 (D160): the source of an effect held by a creature is offered to move it once that
 * creature drops to 0 hit points, taken as a Bonus Action within the offer's range. The spell is
 * the SRD Hunter's Mark as authored; nothing here or in the product names it.
 */

const SOURCE_ID = testUuid(0xc60)
const MARKED_ID = testUuid(0xc61)
const NEXT_ID = testUuid(0xc62)
const DEFEATED_ID = testUuid(0xc63)

/** No Scene measures the offer's range unless the command names one (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The source (acting, concentrating) marked `MARKED_ID`, which is at `markedHitPoints`. */
async function markedRoom(
  markedHitPoints: number,
  options: { positions?: Record<string, { x: number; y: number }> } = {}
) {
  const wolf = biteWolf('ATTACK')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: wolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({
        id: MARKED_ID,
        creature: wolf,
        currentHitPoints: markedHitPoints
      }),
      srdCreatureActor({ id: NEXT_ID, creature: wolf }),
      srdCreatureActor({ id: DEFEATED_ID, creature: wolf, currentHitPoints: 0, defeated: true })
    ],
    ownerFeatureId: creatureFeature(wolf, 'Bite').id,
    positions: options.positions,
    concentration: true,
    concentrationOwnerActorId: SOURCE_ID,
    seed: seedModifierGrant({
      sourceActorId: SOURCE_ID,
      holderActorId: MARKED_ID,
      lifecycle: {},
      effect: huntersMark.effects?.[0],
      maintainedEffectStateId: CONCENTRATION_STATE_ID
    })
  })
}

type Room = Awaited<ReturnType<typeof markedRoom>>

async function heldMark(room: Room) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.map(({ id, targetActorId, lifecycle, maintainedEffectStateId }) => ({
    id,
    targetActorId,
    remainingTicks: lifecycle.remainingTicks,
    maintainedEffectStateId
  }))
}

async function moveCommand(
  room: Room,
  effectId: string,
  targetActorId: string,
  extras: { acknowledgedWarnings?: EncounterRuleWarningCodeDto[]; sceneContext?: unknown } = {}
) {
  return room.send({
    type: 'MOVE_HELD_EFFECT',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: SOURCE_ID,
    effectId,
    offerIndex: 0,
    target: { kind: 'ACTOR', actorId: targetActorId },
    acknowledgedWarnings: extras.acknowledgedWarnings ?? RANGE,
    sceneContext: extras.sceneContext ?? null
  })
}

async function undo(room: Room) {
  return room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
}

describe('room move of a held effect (SPELLS-4.T2d2)', () => {
  it('lists the offer only while the holder is at 0 hit points', async () => {
    const healthy = await markedRoom(11)
    expect((await healthy.actionChoices()).effectOffers).toEqual([])

    const dropped = await markedRoom(0)
    const [held] = await heldMark(dropped)
    expect((await dropped.actionChoices()).effectOffers).toEqual([
      expect.objectContaining({
        effectId: held!.id,
        offerIndex: 0,
        kind: 'MOVE_HELD_EFFECT',
        holderActorId: MARKED_ID,
        activation: 'BONUS_ACTION',
        range: { amount: 90, unit: 'FEET' }
      })
    ])
  }, 120000)

  it('moves the same effect, with its duration and Concentration, to the new holder, and an undo puts it back', async () => {
    const room = await markedRoom(0)
    const [before] = await heldMark(room)
    expect(before?.targetActorId).toBe(MARKED_ID)

    const moved = await moveCommand(room, before!.id, NEXT_ID)
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await heldMark(room)).toEqual([{ ...before, targetActorId: NEXT_ID }])
    expect((await readRoomHistory(room.room.base.stub)).maintainedStates).toHaveLength(1)
    const last = (await readRoomHistory(room.room.base.stub)).commands.at(-1)
    expect(last).toMatchObject({ commandType: 'MOVE_HELD_EFFECT' })
    // The offer no longer holds: its new holder is not at 0 hit points.
    expect((await room.actionChoices()).effectOffers).toEqual([])

    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await heldMark(room)).toEqual([before])
    expect((await room.actionChoices()).effectOffers).toHaveLength(1)
  }, 120000)

  it('refuses an undo once anything happened since the move', async () => {
    const room = await markedRoom(0)
    const [before] = await heldMark(room)
    expect((await moveCommand(room, before!.id, NEXT_ID)).type).toBe('COMMAND_COMMITTED')
    await room.advanceTurn()

    const refused = await undo(room)
    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused)).toContain('REVERT_UNAVAILABLE')
    expect((await heldMark(room)).map(({ targetActorId }) => targetActorId)).toEqual([NEXT_ID])
  }, 120000)

  it('refuses a stale offer, a defeated holder and the old holder, changing nothing', async () => {
    const room = await markedRoom(0)
    const [held] = await heldMark(room)
    const history = await readRoomHistory(room.room.base.stub)

    const stale = await moveCommand(room, testUuid(0xc6f), NEXT_ID)
    expect(stale.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(stale)).toContain('SOURCE_REQUIREMENTS_NOT_MET')
    const defeated = await moveCommand(room, held!.id, DEFEATED_ID)
    expect(defeated.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(defeated)).toContain('TARGET_UNAVAILABLE')
    const same = await moveCommand(room, held!.id, MARKED_ID)
    expect(same.type).toBe('COMMAND_REJECTED')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(history)
  }, 120000)

  it('warns when the new holder is beyond the offer’s range, and moves it once acknowledged', async () => {
    // 90 feet is 1,800 px at the room's 100 px per 5 feet; the next holder stands far past it.
    const room = await markedRoom(0, { positions: { [NEXT_ID]: { x: 150 + 2_400, y: 150 } } })
    const [held] = await heldMark(room)
    const sceneContext = room.sceneContext(2)

    const refused = await moveCommand(room, held!.id, NEXT_ID, {
      acknowledgedWarnings: [],
      sceneContext
    })
    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused)).toContain('TARGET_OUT_OF_RANGE')
    expect((await heldMark(room))[0]?.targetActorId).toBe(MARKED_ID)

    const accepted = await moveCommand(room, held!.id, NEXT_ID, {
      acknowledgedWarnings: ['TARGET_OUT_OF_RANGE'],
      sceneContext
    })
    expect(accepted.type, JSON.stringify(accepted)).toBe('COMMAND_COMMITTED')
    expect((await heldMark(room))[0]?.targetActorId).toBe(NEXT_ID)
  }, 120000)
})

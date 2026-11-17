import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { oilFlask } from '@artificer-toolkit/source-data/srd/equipment/oil-flask.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones, revertLastAction, walkerMoves } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3w: the SRD Oil (flask) poured on the ground places an unlit zone. It burns no one
 * until the GM lights it; lit, it deals 5 fire damage to a creature that enters it or ends its turn
 * in it, only once per turn.
 */

const POURER_ACTOR_ID = testUuid(0x3d00)
const POURER_ID = testUuid(0x3d01)
const WOLF_ID = testUuid(0x3d02)

const OIL_POINT = { x: 250, y: 150 }
const OUTSIDE_THE_OIL = { x: 250, y: 650 }
const BURN = 5

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof oilRoom>>

/** The player's Character carries the SRD oil and pours it; the Wolf stands away from the oil. */
function oilRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: POURER_ACTOR_ID, characterId: POURER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: POURER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [WOLF_ID]: OUTSIDE_THE_OIL },
    characterEquipment: [oilFlask],
    characterAction: (action) =>
      action.label.startsWith(oilFlask.label) && action.attackBonus === undefined,
    autoRoll: 'EVERYONE'
  })
}

async function pourOil(room: Room) {
  const { answer } = await room.startAreaAction(OIL_POINT)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const [zone, ...others] = await readZones(room)
  expect(others).toEqual([])
  if (!zone) throw new Error('The pour left no zone.')
  return zone
}

async function igniteCommand(room: Room, spatialEffectId: string) {
  return {
    type: 'IGNITE_ZONE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    spatialEffectId
  }
}

async function advanceTurn(room: Room) {
  const commandId = crypto.randomUUID()
  const answer = await room.send({
    type: 'ADVANCE_TURN',
    encounterId: room.room.encounterId,
    commandId,
    expectedVersion: await room.version()
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function zoneApplicationsOf(room: Room) {
  const [run] = (await readRoomHistory(room.room.base.stub)).runs
  if (!run) throw new Error('The room holds no Run.')
  return readRunState(run).zoneApplications
}

describe('SRD Oil (flask) poured on the ground (QUALITY-15.T3w)', () => {
  it('burns no one until the GM lights it, then once per turn on entering or ending the turn in it', async () => {
    const room = await oilRoom()
    const zone = await pourOil(room)
    expect(zone.spatialState).toMatchObject({ unlit: true })
    expect(zone.placement).toMatchObject({
      triggerModes: ['ENTER', 'CROSS'],
      turnTriggers: ['END_OF_TURN'],
      maxApplicationsPerTurn: 1
    })
    const hitPointsBefore = (await hitPointsOf(room, WOLF_ID)) ?? 0

    // The Wolf's turn: it walks into the unlit oil and out again, untouched.
    await advanceTurn(room)
    expect((await walkerMoves(room, [OUTSIDE_THE_OIL, OIL_POINT])).executions).toEqual([])
    await walkerMoves(room, [OIL_POINT, OUTSIDE_THE_OIL])
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)

    // Only the GM lights the oil.
    expect(await room.sendAsPlayer(await igniteCommand(room, zone.id))).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'GM_ONLY'
    })
    const lit = await room.send(await igniteCommand(room, zone.id))
    expect(lit.type, JSON.stringify(lit)).toBe('COMMAND_COMMITTED')
    expect((await readZones(room))[0]?.spatialState).not.toHaveProperty('unlit')
    expect(await room.send(await igniteCommand(room, zone.id))).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })

    // Lit, the oil burns the Wolf entering it.
    const entering = await walkerMoves(room, [OUTSIDE_THE_OIL, OIL_POINT])
    expect(entering.executions).toEqual([
      expect.objectContaining({
        applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: BURN })]
      })
    ])
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore - BURN)

    // Ending the same turn in the oil burns it no more: the limit covers both of its triggers.
    await advanceTurn(room)
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore - BURN)
    expect(await zoneApplicationsOf(room)).toEqual({
      [`${zone.id}:${WOLF_ID}`]: expect.objectContaining({ count: 1 })
    })
  })

  it('burns out 2 of its pourer’s turns after the GM lights it, however long it waited', async () => {
    const room = await oilRoom()
    const zone = await pourOil(room)
    /** One round: the Wolf's turn, then the pourer's, whose start counts the burn down. */
    const nextRound = async () => {
      await advanceTurn(room)
      await advanceTurn(room)
    }

    await nextRound()
    await nextRound()
    expect((await readZones(room))[0]?.lifecycle).toMatchObject({ remainingTicks: 2 })

    const lit = await room.send(await igniteCommand(room, zone.id))
    expect(lit.type, JSON.stringify(lit)).toBe('COMMAND_COMMITTED')
    await nextRound()
    expect((await readZones(room))[0]?.lifecycle).toMatchObject({ remainingTicks: 1 })
    await nextRound()
    expect(await readZones(room)).toEqual([])
  })

  it('puts the oil out again when the GM undoes the lighting', async () => {
    const room = await oilRoom()
    const zone = await pourOil(room)
    const lit = await room.send(await igniteCommand(room, zone.id))
    expect(lit.type, JSON.stringify(lit)).toBe('COMMAND_COMMITTED')

    await revertLastAction(room)

    expect((await readZones(room))[0]?.spatialState).toMatchObject({ unlit: true })
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)
    await advanceTurn(room)
    expect((await walkerMoves(room, [OUTSIDE_THE_OIL, OIL_POINT])).executions).toEqual([])
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
  })
})

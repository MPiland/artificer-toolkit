import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { huntingTrap } from '@artificer-toolkit/source-data/srd/equipment/hunting-trap.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones, revertLastAction, walkerMoves } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3aa3: the real SRD Hunting Trap, set by a Character at a point, is a placed-space zone
 * that holds the creature failing its entry save as restrained until a Strength check reaches DC 13.
 */

const SETTER_ACTOR_ID = testUuid(0x2700)
const SETTER_ID = testUuid(0x2701)
const WALKER_ID = testUuid(0x2702)

/** The 5 ft square the trap covers: centred one cell from the setter, who stands at x = 150. */
const TRAP_POINT = { x: 250, y: 150 }
const WALKER_START = { x: 450, y: 150 }
const WALK_INTO = [WALKER_START, TRAP_POINT]
const RESTRAINED_ID = conditionTypeId('RESTRAINED')

/** Every die shows its lowest face unless `rolls` leads with others: the save fails, damage is 1. */
const DIE = 0
/** A first draw of 19 shows a 20 on the entry save, which succeeds. */
const SAVE_SUCCEEDS = [19]
/** The save fails on a 1, the damage die shows a 1 and the escape check shows a 20. */
const SAVE_FAILS_THEN_ESCAPES = [0, 0, 19]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function trapRoom(rolls: readonly number[] = []) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: SETTER_ACTOR_ID, characterId: SETTER_ID }),
        snapshot: { kind: 'CHARACTER', id: SETTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WALKER_ID, creature: plainWolf })
    ],
    positions: { [WALKER_ID]: WALKER_START },
    characterEquipment: [huntingTrap],
    characterAction: (action) => action.label === huntingTrap.label,
    autoRoll: 'EVERYONE',
    rolls,
    fallbackRoll: DIE
  })
}

type Room = Awaited<ReturnType<typeof trapRoom>>

async function setTrap(room: Room) {
  const { answer } = await room.startAreaAction(TRAP_POINT)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The room after the trap is set and the Wolf's turn has begun. */
async function trapSetRoom(rolls?: readonly number[]) {
  const room = await trapRoom(rolls)
  await setTrap(room)
  await room.advanceTurn()
  return room
}

async function conditionsOf(room: Room) {
  return vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WALKER_ID)
    ?.conditions
}

/** The Wolf's effects, through which the trap holds its condition, with their definitions. */
async function heldEffectsOf(room: Room) {
  return (await readRoomHistory(room.room.base.stub)).activeEffects
    .filter(({ targetActorId }) => targetActorId === WALKER_ID)
    .map(({ id, definitionJson }) => ({ id, definition: JSON.parse(definitionJson) }))
}

async function escape(room: Room) {
  const [held] = await heldEffectsOf(room)
  if (!held) throw new Error('The trap holds no condition.')
  return room.send({
    type: 'ESCAPE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: WALKER_ID,
    activeEffectId: held.id,
    checkDefinitionId: SRD_ABILITY_DEFINITION_IDS.STRENGTH,
    acknowledgedWarnings: []
  })
}

describe('setting the Hunting Trap', () => {
  it('stores one 5 ft zone at the chosen point with the authored label', async () => {
    const room = await trapRoom()
    await setTrap(room)

    const zones = await readZones(room)
    expect(zones).toHaveLength(1)
    expect(zones[0]?.placement).toMatchObject({
      label: 'Hunting trap',
      triggerModes: ['ENTER', 'CROSS'],
      heldCondition: { conditionId: RESTRAINED_ID, escape: { dc: { kind: 'FIXED', value: 13 } } }
    })
  })

  it('takes the trap back with the Action when the GM undoes it', async () => {
    const room = await trapRoom()
    await setTrap(room)

    await revertLastAction(room)

    expect(await readZones(room)).toEqual([])
  })
})

describe('stepping on the Hunting Trap', () => {
  it('holds a creature that fails the save, restrained and hurt, where it stopped', async () => {
    const room = await trapSetRoom()
    const hitPointsBefore = await hitPointsOf(room, WALKER_ID)

    const walk = await walkerMoves(room, WALK_INTO)

    expect(walk.executions[0]).toMatchObject({
      execution: { movementInterruption: { kind: 'STOP' } }
    })
    expect(walk.terminalPosition.x).toBeGreaterThan(TRAP_POINT.x)
    expect(await hitPointsOf(room, WALKER_ID)).toBe((hitPointsBefore ?? 0) - 1)
    expect(await conditionsOf(room)).toEqual([{ conditionTypeId: RESTRAINED_ID }])
    const [zone] = await readZones(room)
    const [held, ...others] = await heldEffectsOf(room)
    expect(others).toEqual([])
    expect(held?.definition).toMatchObject({
      stateContributions: [
        {
          kind: 'CONDITION_OWNERSHIP',
          conditionId: RESTRAINED_ID,
          heldBySpatialEffectId: zone?.id
        },
        { kind: 'CONDITION_ESCAPE', label: 'Hunting trap' }
      ]
    })
  })

  it('lets a creature that makes the save walk on, unhurt and unheld', async () => {
    const room = await trapSetRoom(SAVE_SUCCEEDS)
    const hitPointsBefore = await hitPointsOf(room, WALKER_ID)

    const walk = await walkerMoves(room, WALK_INTO)

    expect(walk.terminalPosition).toEqual(TRAP_POINT)
    expect(await hitPointsOf(room, WALKER_ID)).toBe(hitPointsBefore)
    expect(await conditionsOf(room)).toEqual([])
    expect(await heldEffectsOf(room)).toEqual([])
  })

  it('frees the held creature when its Strength check reaches DC 13', async () => {
    const room = await trapSetRoom(SAVE_FAILS_THEN_ESCAPES)
    await walkerMoves(room, WALK_INTO)
    expect(await conditionsOf(room)).toEqual([{ conditionTypeId: RESTRAINED_ID }])

    const answer = await escape(room)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectsOf(room)).toEqual([])
    expect(await conditionsOf(room)).toEqual([])
    expect(await readZones(room)).toHaveLength(1)
  })

  it('keeps the creature held when its Strength check misses', async () => {
    const room = await trapSetRoom()
    await walkerMoves(room, WALK_INTO)

    await escape(room)

    expect(await conditionsOf(room)).toEqual([{ conditionTypeId: RESTRAINED_ID }])
    expect(await heldEffectsOf(room)).toHaveLength(1)
  })

  it('holds the creature again when the GM undoes its escape', async () => {
    const room = await trapSetRoom(SAVE_FAILS_THEN_ESCAPES)
    await walkerMoves(room, WALK_INTO)
    const [held] = await heldEffectsOf(room)
    await escape(room)
    expect(await heldEffectsOf(room)).toEqual([])

    await revertLastAction(room)

    expect(await conditionsOf(room)).toEqual([{ conditionTypeId: RESTRAINED_ID }])
    expect((await heldEffectsOf(room)).map(({ id }) => id)).toEqual([held?.id])
  })
})

import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { spatialGeometryCenter } from '@artificer-toolkit/shared/vtt/spatialGeometryCenter'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID as ACTION,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID as BONUS_ACTION
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { flamingSphere } from '@artificer-toolkit/source-data/srd/spells/flaming-sphere.js'
import { moonbeam } from '@artificer-toolkit/source-data/srd/spells/moonbeam.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones, revertLastAction } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3y8: the caster moves a zone it maintains by the zone's authored move. The SRD Flaming
 * Sphere moves 30 feet for a Bonus Action and Moonbeam 60 feet for an Action, as authored from core
 * options; nothing here or in the product names either spell. 5 feet is 100 Scene units.
 */

const CASTER_ACTOR_ID = testUuid(0x2480)
const CASTER_ID = testUuid(0x2481)
const OTHER_ID = testUuid(0x2482)

const ZONE_CENTER = { x: 200, y: 600 }
const TWENTY_FIVE_FEET_EAST = { x: 700, y: 600 }
const THIRTY_FEET_EAST = { x: 800, y: 600 }
const THIRTY_FIVE_FEET_EAST = { x: 900, y: 600 }
/** Past 30 feet from the cast point, wherever on its square the zone is centered. */
const FORTY_FEET_EAST = { x: 1000, y: 600 }
const AWAY = { x: 950, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function zoneRoom(spell: SpellAuthored, castLabel: string, otherAt = AWAY, creature = plainWolf) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: OTHER_ID, creature })
    ],
    positions: { [OTHER_ID]: otherAt },
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label === castLabel,
    autoRoll: 'EVERYONE',
    fallbackRoll: 0
  })
}

type Room = Awaited<ReturnType<typeof zoneRoom>>

async function castZone(room: Room) {
  const { answer } = await room.startAreaAction(ZONE_CENTER)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const [zone] = await readZones(room)
  if (!zone) throw new Error('The cast left no zone.')
  return zone
}

async function moveZone(
  room: Room,
  zoneId: string,
  destination: { x: number; y: number },
  actorId = CASTER_ACTOR_ID
) {
  return room.send({
    type: 'MOVE_ZONE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId,
    spatialEffectId: zoneId,
    destination,
    acknowledgedWarnings: []
  })
}

async function zoneCenter(room: Room) {
  const [zone] = await readZones(room)
  if (!zone) throw new Error('The zone is gone.')
  return spatialGeometryCenter(zone.placement.geometry.shape)
}

async function spentOf(room: Room, actorId: string) {
  return vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === actorId)
    ?.spent
}

describe('a caster moving its Flaming Sphere (QUALITY-15.T3y8)', () => {
  const castLabel = 'Flaming Sphere (2nd level)'

  it('compiles the authored move onto the placed zone', async () => {
    const zone = await castZone(await zoneRoom(flamingSphere, castLabel))
    expect(zone.placement.move).toEqual({
      activation: 'BONUS_ACTION',
      maxDistance: { amount: 30, unit: 'FEET' }
    })
  }, 120000)

  it('moves the sphere up to 30 feet for its Bonus Action, and an undo puts it back with the Bonus Action', async () => {
    const room = await zoneRoom(flamingSphere, castLabel)
    const zone = await castZone(room)
    const castCenter = await zoneCenter(room)
    expect(await spentOf(room, CASTER_ACTOR_ID)).not.toContainEqual([BONUS_ACTION, 1])

    const moved = await moveZone(room, zone.id, TWENTY_FIVE_FEET_EAST)

    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await zoneCenter(room)).toEqual(TWENTY_FIVE_FEET_EAST)
    expect(await spentOf(room, CASTER_ACTOR_ID)).toContainEqual([BONUS_ACTION, 1])
    expect((await readRoomHistory(room.room.base.stub)).commands.at(-1)).toMatchObject({
      commandType: 'MOVE_ZONE'
    })

    await revertLastAction(room)

    expect(await zoneCenter(room)).toEqual(castCenter)
    expect((await readZones(room))[0]?.placement).toEqual(zone.placement)
    expect(await spentOf(room, CASTER_ACTOR_ID)).not.toContainEqual([BONUS_ACTION, 1])
  }, 120000)

  it('refuses a move past 30 feet, changing nothing', async () => {
    const room = await zoneRoom(flamingSphere, castLabel)
    const zone = await castZone(room)
    const history = await readRoomHistory(room.room.base.stub)

    const refused = await moveZone(room, zone.id, FORTY_FEET_EAST)

    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused)).toContain('TARGET_UNAVAILABLE')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(history)
  }, 120000)

  it('asks for the spent Bonus Action to be overridden before a second move that turn', async () => {
    const room = await zoneRoom(flamingSphere, castLabel)
    const zone = await castZone(room)
    expect((await moveZone(room, zone.id, TWENTY_FIVE_FEET_EAST)).type).toBe('COMMAND_COMMITTED')

    const refused = await moveZone(room, zone.id, ZONE_CENTER)

    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused)).toContain('RULE_WARNINGS')
    expect(await zoneCenter(room)).toEqual(TWENTY_FIVE_FEET_EAST)
  }, 120000)

  it('refuses a creature that did not place the sphere, on its own turn', async () => {
    const room = await zoneRoom(flamingSphere, castLabel)
    const zone = await castZone(room)
    await room.advanceTurn()
    const history = await readRoomHistory(room.room.base.stub)

    const refused = await moveZone(room, zone.id, TWENTY_FIVE_FEET_EAST, OTHER_ID)

    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused)).toContain('SOURCE_REQUIREMENTS_NOT_MET')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(history)
  }, 120000)

  it('acts on a creature it was moved beside when that creature ends its turn there', async () => {
    // The Bear stands 5 feet east of the destination: clear of the cube around the cast point, and
    // sharing area with the cube around the destination (150 units each side of its center).
    const room = await zoneRoom(flamingSphere, castLabel, THIRTY_FEET_EAST, brownBear)
    const zone = await castZone(room)
    expect((await moveZone(room, zone.id, TWENTY_FIVE_FEET_EAST)).type).toBe('COMMAND_COMMITTED')
    const hitPointsBefore = await hitPointsOf(room, OTHER_ID)

    // The caster's turn ends; the Bear's turn starts and ends beside the moved sphere.
    await room.advanceTurn()
    await room.advanceTurn()

    // 2d6 fire, every die a 1, on the failed save.
    expect(await hitPointsOf(room, OTHER_ID)).toBe((hitPointsBefore ?? 0) - 2)
  }, 120000)
})

describe('a caster moving its Moonbeam (QUALITY-15.T3y8)', () => {
  const castLabel = 'Moonbeam (2nd level)'

  it('moves the beam up to 60 feet for its Action on a later turn', async () => {
    const room = await zoneRoom(moonbeam, castLabel)
    const zone = await castZone(room)
    expect(zone.placement.move).toEqual({
      activation: 'ACTION',
      maxDistance: { amount: 60, unit: 'FEET' }
    })
    // The caster's turn ends; the Wolf's passes; the caster's next turn starts.
    await room.advanceTurn()
    await room.advanceTurn()
    expect(await spentOf(room, CASTER_ACTOR_ID)).not.toContainEqual([ACTION, 1])

    const moved = await moveZone(room, zone.id, THIRTY_FIVE_FEET_EAST)

    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await zoneCenter(room)).toEqual(THIRTY_FIVE_FEET_EAST)
    expect(await spentOf(room, CASTER_ACTOR_ID)).toContainEqual([ACTION, 1])
  }, 120000)
})

import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { wallOfFire } from '@artificer-toolkit/source-data/srd/spells/wall-of-fire.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { choiceOptionIdOf, hitPointsOf, readZones, walkerMoves } from './placedZoneRoomReads.js'

/**
 * SPELLS-4.T1b (D154): the SRD Wall of Fire, cast through a real room as the straight wall or the
 * ring its caster picks. The caster draws the wall between two ends or the ring out from its
 * center; a creature entering or crossing the fire, or ending its turn in it, takes the damage with
 * no save.
 */

const CASTER_ACTOR_ID = testUuid(0x2540)
const CASTER_ID = testUuid(0x2541)
const WOLF_ID = testUuid(0x2542)

/** Every die the room rolls shows its lowest face: 5d8 deals 5. */
const DIE = 0
const FIRE_DAMAGE = 5

/** 5 feet is 100 Scene units: the 1-foot wall is 20 units thick and the 60-foot one 1200 long. */
const STRAIGHT = choiceOptionIdOf(wallOfFire, 'Straight Wall')
const RINGED = choiceOptionIdOf(wallOfFire, 'Ringed Wall')
/** A 30-foot wall standing north to south across the middle of the map. */
const WALL = { kind: 'WALL', from: { x: 500, y: 300 }, to: { x: 500, y: 900 } } as const
const WEST_OF_THE_WALL = { x: 300, y: 600 }
const EAST_OF_THE_WALL = { x: 750, y: 600 }
/** The 10-foot ring around the middle of the map: its band runs 180 to 200 units out. */
const RING = { kind: 'RING', center: { x: 600, y: 600 }, outerRadius: 200 } as const

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof actionRoom>>

function wallRoom(wolfAt: { x: number; y: number }) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [WOLF_ID]: wolfAt },
    characterSpellcasting: { spells: [wallOfFire], prepared: [wallOfFire.id] },
    characterAction: (action) => action.label === 'Wall of Fire (4th level)',
    autoRoll: 'EVERYONE',
    fallbackRoll: DIE
  })
}

async function placed(room: Room, target: Parameters<Room['startAreaCommand']>[0]) {
  const { answer } = await room.startAreaCommand(target)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const [zone, ...others] = await readZones(room)
  expect(others).toEqual([])
  if (!zone) throw new Error('The cast left no zone.')
  return zone
}

describe('the SRD Wall of Fire drawn as a straight wall (SPELLS-4.T1b, D154)', () => {
  it('stands between the two ends drawn, its thickness centered on them', async () => {
    const room = await wallRoom(WEST_OF_THE_WALL)

    const zone = await placed(room, { ...WALL, choiceOptionId: STRAIGHT })

    expect(zone.placement).toMatchObject({
      anchorKind: 'FIXED',
      label: 'Wall of Fire',
      triggerModes: ['ENTER', 'CROSS'],
      turnTriggers: ['END_OF_TURN'],
      maxApplicationsPerTurn: 1,
      blockingRules: ['BLOCKS_SIGHT'],
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: {
          kind: 'POLYGON',
          points: [
            { x: 490, y: 300 },
            { x: 490, y: 900 },
            { x: 510, y: 900 },
            { x: 510, y: 300 }
          ]
        }
      }
    })
  })

  it('burns a creature that walks through it, with no save', async () => {
    const room = await wallRoom(WEST_OF_THE_WALL)
    await placed(room, { ...WALL, choiceOptionId: STRAIGHT })
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const walk = await walkerMoves(room, [WEST_OF_THE_WALL, EAST_OF_THE_WALL])

    expect(walk.terminalPosition).toEqual(EAST_OF_THE_WALL)
    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: FIRE_DAMAGE })]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - FIRE_DAMAGE)
  })

  it('burns a creature that ends its turn in it', async () => {
    const room = await wallRoom({ x: 500, y: 600 })
    await placed(room, { ...WALL, choiceOptionId: STRAIGHT })
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    // The caster's turn ends, then the Wolf's turn ends in the fire.
    await room.advanceTurn()
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
    await room.advanceTurn()

    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - FIRE_DAMAGE)
  })
})

describe('the SRD Wall of Fire drawn as a ring (SPELLS-4.T1b, D154)', () => {
  it('rings the center out to the radius drawn, hollow by all but its thickness', async () => {
    const room = await wallRoom(RING.center)

    const zone = await placed(room, { ...RING, choiceOptionId: RINGED })

    expect(zone.placement).toMatchObject({
      label: 'Wall of Fire Ring',
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: { kind: 'RING', center: RING.center, outerRadius: 200, innerRadius: 180 }
      }
    })
  })

  it('burns a creature that walks out of the hollow through the ring', async () => {
    const room = await wallRoom(RING.center)
    await placed(room, { ...RING, choiceOptionId: RINGED })
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const walk = await walkerMoves(room, [RING.center, { x: 950, y: 600 }])

    expect(walk.executions).toHaveLength(1)
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - FIRE_DAMAGE)
  })
})

describe('the SRD Wall of Fire refuses what its option does not allow (SPELLS-4.T1b, D154)', () => {
  it.each([
    {
      name: 'a ring drawn for the straight wall',
      target: { ...RING, choiceOptionId: STRAIGHT },
      message: 'This action must be drawn as a wall between two points.'
    },
    {
      name: 'a wall drawn for the ring',
      target: { ...WALL, choiceOptionId: RINGED },
      message: 'This action must be drawn as a ring around a point.'
    },
    {
      name: 'a wall longer than 60 feet',
      target: {
        kind: 'WALL' as const,
        from: { x: 50, y: 950 },
        to: { x: 950, y: 50 },
        choiceOptionId: STRAIGHT
      },
      message: 'This area is larger than the action allows.'
    },
    {
      name: 'a ring wider than 20 feet',
      target: { ...RING, outerRadius: 201, choiceOptionId: RINGED },
      message: 'This area is larger than the action allows.'
    },
    {
      name: 'a ring no wider than its own wall',
      target: { ...RING, outerRadius: 20, choiceOptionId: RINGED },
      message: 'This area is too small to place.'
    }
  ])('refuses $name and leaves no zone', async ({ target, message }) => {
    const room = await wallRoom(WEST_OF_THE_WALL)

    const { answer } = await room.startAreaCommand(target)

    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message
    })
    expect(await readZones(room)).toEqual([])
  })
})

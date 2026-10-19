import { runInDurableObject } from 'cloudflare:test'

import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plantGrowth } from '@artificer-toolkit/source-data/srd/spells/plant-growth.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readZones, walkerMoves } from './placedZoneRoomReads.js'

/**
 * SPELLS-4.T2a4 (D156): the SRD Plant Growth cast through a real room. Its overgrowth is a zone with
 * no save or trigger that costs 4 feet of movement for every foot moved through it, and as an
 * Instantaneous spell with no Concentration it stays until the GM removes it.
 */

const CASTER_ACTOR_ID = testUuid(0x7f0)
const CASTER_ID = testUuid(0x7f1)
const WOLF_ID = testUuid(0x7f2)

/** 5 feet is 100 Scene units on the 1000-unit map, all inside the 100-foot radius. */
const ZONE_CENTER = { x: 600, y: 600 }
/** A 5-foot step: 20 feet of the Wolf's 40 through the overgrowth. */
const WOLF_START = { x: 500, y: 600 }
const WOLF_END = { x: 600, y: 600 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof plantGrowthRoom>>

const plantGrowthRoom = () =>
  actionRoom({
    actors: [
      // A turn change reads the Character's frozen identity.
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [WOLF_ID]: WOLF_START },
    characterSpellcasting: { spells: [plantGrowth], prepared: [plantGrowth.id] },
    characterAction: (action) => action.label.startsWith('Plant Growth')
  })

async function cast(room: Room) {
  const { answer } = await room.startAreaCommand({ kind: 'POINT', point: ZONE_CENTER })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function wolfFeetMoved(room: Room) {
  const movements = await runInDurableObject(room.room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
  )
  return movements
    .filter(({ actorId }) => actorId === WOLF_ID)
    .reduce((total, { usedFeet }) => total + usedFeet, 0)
}

describe('the SRD Plant Growth in the room (SPELLS-4.T2a4)', () => {
  it('places an overgrowth that no Concentration maintains and that stays as the rounds pass', async () => {
    const room = await plantGrowthRoom()
    await cast(room)

    for (let turn = 0; turn < 4; turn += 1) await room.advanceTurn()

    const [zone, ...others] = await readZones(room)
    expect(others).toEqual([])
    expect(zone?.maintainedEffectStateId).toBeNull()
    expect(zone?.placement).toMatchObject({
      label: 'Plant Growth',
      triggerModes: [],
      movementCostMultiplier: 4
    })
  })

  it('charges a creature 4 feet of movement for every foot it moves through the overgrowth', async () => {
    const plain = await plantGrowthRoom()
    await plain.advanceTurn()
    await walkerMoves(plain, [WOLF_START, WOLF_END])
    const plainFeet = await wolfFeetMoved(plain)

    const room = await plantGrowthRoom()
    await cast(room)
    await room.advanceTurn()
    await walkerMoves(room, [WOLF_START, WOLF_END])

    expect(plainFeet).toBeGreaterThan(0)
    expect(await wolfFeetMoved(room)).toBeCloseTo(plainFeet * 4)
  })
})

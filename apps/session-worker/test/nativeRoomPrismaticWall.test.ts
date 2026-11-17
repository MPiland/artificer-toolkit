import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { prismaticWall } from '@artificer-toolkit/source-data/srd/spells/prismatic-wall.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { choiceOptionIdOf, readZones } from './placedZoneRoomReads.js'

/**
 * QUALITY-15.T3v7: the real SRD Prismatic Wall row, compiled and cast through a real room. The sphere
 * places its seven layers and its proximity halo as records of one zone, refuses an occupied space and
 * spends the casting when it does, and its layers fall to the GM in order from red to violet.
 */

const CASTER_ACTOR_ID = testUuid(0x25b0)
const CASTER_ID = testUuid(0x25b1)
const BEAR_ID = testUuid(0x25b2)

const CENTER = { x: 600, y: 600 }
const OUTSIDE = { x: 1400, y: 600 }
const LAYER_COUNT = 7

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function wallRoom(bearAt: { x: number; y: number }) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: BEAR_ID, creature: brownBear })
    ],
    positions: { [BEAR_ID]: bearAt },
    characterSpellcasting: { spells: [prismaticWall], prepared: [prismaticWall.id] },
    characterAction: (action) => action.label === 'Prismatic Wall (9th level)',
    autoRoll: 'EVERYONE',
    fallbackRoll: 0
  })
}

type Room = Awaited<ReturnType<typeof wallRoom>>

const castSphere = (room: Room) =>
  room.startAreaCommand({
    kind: 'POINT',
    point: CENTER,
    choiceOptionId: choiceOptionIdOf(prismaticWall, 'Sphere')
  })

const readSpellSlots = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CASTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).spellSlots ?? []
  })

/** The wall's layer records, red first; the proximity halo carries no layer destruction. */
async function placedLayers(room: Room) {
  const zones = await readZones(room)
  return {
    zones,
    layers: zones
      .filter(({ placement }) => placement.destruction !== undefined)
      .sort((left, right) => (left.placement.layerIndex ?? 0) - (right.placement.layerIndex ?? 0))
  }
}

describe('the SRD Prismatic Wall cast through a room (QUALITY-15.T3v7)', () => {
  it('places seven layers and a proximity halo as records of one lasting zone', async () => {
    const room = await wallRoom(OUTSIDE)

    const { answer } = await castSphere(room)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { zones, layers } = await placedLayers(room)
    expect(zones).toHaveLength(LAYER_COUNT + 1)
    expect(layers.map(({ placement }) => placement.layerIndex)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // No Concentration holds it: every layer lasts the wall's 10 minutes, 100 of its caster's turns.
    for (const { lifecycle } of layers) expect(lifecycle.remainingTicks).toBe(100)
    const [red] = layers
    expect(red?.placement.destruction).toMatchObject({ inOrder: true })
  })

  it('refuses a placement over a creature and spends the casting', async () => {
    const room = await wallRoom(CENTER)

    const { answer } = await castSphere(room)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readZones(room)).toEqual([])
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:9', used: 1 }])
  })

  it('lets the GM destroy the layers only in order, red first', async () => {
    const room = await wallRoom(OUTSIDE)
    await castSphere(room)
    const { layers } = await placedLayers(room)
    const [red, orange] = layers
    const destroy = async (spatialEffectId: string) =>
      room.send({
        type: 'DESTROY_ZONE_LAYER',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version(),
        spatialEffectId
      })

    expect(await destroy(orange!.id)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    const destroyed = await destroy(red!.id)
    expect(destroyed.type, JSON.stringify(destroyed)).toBe('COMMAND_COMMITTED')

    const remaining = await placedLayers(room)
    expect(remaining.layers.map(({ placement }) => placement.layerIndex)).toEqual([
      2, 3, 4, 5, 6, 7
    ])
  })
})

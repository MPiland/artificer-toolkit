import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { layeredZoneSpell } from '@artificer-toolkit/rules-runtime/testing/layeredZoneSpell'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { choiceOptionIdOf, hitPointsOf, readZones, walkerMoves } from './placedZoneRoomReads.js'

/**
 * QUALITY-15.T3v1 (D223): a layered zone authored from core options, cast through a real room. Its
 * layers are one record each on the same area, placed in layer order; a creature that enters the area
 * meets them in that order, and a creature its caster designates passes every layer unharmed.
 */

const CASTER_ACTOR_ID = testUuid(0x2580)
const CASTER_ID = testUuid(0x2581)
const BEAR_ID = testUuid(0x2582)

/** Every die the room rolls shows its lowest face: the Dexterity save fails and 10d6 deals 10. */
const DIE = 0
const LAYER_DAMAGE = 10

const SPELL = layeredZoneSpell()
const SPHERE = choiceOptionIdOf(SPELL, 'Sphere')
/** The 15-foot sphere is 300 Scene units across its radius; the Brown Bear starts outside it. */
const CENTER = { x: 600, y: 600 }
const OUTSIDE = { x: 1000, y: 600 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof actionRoom>>

function layeredRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: BEAR_ID, creature: brownBear })
    ],
    positions: { [BEAR_ID]: OUTSIDE },
    characterSpellcasting: { spells: [SPELL], prepared: [SPELL.id] },
    characterAction: (action) => action.label === 'Layered Ward (9th level)',
    autoRoll: 'EVERYONE',
    fallbackRoll: DIE
  })
}

/** The cast places one record per layer; it returns them by the effect id each one holds. */
async function castSphere(room: Room, unaffectedActorIds?: string[]) {
  const { answer } = await room.startAreaCommand({
    kind: 'POINT',
    point: CENTER,
    choiceOptionId: SPHERE,
    ...(unaffectedActorIds ? { unaffectedActorIds } : {})
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return readZones(room)
}

describe('a layered zone authored from core options (QUALITY-15.T3v1, D223)', () => {
  it('places one record per layer on the same area, in layer order', async () => {
    const room = await layeredRoom()

    const zones = await castSphere(room)

    expect(
      zones.map(({ placement }) => placement.layerIndex ?? 0).sort((left, right) => left - right)
    ).toEqual([1, 2, 3])
    const [first, ...later] = zones
    for (const zone of later) {
      expect(zone.placement.geometry).toEqual(first?.placement.geometry)
      expect(zone.placement.triggerModes).toEqual(first?.placement.triggerModes)
    }
  })

  it('meets a creature that enters it one layer at a time, in order', async () => {
    const room = await layeredRoom()
    const zones = await castSphere(room)
    const layerOf = new Map(zones.map(({ id, placement }) => [id, placement.layerIndex]))
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, BEAR_ID)

    const walk = await walkerMoves(room, [OUTSIDE, CENTER])

    expect(
      walk.executions.map(({ candidate }) => layerOf.get(candidate.candidate.effectId))
    ).toEqual([1, 2, 3])
    expect(await hitPointsOf(room, BEAR_ID)).toBe((hitPointsBefore ?? 0) - 3 * LAYER_DAMAGE)
  })

  it('lets a creature its caster designates pass every layer unharmed', async () => {
    const room = await layeredRoom()
    const zones = await castSphere(room, [BEAR_ID])
    for (const { placement } of zones) expect(placement.unaffectedActorIds).toEqual([BEAR_ID])
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, BEAR_ID)

    const walk = await walkerMoves(room, [OUTSIDE, CENTER])

    expect(walk.executions).toEqual([])
    expect(await hitPointsOf(room, BEAR_ID)).toBe(hitPointsBefore)
  })
})

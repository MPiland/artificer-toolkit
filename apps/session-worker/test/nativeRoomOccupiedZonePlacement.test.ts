import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  layeredZoneSpell,
  withOccupiedPlacement
} from '@artificer-toolkit/rules-runtime/testing/layeredZoneSpell'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { choiceOptionIdOf, readZones } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3v5: a zone authored to be refused over an occupied space, cast through a real room.
 * Alone the key refuses the placement and spends nothing; with the invalid-placement key the casting
 * is still spent and no zone is placed.
 */

const CASTER_ACTOR_ID = testUuid(0x25a0)
const CASTER_ID = testUuid(0x25a1)
const BEAR_ID = testUuid(0x25a2)

const CENTER = { x: 600, y: 600 }
const OUTSIDE = { x: 1000, y: 600 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const occupiedPlacementSpell = (spendsCasting: boolean) =>
  withOccupiedPlacement(layeredZoneSpell(), spendsCasting)

function wardRoom(spell: SpellAuthored, bearAt: { x: number; y: number }) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: BEAR_ID, creature: brownBear })
    ],
    positions: { [BEAR_ID]: bearAt },
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label === 'Layered Ward (9th level)',
    autoRoll: 'EVERYONE',
    fallbackRoll: 0
  })
}

type Room = Awaited<ReturnType<typeof wardRoom>>

const castSphere = (room: Room, spell: SpellAuthored) =>
  room.startAreaCommand({
    kind: 'POINT',
    point: CENTER,
    choiceOptionId: choiceOptionIdOf(spell, 'Sphere')
  })

const readSpellSlots = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CASTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).spellSlots ?? []
  })

describe('a zone placed over an occupied space (QUALITY-15.T3v5)', () => {
  it('refuses the placement and spends nothing when the key stands alone', async () => {
    const spell = occupiedPlacementSpell(false)
    const room = await wardRoom(spell, CENTER)
    const vitalsBefore = vitalsOf(await readRoomHistory(room.room.base.stub))

    const { answer } = await castSphere(room, spell)

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(await readZones(room)).toEqual([])
    expect(await readSpellSlots(room)).toEqual([])
    expect(vitalsOf(await readRoomHistory(room.room.base.stub))).toEqual(vitalsBefore)
  })

  it('spends the casting on a refused placement when the invalid-placement key is authored', async () => {
    const spell = occupiedPlacementSpell(true)
    const room = await wardRoom(spell, CENTER)

    const { answer } = await castSphere(room, spell)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readZones(room)).toEqual([])
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:9', used: 1 }])
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(roots[0]?.outputs.actionEconomyTransition).toBeDefined()
    expect(children).toEqual([])
  })

  it('places the zone as usual when nothing occupies the space', async () => {
    const spell = occupiedPlacementSpell(true)
    const room = await wardRoom(spell, OUTSIDE)

    const { answer } = await castSphere(room, spell)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readZones(room)).toHaveLength(3)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:9', used: 1 }])
  })
})

import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { mage } from '@artificer-toolkit/source-data/srd/creatures/mage.js'
import { SPELL_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { answerAllSaves, areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const MAGE_ID = testUuid(0xb10)
const WOLF_ID = testUuid(0xb11)
/** The Wolf 50 feet from the Mage, so a Fireball centered on it leaves the Mage outside. */
const WOLF_POINT = { x: 1150, y: 150 }

afterEach(closeTrackedSockets)

const creature = installedSrdCreature(mage)
const spellcasting = creature.features.find((feature) => feature.grants?.spellSlots)
if (!spellcasting) throw new Error('The Mage has no Spellcasting.')
const SPELLCASTING_ID = spellcasting.id
const slotRowOf = (level: number) => {
  const row = spellcasting.grants?.spellSlots?.levels.find((candidate) => candidate.level === level)
  if (!row) throw new Error(`The Mage has no level ${level} slot row.`)
  return row.id
}

async function mageRoom() {
  const dagger = creature.features.find(({ label }) => label.startsWith('Dagger'))
  if (!dagger) throw new Error('The Mage has no Dagger.')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: MAGE_ID, creature }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [WOLF_ID]: WOLF_POINT },
    ownerFeatureId: dagger.id,
    pinSpells: true,
    fallbackRoll: 1
  })
}
type Room = Awaited<ReturnType<typeof mageRoom>>

const mageCharges = (history: RoomHistory) => {
  const row = history.actors.find(({ id }) => id === MAGE_ID)
  if (!row) throw new Error('The room holds no Mage.')
  const state = JSON.parse(row.stateJson) as {
    resources: { featureCharges?: Record<string, number> }
  }
  return state.resources.featureCharges ?? {}
}

/** Casts the Mage's offered `label` at the Wolf's point, settles the Wolf's failed save and returns the action id. */
async function castFireball(room: Room, label: string) {
  const action = (await room.actionChoices()).actions.find((choice) => choice.label === label)
  if (!action) throw new Error(`The room offers the Mage no ${label}.`)
  const answer = await room.send({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: MAGE_ID,
    target: {
      kind: 'POINT',
      point: WOLF_POINT,
      sceneId: room.room.scene.id,
      expectedSceneVersion: room.room.scene.version
    },
    actionId: action.id,
    optionalCombatIntent: null,
    sceneContext: null
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await answerAllSaves(room)
  return action.id
}

describe('a Creature casts a granted Spell from a slot in a real room (SPELLS-33.T3c2b)', () => {
  it('spends the cast level’s slot row with a receipt, and undoes the cast whole', async () => {
    const room = await mageRoom()
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    expect(mageCharges(before)[slotRowOf(3)] ?? 0).toBe(0)

    const fireballId = await castFireball(room, 'Fireball (3rd level)')
    const cast = await readRoomHistory(stub)
    expect(mageCharges(cast)[slotRowOf(3)]).toBe(1)
    expect(mageCharges(cast)[slotRowOf(4)] ?? 0).toBe(0)
    const { roots } = areaReceipts(cast)
    expect(roots.map(({ outputs }) => outputs.spellCastConsumption)).toEqual([
      {
        owner: { kind: 'CREATURE', actorId: MAGE_ID, featureId: SPELLCASTING_ID },
        spellId: SPELL_IDS.FIREBALL,
        candidateId: fireballId,
        slotKey: slotRowOf(3),
        beforeUsed: 0,
        afterUsed: 1
      }
    ])
    const wolfHp = (history: RoomHistory) =>
      vitalsOf(history).find(({ id }) => id === WOLF_ID)?.currentHitPoints
    expect(wolfHp(cast)).toBeLessThan(wolfHp(before) ?? Number.NaN)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(stub)
    expect(mageCharges(reverted)[slotRowOf(3)] ?? 0).toBe(0)
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
  })

  it('spends the higher row when the Mage upcasts', async () => {
    const room = await mageRoom()
    await castFireball(room, 'Fireball (4th level)')
    const charges = mageCharges(await readRoomHistory(room.room.base.stub))
    expect(charges[slotRowOf(4)]).toBe(1)
    expect(charges[slotRowOf(3)] ?? 0).toBe(0)
  })
})

import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { mage } from '@artificer-toolkit/source-data/srd/creatures/mage.js'
import { oni } from '@artificer-toolkit/source-data/srd/creatures/oni.js'
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

const featureChargesOf = (history: RoomHistory, actorId = MAGE_ID) => {
  const row = history.actors.find(({ id }) => id === actorId)
  if (!row) throw new Error('The room holds no caster.')
  const state = JSON.parse(row.stateJson) as {
    resources: { featureCharges?: Record<string, number> }
  }
  return state.resources.featureCharges ?? {}
}

/** Casts the caster's offered `label` aimed by `aim`, settles the Wolf's failed save and returns the action id. */
async function castAtWolf(
  room: Room,
  label: string,
  actorId = MAGE_ID,
  aim:
    | { kind: 'POINT'; point: { x: number; y: number } }
    | { kind: 'DIRECTED'; origin: { x: number; y: number }; toward: { x: number; y: number } } = {
    kind: 'POINT',
    point: WOLF_POINT
  }
) {
  const action = (await room.actionChoices()).actions.find((choice) => choice.label === label)
  if (!action) throw new Error(`The room offers the caster no ${label}.`)
  const answer = await room.send({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId,
    target: {
      ...aim,
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
    expect(featureChargesOf(before)[slotRowOf(3)] ?? 0).toBe(0)

    const fireballId = await castAtWolf(room, 'Fireball (3rd level)')
    const cast = await readRoomHistory(stub)
    expect(featureChargesOf(cast)[slotRowOf(3)]).toBe(1)
    expect(featureChargesOf(cast)[slotRowOf(4)] ?? 0).toBe(0)
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
    expect(featureChargesOf(reverted)[slotRowOf(3)] ?? 0).toBe(0)
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
  })

  it('spends the higher row when the Mage upcasts', async () => {
    const room = await mageRoom()
    await castAtWolf(room, 'Fireball (4th level)')
    const charges = featureChargesOf(await readRoomHistory(room.room.base.stub))
    expect(charges[slotRowOf(4)]).toBe(1)
    expect(charges[slotRowOf(3)] ?? 0).toBe(0)
  })
})

describe('a Creature casts an innate 1/day Spell from its charge pool in a real room (SPELLS-33.T3c2c)', () => {
  const ONI_ID = testUuid(0xb12)
  const ogreMage = installedSrdCreature(oni)
  // Only some authored grant variants name their spells, and only the limited-use one a pool.
  const innate = ogreMage.features.find((feature) =>
    feature.grants?.spells?.some(
      (grant) => 'spellIds' in grant && grant.spellIds.includes(SPELL_IDS.CONE_OF_COLD)
    )
  )
  const grant = innate?.grants?.spells?.find(
    (candidate) => 'spellIds' in candidate && candidate.spellIds.includes(SPELL_IDS.CONE_OF_COLD)
  )
  const pool = grant && 'charges' in grant ? grant.charges : undefined
  if (!innate || !pool) throw new Error('The Oni has no Cone of Cold pool.')

  function oniRoom(featureCharges?: Record<string, number>) {
    const glaive = ogreMage.features.find(({ label }) => label.startsWith('Glaive'))
    if (!glaive) throw new Error('The Oni has no Glaive.')
    return actionRoom({
      actors: [
        srdCreatureActor({ id: ONI_ID, creature: ogreMage, featureCharges }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      positions: { [WOLF_ID]: WOLF_POINT },
      ownerFeatureId: glaive.id,
      pinSpells: true,
      fallbackRoll: 1
    })
  }

  it('spends one use of the pool with a receipt, and undo gives it back', async () => {
    const room = await oniRoom()
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)

    // From the east edge of the Oni's one-cell token at its default (150, 150), toward the Wolf.
    const coneOfColdId = await castAtWolf(room, 'Cone of Cold (5th level)', ONI_ID, {
      kind: 'DIRECTED',
      origin: { x: 200, y: 150 },
      toward: WOLF_POINT
    })
    const cast = await readRoomHistory(stub)
    expect(featureChargesOf(cast, ONI_ID)[pool.id]).toBe(1)
    expect(areaReceipts(cast).roots.map(({ outputs }) => outputs.spellCastConsumption)).toEqual([
      {
        owner: { kind: 'CREATURE', actorId: ONI_ID, featureId: innate.id },
        spellId: SPELL_IDS.CONE_OF_COLD,
        candidateId: coneOfColdId,
        slotKey: pool.id,
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
    expect(featureChargesOf(reverted, ONI_ID)[pool.id] ?? 0).toBe(0)
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
  })

  it('offers the spell no more once the pool is spent', async () => {
    const room = await oniRoom({ [pool.id]: 1 })
    const labels = (await room.actionChoices()).actions.map(({ label }) => label)
    expect(labels.some((label) => label.startsWith('Glaive'))).toBe(true)
    expect(labels).not.toContain('Cone of Cold (5th level)')
  })
})

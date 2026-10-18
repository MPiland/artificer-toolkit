import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { sleep } from '@artificer-toolkit/source-data/srd/spells/sleep.js'
import {
  SRD_CREATURE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-27.T8: Sleep, authored from core options. The cast rolls its hit-point pool, puts the
 * creatures in the sphere to sleep from the lowest current hit points up, with no save, and the
 * unconscious condition ends when its holder takes damage. The GM's undo restores both.
 */

const CHARACTER_ACTOR_ID = testUuid(0x8a0)
const CHARACTER_ID = testUuid(0x8a1)
const ATTACKER_ID = testUuid(0x8a2)
const DAMAGED_ID = testUuid(0x8a3)
const LOW_ID = testUuid(0x8a4)
const MID_ID = testUuid(0x8a5)
const TOO_HIGH_ID = testUuid(0x8a6)
const UNDEAD_ID = testUuid(0x8a7)
const FAR_ID = testUuid(0x8a8)
const ASLEEP_ID = testUuid(0x8a9)

const missingVocabulary = (name: string): never => {
  throw new Error(`The SRD vocabulary lacks ${name}.`)
}
const unconscious =
  srdSystemRecord.conditionTypes.find(({ code }) => code === 'UNCONSCIOUS') ??
  missingVocabulary('Unconscious')
const undead =
  SRD_CREATURE_TYPES.find(({ code }) => code === 'UNDEAD') ?? missingVocabulary('Undead')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const attacker = srdCreatureActor({ id: ATTACKER_ID, creature: plainWolf })

const wolfAt = (id: string, hitPoints: number) =>
  srdCreatureActor({
    id,
    creature: { ...plainWolf, hitPoints },
    currentHitPoints: hitPoints
  })

/**
 * The Character casts Sleep at x = 1150, whose sphere reaches the five Wolves placed 1000 to 1400
 * and the Undead at 1500 but not the attacker beside the Character or the Wolf at 2300. Five d8
 * roll 5 each, a pool of 25: it puts the 4, 9 and 11 hit-point Wolves to sleep (21, 12, 1 left), not
 * the 14, and not the 3 hit-point Undead the spell does not affect. `alreadyAsleep` adds an unconscious
 * 2 hit-point Wolf at 1050, which the pool passes over.
 */
function sleepRoom(alreadyAsleep = false) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      attacker,
      wolfAt(DAMAGED_ID, 11),
      wolfAt(LOW_ID, 4),
      wolfAt(MID_ID, 9),
      wolfAt(TOO_HIGH_ID, 14),
      srdCreatureActor({
        id: UNDEAD_ID,
        creature: { ...plainWolf, hitPoints: 3, creatureTypeId: undead.id },
        currentHitPoints: 3
      }),
      wolfAt(FAR_ID, 4),
      ...(alreadyAsleep
        ? [
            srdCreatureActor({
              id: ASLEEP_ID,
              creature: { ...plainWolf, hitPoints: 2 },
              currentHitPoints: 2,
              conditionIds: [unconscious.id]
            })
          ]
        : [])
    ],
    positions: {
      [ATTACKER_ID]: { x: 300, y: 150 },
      [DAMAGED_ID]: { x: 1000, y: 150 },
      [LOW_ID]: { x: 1100, y: 150 },
      [MID_ID]: { x: 1200, y: 150 },
      [TOO_HIGH_ID]: { x: 1300, y: 150 },
      [UNDEAD_ID]: { x: 1500, y: 150 },
      [FAR_ID]: { x: 2300, y: 150 },
      ...(alreadyAsleep ? { [ASLEEP_ID]: { x: 1050, y: 150 } } : {})
    },
    characterSpellcasting: { spells: [sleep], prepared: [sleep.id] },
    characterAction: (action) => action.label === 'Sleep (1st level)',
    autoRoll: 'BOTH',
    rolls: [4, 4, 4, 4, 4, 18],
    fallbackRoll: 5
  })
}

type SleepRoom = Awaited<ReturnType<typeof sleepRoom>>

async function history(room: SleepRoom) {
  const stored = await readRoomHistory(room.room.base.stub)
  const vitals = vitalsOf(stored)
  const asleep = stored.actors
    .map(({ id }) => id)
    .filter(
      (id) =>
        id !== CHARACTER_ACTOR_ID && readActorConditionIds(stored, id).includes(unconscious.id)
    )
    .sort()
  return {
    asleep,
    effectHolders: stored.activeEffects.map(({ targetActorId }) => targetActorId).sort(),
    hitPoints: Object.fromEntries(vitals.map(({ id, currentHitPoints }) => [id, currentHitPoints])),
    stored
  }
}

const SLEEPERS = [DAMAGED_ID, LOW_ID, MID_ID].sort()

async function castSleep(room: SleepRoom) {
  const { answer } = await room.startAreaAction({ x: 1150, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function undoLastAction(room: SleepRoom) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

/** The attacker's Bite at `targetId` on its own turn, hitting with a natural 19, the room rolling it and the damage. */
async function biteHits(room: SleepRoom, targetId: string) {
  await room.advanceTurn()
  const bite = plainWolf.features?.find((feature) => feature.label === 'Bite')
  if (!bite) throw new Error('The Wolf has a Bite.')
  const { answer } = await room.startAction(
    targetId,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    room.featureActionId(attacker, bite.id),
    ATTACKER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

const rouseDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.ROUSE
)
if (rouseDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Rouse fixture.')
const rouseEffectId = rouseDefinition.document.effects[0]!.id

/** The attacker, on its own turn, uses its action to rouse `targetId`. */
async function rouses(room: SleepRoom, targetId: string) {
  await room.advanceTurn()
  const { answer } = await room.startAction(
    targetId,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    encounterBasicActionId(ATTACKER_ID, SRD_BASIC_ACTION_IDS.ROUSE, rouseEffectId),
    ATTACKER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('room cast of Sleep (SPELLS-27.T8)', () => {
  it('puts creatures to sleep from the lowest current hit points up while the rolled pool lasts, in one commit and with no save', async () => {
    const room = await sleepRoom()
    const before = await history(room)
    expect(before.asleep).toEqual([])

    await castSleep(room)

    const after = await history(room)
    expect(after.asleep).toEqual(SLEEPERS)
    expect(after.effectHolders).toEqual(SLEEPERS)
    expect(after.hitPoints).toEqual(before.hitPoints)
    const { roots, children } = areaReceipts(after.stored)
    expect(roots).toHaveLength(1)
    expect(children.map(({ outputs }) => outputs.targetActorId).sort()).toEqual(SLEEPERS)
  }, 120000)

  // SPELLS-4.T2a1: the pool spent 2 of its 25 on the Wolf already asleep and had too little left for
  // the 11 hit-point Wolf.
  it('passes over a creature already unconscious, its hit points left in the pool', async () => {
    const room = await sleepRoom(true)

    await castSleep(room)

    const after = await history(room)
    expect(after.effectHolders).toEqual(SLEEPERS)
    expect(after.asleep).toEqual([...SLEEPERS, ASLEEP_ID].sort())
  }, 120000)

  it('ends the unconscious condition of a sleeper that takes damage, leaving the others asleep', async () => {
    const room = await sleepRoom()
    await castSleep(room)

    await biteHits(room, DAMAGED_ID)

    const after = await history(room)
    expect(after.asleep).toEqual([LOW_ID, MID_ID].sort())
    expect(after.effectHolders).toEqual([LOW_ID, MID_ID].sort())
  }, 120000)

  it('gives the sleeper’s condition and effect back when the damage is undone', async () => {
    const room = await sleepRoom()
    await castSleep(room)
    await biteHits(room, DAMAGED_ID)

    await undoLastAction(room)

    const bitten = await history(room)
    expect(bitten.asleep).toEqual(SLEEPERS)
    expect(bitten.effectHolders).toEqual(SLEEPERS)
  }, 120000)

  it('puts every sleeper back awake when the cast is undone', async () => {
    const room = await sleepRoom()
    await castSleep(room)

    await undoLastAction(room)

    const undone = await history(room)
    expect(undone.asleep).toEqual([])
    expect(undone.effectHolders).toEqual([])
  }, 120000)

  it('wakes the sleeper another creature uses an action to rouse, leaving the others asleep (SPELLS-27.T12)', async () => {
    const room = await sleepRoom()
    await castSleep(room)

    await rouses(room, MID_ID)

    const after = await history(room)
    expect(after.asleep).toEqual([DAMAGED_ID, LOW_ID].sort())
    expect(after.effectHolders).toEqual([DAMAGED_ID, LOW_ID].sort())
  }, 120000)

  it('puts the roused sleeper back to sleep when the rousing is undone (SPELLS-27.T12)', async () => {
    const room = await sleepRoom()
    await castSleep(room)
    await rouses(room, MID_ID)

    await undoLastAction(room)

    const restored = await history(room)
    expect(restored.asleep).toEqual(SLEEPERS)
    expect(restored.effectHolders).toEqual(SLEEPERS)
  }, 120000)
})

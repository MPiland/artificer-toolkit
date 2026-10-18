import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

/**
 * SPELLS-27.T11: the Drow's Hand Crossbow poisons a Wolf that fails its DC 13 Constitution save for
 * 1 hour; failing by 5 or more also knocks it unconscious through its own effect, which ends when
 * the Wolf takes damage or another creature rouses it, while the poison stays. The GM's undo
 * restores either.
 */

const DROW_ID = testUuid(0xa10)
const ROUSER_ID = testUuid(0xa11)
const SLEEPER_ID = testUuid(0xa12)

const conditionTypeId = (code: string) => {
  const condition = srdSystemRecord.conditionTypes.find((entry) => entry.code === code)
  if (!condition) throw new Error(`The SRD vocabulary lacks ${code}.`)
  return condition.id
}
const [POISONED, UNCONSCIOUS] = [conditionTypeId('POISONED'), conditionTypeId('UNCONSCIOUS')]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const drow = seededSrdCreature('Drow')
const rouser = srdCreatureActor({ id: ROUSER_ID, creature: plainWolf })

/**
 * The Drow shoots the sleeper first, then the rouser takes its turn. Rolls are zero-based: the
 * Hand Crossbow hits with a natural 19 and rolls a 1 on its d6, and the Wolf's save is a natural 1
 * (2 against DC 13, failing by 11); then the rouser's Bite hits with a natural 19.
 */
function marginRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: DROW_ID, creature: drow }),
      rouser,
      srdCreatureActor({ id: SLEEPER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(drow, 'Hand Crossbow').id,
    autoRoll: 'GAME_MASTER',
    rolls: [18, 0, 0, 18],
    fallbackRoll: 0
  })
}

type MarginRoom = Awaited<ReturnType<typeof marginRoom>>

/** The sleeper's conditions and how many active effects it holds. */
async function sleeper(room: MarginRoom) {
  const stored = await readRoomHistory(room.room.base.stub)
  const vitals = vitalsOf(stored).find(({ id }) => id === SLEEPER_ID)
  return {
    conditionIds: ((vitals?.conditions ?? []) as { conditionTypeId: string }[])
      .map((condition) => condition.conditionTypeId)
      .sort(),
    effects: stored.activeEffects.filter(({ targetActorId }) => targetActorId === SLEEPER_ID).length
  }
}

async function shoots(room: MarginRoom) {
  const { answer } = await room.startAction(SLEEPER_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function undoLastAction(room: MarginRoom) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

const rouseDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.ROUSE
)
if (rouseDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Rouse fixture.')
const rouseEffectId = rouseDefinition.document.effects[0]!.id

/** The rouser, on its own turn, uses `actionId` on the sleeper. */
async function rouserActs(room: MarginRoom, actionId: string) {
  await room.advanceTurn()
  const { answer } = await room.startAction(
    SLEEPER_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    actionId,
    ROUSER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

const rouses = (room: MarginRoom) =>
  rouserActs(room, encounterBasicActionId(ROUSER_ID, SRD_BASIC_ACTION_IDS.ROUSE, rouseEffectId))

const bites = (room: MarginRoom) =>
  rouserActs(room, room.featureActionId(rouser, creatureFeature(plainWolf, 'Bite').id))

const asleep = { conditionIds: [POISONED, UNCONSCIOUS].sort(), effects: 2 }
const poisoned = { conditionIds: [POISONED], effects: 1 }

describe('a save failed by 5 or more in the room (SPELLS-27.T11)', () => {
  it('poisons and knocks out the target, and the GM’s undo removes both', async () => {
    const room = await marginRoom()

    await shoots(room)
    expect(await sleeper(room)).toEqual(asleep)

    await undoLastAction(room)
    expect(await sleeper(room)).toEqual({ conditionIds: [], effects: 0 })
  }, 120000)

  it('wakes the target another creature rouses, leaving it poisoned, until the GM undoes it', async () => {
    const room = await marginRoom()
    await shoots(room)

    await rouses(room)
    expect(await sleeper(room)).toEqual(poisoned)

    await undoLastAction(room)
    expect(await sleeper(room)).toEqual(asleep)
  }, 120000)

  it('wakes the target when it takes damage, leaving it poisoned', async () => {
    const room = await marginRoom()
    await shoots(room)
    expect(await sleeper(room)).toEqual(asleep)

    await bites(room)
    // The Bite may also knock the Wolf prone; only the sleep ends.
    const bitten = await sleeper(room)
    expect(bitten.conditionIds).toContain(POISONED)
    expect(bitten.conditionIds).not.toContain(UNCONSCIOUS)
    expect(bitten.effects).toBe(1)
  }, 120000)
})

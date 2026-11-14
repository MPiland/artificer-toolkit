import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { duergar } from '@artificer-toolkit/source-data/srd/creatures/duergar.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T2: an unmodified SRD creature action off a Self range that names no targeting is
 * taken on its user. It is offered, its result lands on the creature that used it, and the GM's one
 * undo takes it back.
 */

const USER_ID = testUuid(0xd60)
const WOLF_ID = testUuid(0xd61)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const INVISIBLE_ID = (() => {
  const condition = SRD_CONDITION_TYPES.find(({ code }) => code === 'INVISIBLE')
  if (!condition) throw new Error('The SRD has no INVISIBLE condition.')
  return condition.id
})()

/** The Duergar using its feature `featureLabel`, with a Wolf beside it that the action ignores. */
async function selfActionRoom(featureLabel: string) {
  const creature = installedSrdCreature(duergar)
  const feature = creature.features.find(({ label }) => label.startsWith(featureLabel))
  if (!feature) throw new Error(`The Duergar has no ${featureLabel}.`)
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: USER_ID, creature }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    ownerFeatureId: feature.id
  })
  return { ...room, featureId: feature.id }
}

type SelfActionRoom = Awaited<ReturnType<typeof selfActionRoom>>

async function useOnItself(room: SelfActionRoom) {
  const { answer } = await room.startAction(USER_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function undo(room: SelfActionRoom) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

const offeredIds = async (room: SelfActionRoom) =>
  (await room.actionChoices()).actions.map(({ id }) => id)

/** The uses of the feature `featureId` the user has spent, as its stored Run actor holds them. */
function usedCharges(history: Awaited<ReturnType<typeof readRoomHistory>>, featureId: string) {
  const row = history.actors.find(({ id }) => id === USER_ID)
  if (!row) throw new Error('Expected the user in the stored Run.')
  const { resources } = JSON.parse(row.stateJson) as {
    resources: { featureCharges?: Record<string, number> }
  }
  // A Run actor that has never spent the feature holds no entry for it.
  return resources.featureCharges?.[featureId] ?? 0
}

describe('an unmodified SRD Duergar acting on itself off a Self range (QUALITY-15.T2)', () => {
  it('offers Invisibility instead of listing it unavailable', async () => {
    const room = await selfActionRoom('Invisibility')
    const choices = await room.actionChoices()
    expect(choices.actions.map(({ id }) => id)).toContain(room.actionId)
    expect(choices.unavailableActions.map(({ id }) => id)).not.toContain(room.actionId)
  })

  it('turns its user invisible with one timed effect, and the GM’s one undo takes it back', async () => {
    const room = await selfActionRoom('Invisibility')
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    expect(readActorConditionIds(before, USER_ID)).not.toContain(INVISIBLE_ID)

    await useOnItself(room)
    const used = await readRoomHistory(stub)
    expect(readActorConditionIds(used, USER_ID)).toContain(INVISIBLE_ID)
    expect(readActorConditionIds(used, WOLF_ID)).not.toContain(INVISIBLE_ID)
    expect(used.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([USER_ID])

    await undo(room)
    const reverted = await readRoomHistory(stub)
    expect(readActorConditionIds(reverted, USER_ID)).toEqual(readActorConditionIds(before, USER_ID))
    expect(reverted.activeEffects).toEqual([])
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
  })

  it('spends Enlarge’s one use on its user for the GM’s ruling, and the one undo gives it back', async () => {
    const room = await selfActionRoom('Enlarge')
    const stub = room.room.base.stub
    expect(await offeredIds(room)).toContain(room.actionId)
    const before = await readRoomHistory(stub)
    expect(usedCharges(before, room.featureId)).toBe(0)

    await useOnItself(room)
    const used = await readRoomHistory(stub)
    expect(usedCharges(used, room.featureId)).toBe(1)
    expect(used.activeEffects).toEqual([])

    await undo(room)
    expect(usedCharges(await readRoomHistory(stub), room.featureId)).toBe(0)
  })
})

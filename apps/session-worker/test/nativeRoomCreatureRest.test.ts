import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CASTER_ID = testUuid(0x7d0)
const BYSTANDER_ID = testUuid(0x7d1)
const SHORT_FEATURE_ID = testUuid(0x7d2)
const DAILY_FEATURE_ID = testUuid(0x7d3)
const SLOT_FEATURE_ID = testUuid(0x7d4)
const SLOT_ROW_ID = testUuid(0x7d5)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const { effects: _biteEffects, ...passiveBite } = creatureFeature(plainWolf, 'Bite')
const passive = { ...passiveBite, attributes: ['LIMITED_USE' as const] }

/** A Wolf with a short-rest charge, a daily charge and a long-rest slot row. */
const restingWolf: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0x7d6),
  features: [
    ...(plainWolf.features ?? []),
    {
      ...passive,
      id: SHORT_FEATURE_ID,
      label: 'Short charge',
      charges: {
        id: testUuid(0x7d7),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        resetKind: 'SHORT_REST',
        amount: 2
      }
    },
    {
      ...passive,
      id: DAILY_FEATURE_ID,
      label: 'Daily charge',
      charges: {
        id: testUuid(0x7d8),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        resetKind: 'DAILY',
        amount: 2
      }
    },
    {
      ...passive,
      id: SLOT_FEATURE_ID,
      label: 'Slots',
      grants: {
        spellSlots: {
          id: testUuid(0x7d9),
          resetKind: 'LONG_REST',
          levels: [{ id: SLOT_ROW_ID, level: 1, amount: 2 }]
        }
      }
    }
  ]
}

const spent = {
  [SHORT_FEATURE_ID]: 1,
  [DAILY_FEATURE_ID]: 1,
  [SLOT_ROW_ID]: 2
}

function restRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: restingWolf, featureCharges: spent }),
      srdCreatureActor({ id: BYSTANDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id
  })
}
type Room = Awaited<ReturnType<typeof restRoom>>

async function used(room: Room, actorId: string) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(({ id }) => id === actorId)
  const { resources } = JSON.parse(row!.stateJson) as {
    resources: { featureCharges?: Record<string, number> }
  }
  return resources.featureCharges ?? {}
}

async function rest(room: Room, restKind: 'SHORT' | 'LONG', actorIds: string[]) {
  return room.send({
    type: 'CREATURE_REST',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    restKind,
    actorIds
  })
}

describe('room creature rest', () => {
  it('a short rest restores the short-rest charge, then undo spends it again', async () => {
    const room = await restRoom()
    expect(await used(room, CASTER_ID)).toMatchObject(spent)

    const answer = await rest(room, 'SHORT', [CASTER_ID])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await used(room, CASTER_ID)).toMatchObject({
      [SHORT_FEATURE_ID]: 0,
      [DAILY_FEATURE_ID]: 1,
      [SLOT_ROW_ID]: 2
    })

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await used(room, CASTER_ID)).toMatchObject(spent)
  })

  it('a long rest also restores the slot row but leaves the daily charge, and undoes', async () => {
    const room = await restRoom()
    expect((await rest(room, 'LONG', [CASTER_ID])).type).toBe('COMMAND_COMMITTED')
    expect(await used(room, CASTER_ID)).toMatchObject({
      [SHORT_FEATURE_ID]: 0,
      [DAILY_FEATURE_ID]: 1,
      [SLOT_ROW_ID]: 0
    })

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await used(room, CASTER_ID)).toMatchObject(spent)
  })

  it('refuses duplicate ids and a creature with nothing to recover', async () => {
    const room = await restRoom()
    expect((await rest(room, 'SHORT', [CASTER_ID, CASTER_ID])).type).toBe('COMMAND_REJECTED')
    expect((await rest(room, 'SHORT', [BYSTANDER_ID])).type).toBe('COMMAND_REJECTED')
    expect(await used(room, CASTER_ID)).toMatchObject(spent)
  })

  it('refuses the undo when a rested charge was spent again afterwards', async () => {
    const room = await restRoom()
    expect((await rest(room, 'SHORT', [CASTER_ID])).type).toBe('COMMAND_COMMITTED')
    const spend = await room.send({
      type: 'ADJUST_FEATURE_RESOURCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: CASTER_ID,
      featureId: SHORT_FEATURE_ID,
      direction: 'USE'
    })
    expect(spend.type, JSON.stringify(spend)).toBe('COMMAND_COMMITTED')
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type).toBe('COMMAND_REJECTED')
  })
})

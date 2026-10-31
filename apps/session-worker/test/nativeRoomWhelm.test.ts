import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { answerAllSaves, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const ELEMENTAL_ID = testUuid(0x8a0)
const MEDIUM_ID = testUuid(0x8a1)
const HUGE_ID = testUuid(0x8a2)
const FAR_ID = testUuid(0x8a3)
const ELEMENTAL_AT = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The seeded Water Elemental with a Medium Veteran and a Huge Mammoth in its space and a second
 * Veteran well outside it. A token is 100 px, a cell 5 ft.
 */
async function whelmRoom() {
  const elemental = seededSrdCreature('Water Elemental')
  const room = await actionRoom({
    rolls: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    actors: [
      srdCreatureActor({ id: ELEMENTAL_ID, creature: elemental }),
      srdCreatureActor({ id: MEDIUM_ID, creature: seededSrdCreature('Veteran') }),
      srdCreatureActor({ id: HUGE_ID, creature: seededSrdCreature('Mammoth') }),
      srdCreatureActor({ id: FAR_ID, creature: seededSrdCreature('Veteran') })
    ],
    positions: {
      [ELEMENTAL_ID]: ELEMENTAL_AT,
      [MEDIUM_ID]: ELEMENTAL_AT,
      [HUGE_ID]: ELEMENTAL_AT,
      [FAR_ID]: { x: 750, y: 650 }
    },
    ownerFeatureId: creatureFeature(elemental, 'Whelm (Recharge 4-6)').id
  })
  return room
}
type Room = Awaited<ReturnType<typeof whelmRoom>>

const hitPointsOf = async (room: Room, actorId: string) =>
  vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === actorId)
    ?.currentHitPoints

describe('the Water Elemental’s Whelm in the room (D202)', () => {
  it('damages every creature that fails and holds only the one Large or smaller', async () => {
    const room = await whelmRoom()
    const before = await hitPointsOf(room, MEDIUM_ID)
    const hugeBefore = await hitPointsOf(room, HUGE_ID)
    const { answer } = await room.startCasterCenteredAreaAction()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    // Each creature in its space is asked a save, the one outside it is not.
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [MEDIUM_ID, HUGE_ID].sort()
    )
    await answerAllSaves(room)

    expect((await hitPointsOf(room, MEDIUM_ID)) ?? 0).toBeLessThan(before ?? 0)
    expect((await hitPointsOf(room, HUGE_ID)) ?? 0).toBeLessThan(hugeBefore ?? 0)
    expect(((await room.heldRelationships()) ?? []).map(({ heldActorId }) => heldActorId)).toEqual([
      MEDIUM_ID
    ])
  })

  it('neither damages nor holds a creature that makes the save', async () => {
    const room = await whelmRoom()
    const before = await hitPointsOf(room, MEDIUM_ID)
    const { answer } = await room.startCasterCenteredAreaAction()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room, { [MEDIUM_ID]: 20, [HUGE_ID]: 20 })

    expect(await hitPointsOf(room, MEDIUM_ID)).toBe(before)
    expect((await room.heldRelationships()) ?? []).toHaveLength(0)
  })

  it('damages the held creature again at the start of each of the elemental’s turns', async () => {
    const room = await whelmRoom()
    const { answer } = await room.startCasterCenteredAreaAction()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)
    const afterWhelm = await hitPointsOf(room, MEDIUM_ID)

    // The turn passes round the table back to the elemental, whose turn start deals the damage.
    for (let turn = 0; turn < 4; turn += 1) await room.advanceTurn()

    expect((await hitPointsOf(room, MEDIUM_ID)) ?? 0).toBeLessThan(afterWhelm ?? 0)
  })
})

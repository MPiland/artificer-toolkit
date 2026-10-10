import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

const CASTER_ID = testUuid(0x700)
const CAUGHT_IDS = [testUuid(0x701), testUuid(0x702), testUuid(0x703)]
const FAR_ID = testUuid(0x704)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Five Wolves 100 px apart; the first casts. A 20 ft sphere at x = 50 reaches the first four. */
function areaRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      ...[...CAUGHT_IDS, FAR_ID].map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id
  })
}

describe('room point-area action', () => {
  it('waits on one save for every creature the area catches, the caster included', async () => {
    const room = await areaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.casterActorId).toBe(CASTER_ID)
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, ...CAUGHT_IDS].sort()
    )
    // The area is stored as one pending occurrence; nothing was spent or damaged yet.
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
    expect(history.receipts).toHaveLength(before.receipts.length)
    expect(history.actors).toEqual(before.actors)
  })

  it('refuses an area that catches nobody', async () => {
    const room = await areaRoom()
    const { answer } = await room.startAreaAction({ x: 150, y: 2000 })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('refuses a creature target for an area action', async () => {
    const room = await areaRoom()
    const { answer } = await room.startAction(CAUGHT_IDS[0]!)
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED' })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})

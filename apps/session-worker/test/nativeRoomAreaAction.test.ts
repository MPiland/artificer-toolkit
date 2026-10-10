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

describe('room GM removal from a pending area', () => {
  /** The room with its area pending on the first Fireball point, and the GM's view of it. */
  async function pendingAreaRoom() {
    const room = await areaRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    return { room, decision: await room.pendingDecision() }
  }
  const savesOf = (decision: Awaited<ReturnType<typeof pendingAreaRoom>>['decision']) => {
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    return decision.pending.saves.map(({ actorId }) => actorId)
  }

  it('takes a creature out of the area and seals the caught set again', async () => {
    const { room, decision } = await pendingAreaRoom()
    // Ids arrive in any case and are lowercased at admission.
    const command = room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!.toUpperCase())
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')

    const after = await room.pendingDecision()
    if (after.pending.kind !== 'AREA_SAVES' || decision.pending.kind !== 'AREA_SAVES')
      throw new Error('Expected the area saves.')
    expect(savesOf(after).sort()).toEqual([CASTER_ID, CAUGHT_IDS[0]!, CAUGHT_IDS[1]!].sort())
    expect(after.pending.caughtChecksum).not.toBe(decision.pending.caughtChecksum)
    expect(after.occurrence.version).toBe(decision.occurrence.version + 1)
    // The area is still pending, so the Encounter itself has not moved.
    expect(after.encounterVersion).toBe(decision.encounterVersion)
  })

  it('replays a repeated removal without changing the area again', async () => {
    const { room, decision } = await pendingAreaRoom()
    const command = room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!)
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    const after = await room.pendingDecision()
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    expect(await room.pendingDecision()).toEqual(after)
  })

  it('refuses a removal made against a caught set that has since changed', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    // Fresh versions, but the checksum is the one the GM saw before the first removal.
    const fresh = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const answer = await room.send(
      room.removeAreaTargetCommand(fresh, CAUGHT_IDS[1]!, {
        expectedCaughtChecksum: decision.pending.caughtChecksum
      })
    )
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
    expect(savesOf(await room.pendingDecision())).toContain(CAUGHT_IDS[1]!)
  })

  it('refuses a player and a creature the area did not catch', async () => {
    const { room, decision } = await pendingAreaRoom()
    const byPlayer = room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!)
    expect(await room.sendAsPlayer(byPlayer)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'GM_ONLY'
    })
    expect(await room.send(room.removeAreaTargetCommand(decision, FAR_ID))).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect(savesOf(await room.pendingDecision())).toHaveLength(4)
  })
})

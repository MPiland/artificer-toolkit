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
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const after = await room.pendingDecision()
    // Same creature, current versions: the area already reflects it, so nothing changes.
    expect((await room.send(room.removeAreaTargetCommand(after, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    expect(await room.pendingDecision()).toEqual(after)
  })

  it('refuses a stale removal even when the creature was already removed', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const answer = await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
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

describe('room area saves answered by each creature', () => {
  async function pendingAreaRoom() {
    const room = await areaRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    return { room, decision: await room.pendingDecision() }
  }
  type Decision = Awaited<ReturnType<typeof pendingAreaRoom>>['decision']
  const savesOf = (decision: Decision) => {
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    return decision.pending.saves.map(({ actorId }) => actorId)
  }
  /** `actorId`'s own save answered with one natural d20 face. */
  const answerCommand = (
    room: Awaited<ReturnType<typeof pendingAreaRoom>>['room'],
    decision: Decision,
    actorId: string,
    face = 9
  ) => {
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === actorId)
    if (!save) throw new Error('The creature has no pending save.')
    return room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: save.request.requestId,
      rawFaces: [face],
      rollMode: save.request.rollMode
    })
  }

  it('records one creature’s save and leaves the others waiting', async () => {
    const { room, decision } = await pendingAreaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    expect((await room.send(answerCommand(room, decision, CAUGHT_IDS[0]!))).type).toBe(
      'COMMAND_COMMITTED'
    )

    const after = await room.pendingDecision()
    expect(savesOf(after).sort()).toEqual([CASTER_ID, CAUGHT_IDS[1]!, CAUGHT_IDS[2]!].sort())
    expect(after.occurrence.version).toBe(decision.occurrence.version + 1)
    expect(after.encounterVersion).toBe(decision.encounterVersion)
    // Nothing is damaged until the area settles.
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.actors).toEqual(before.actors)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
  })

  it('takes the saves in any order', async () => {
    const { room } = await pendingAreaRoom()
    for (const actorId of [CAUGHT_IDS[2]!, CASTER_ID, CAUGHT_IDS[0]!]) {
      const decision = await room.pendingDecision()
      expect((await room.send(answerCommand(room, decision, actorId))).type).toBe(
        'COMMAND_COMMITTED'
      )
      expect(savesOf(await room.pendingDecision())).not.toContain(actorId)
    }
    expect(savesOf(await room.pendingDecision())).toEqual([CAUGHT_IDS[1]!])
  })

  it('replays a repeated answer without recording it again', async () => {
    const { room, decision } = await pendingAreaRoom()
    const command = answerCommand(room, decision, CAUGHT_IDS[0]!)
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    const after = await room.pendingDecision()
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    expect(await room.pendingDecision()).toEqual(after)
  })

  it('refuses an answer made against a stale occurrence', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(answerCommand(room, decision, CAUGHT_IDS[0]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const stale = await room.send(answerCommand(room, decision, CAUGHT_IDS[1]!))
    expect(stale).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
    expect(savesOf(await room.pendingDecision())).toContain(CAUGHT_IDS[1]!)
  })

  it('refuses a save that was already answered', async () => {
    const { room, decision } = await pendingAreaRoom()
    const first = answerCommand(room, decision, CAUGHT_IDS[0]!)
    expect((await room.send(first)).type).toBe('COMMAND_COMMITTED')
    const fresh = await room.pendingDecision()
    // The first answer's request no longer waits, so a second try finds nothing to answer.
    const again = await room.send({
      ...first,
      commandId: crypto.randomUUID(),
      expectedOccurrenceVersion: fresh.occurrence.version
    })
    expect(again).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'DECISION_NOT_PENDING' })
    expect(savesOf(await room.pendingDecision())).toHaveLength(3)
  })

  it('refuses the GM taking out a creature that already rolled', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(answerCommand(room, decision, CAUGHT_IDS[0]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const fresh = await room.pendingDecision()
    const removal = await room.send(room.removeAreaTargetCommand(fresh, CAUGHT_IDS[0]!))
    expect(removal).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(savesOf(await room.pendingDecision())).toHaveLength(3)
  })

  it('refuses an answer for a creature the GM took out', async () => {
    const { room, decision } = await pendingAreaRoom()
    const stillWaiting = answerCommand(room, decision, CAUGHT_IDS[2]!)
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const fresh = await room.pendingDecision()
    const answer = await room.send({
      ...stillWaiting,
      commandId: crypto.randomUUID(),
      expectedOccurrenceVersion: fresh.occurrence.version
    })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'DECISION_NOT_PENDING' })
  })

  it('refuses a player answering a creature the GM runs', async () => {
    const { room, decision } = await pendingAreaRoom()
    const answer = await room.sendAsPlayer(answerCommand(room, decision, CAUGHT_IDS[0]!))
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'NOT_ACTOR_CONTROLLER' })
    expect(savesOf(await room.pendingDecision())).toHaveLength(4)
  })
})

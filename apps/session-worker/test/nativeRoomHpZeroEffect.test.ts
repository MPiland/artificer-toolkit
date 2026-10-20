import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, deathBurstWolf } from './actionRoomFixture.js'
import { answerAllSaves, areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0xb00)
const HOLDER_ID = testUuid(0xb01)
const NEAR_ID = testUuid(0xb02)
const FAR_ID = testUuid(0xb03)
const DOOMED_ID = testUuid(0xb04)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const hitPointsOf = (history: RoomHistory, id: string) =>
  vitalsOf(history).find((vitals) => vitals.id === id)?.currentHitPoints

/**
 * The attacker kills the Wolf that carries the death burst (1 hit point left), beside a Wolf in the
 * 30 ft burst and one beyond it. A token is 100 px and a cell 5 feet.
 */
async function deathBurstRoom(autoRoll?: 'GAME_MASTER', doomed = false) {
  const attacker = biteWolf('ATTACK', { reachFeet: 150, damage: 5 })
  return actionRoom({
    ...(autoRoll ? { autoRoll } : {}),
    rolls: [19, 1, 1, 1, 1, 1],
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({
        id: HOLDER_ID,
        creature: deathBurstWolf(30, 10),
        currentHitPoints: 1
      }),
      srdCreatureActor({ id: NEAR_ID, creature: plainWolf }),
      srdCreatureActor({ id: FAR_ID, creature: plainWolf }),
      ...(doomed
        ? [
            srdCreatureActor({
              id: DOOMED_ID,
              creature: deathBurstWolf(30, 10),
              currentHitPoints: 1
            })
          ]
        : [])
    ],
    positions: { [FAR_ID]: { x: 1450, y: 150 }, [DOOMED_ID]: { x: 450, y: 150 } },
    ownerFeatureId: attacker.features?.find((feature) => feature.label === 'Bite')?.id
  })
}

describe('room passive effect on reaching 0 hit points', () => {
  it('bursts from the defeated Wolf in the defeating command', async () => {
    const room = await deathBurstRoom('GAME_MASTER')
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)

    const { answer } = await room.startAction(HOLDER_ID, [], room.sceneContext())
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(stub)
    expect(await readPendingActionDecision(stub)).toBeNull()
    expect(hitPointsOf(after, HOLDER_ID)).toBe(0)
    expect(hitPointsOf(before, NEAR_ID)).toBeGreaterThan(hitPointsOf(after, NEAR_ID) ?? 0)
    expect(hitPointsOf(after, ATTACKER_ID)).toBeLessThan(hitPointsOf(before, ATTACKER_ID) ?? 0)
    expect(hitPointsOf(after, FAR_ID)).toBe(hitPointsOf(before, FAR_ID))
    const { roots, children } = areaReceipts(after)
    expect(roots).toHaveLength(1)
    // The burst's victims are everyone within 30 ft but the holder, settled in the one commit.
    const burst = roots[0]!
    expect(
      children
        .filter(({ outputs }) => outputs.parentOccurrenceId === burst.receipt.occurrenceId)
        .map(({ outputs }) => outputs.targetActorId)
        .sort()
    ).toEqual([ATTACKER_ID, NEAR_ID].sort())
    expect(burst.receipt.commandType).toBe('RESOLVE_ACTION')
  }, 120000)

  it('undoes the defeating attack and the burst together', async () => {
    const room = await deathBurstRoom('GAME_MASTER')
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    await room.startAction(HOLDER_ID, [], room.sceneContext())
    expect(hitPointsOf(await readRoomHistory(stub), HOLDER_ID)).toBe(0)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
  }, 120000)

  it("does not retrigger from the burst's own defeats", async () => {
    const room = await deathBurstRoom('GAME_MASTER', true)
    const stub = room.room.base.stub
    const { answer } = await room.startAction(HOLDER_ID, [], room.sceneContext())
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(stub)
    expect(hitPointsOf(after, DOOMED_ID)).toBe(0)
    expect(areaReceipts(after).roots).toHaveLength(1)
  }, 120000)

  it('opens the burst saves in the defeating command for manual rollers', async () => {
    const room = await deathBurstRoom()
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    expect((await room.startAction(HOLDER_ID, [], room.sceneContext())).answer.type).toBe(
      'COMMAND_COMMITTED'
    )
    const attack = await readPendingActionDecision(stub)
    if (attack?.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
    const answered = await room.send(
      room.resolveCommand(attack, {
        kind: 'ENTER_DICE',
        requestId: attack.pending.request.requestId,
        rawFaces: [19],
        rollMode: attack.pending.request.rollMode
      })
    )
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')

    // The holder is down and the burst waits on its victims' saves, none yet damaged.
    const waiting = await readPendingActionDecision(stub)
    expect(waiting?.pending.kind).toBe('AREA_SAVES')
    const open = await readRoomHistory(stub)
    expect(hitPointsOf(open, HOLDER_ID)).toBe(0)
    expect(hitPointsOf(open, NEAR_ID)).toBe(hitPointsOf(before, NEAR_ID))

    await answerAllSaves(room)
    const settled = await readRoomHistory(stub)
    expect(hitPointsOf(before, NEAR_ID)).toBeGreaterThan(hitPointsOf(settled, NEAR_ID) ?? 0)
  }, 120000)
})

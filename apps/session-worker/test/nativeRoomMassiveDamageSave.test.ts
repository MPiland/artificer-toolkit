import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0x830)
const HOLDER_ID = testUuid(0x831)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf bites another (11 hit points) for `damage`, with massive damage on or off. */
async function bitingRoom(damage: number, massiveDamage = true) {
  const attacker = biteWolf('ATTACK', { damage })
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds: massiveDamage ? ['MASSIVE_DAMAGE'] : []
  })
}

/** The massive-damage save outputs, one per save the Run settled. */
function massiveDamageSaves(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'MASSIVE_DAMAGE'
      ? [execution.applicationOutputs]
      : []
  })
}

/** Starts the Bite and enters a hitting attack die; nobody auto-rolls. */
async function biteHits(room: Awaited<ReturnType<typeof bitingRoom>>) {
  const { answer } = await room.startAction(HOLDER_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected an attack roll.')
  const hit = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId: attack.pending.request.requestId,
    rawFaces: [19],
    rollMode: attack.pending.request.rollMode
  })
  expect(hit.type, JSON.stringify(hit)).toBe('COMMAND_COMMITTED')
}

async function biteAndSave(face: number) {
  const room = await bitingRoom(6)
  await biteHits(room)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a massive-damage save.')
  // Half the holder's 11 hit points, rounded up, owes the rule's DC 15 Constitution save.
  expect(decision.pending).toMatchObject({
    rollerActorId: HOLDER_ID,
    trigger: { kind: 'MASSIVE_DAMAGE', dc: 15 },
    request: { min: 1, max: 20, rollMode: 'NORMAL' }
  })
  const pending = await readRoomHistory(room.room.base.stub)
  expect(massiveDamageSaves(pending)).toEqual([])
  expect(readActorHitPoints(pending, HOLDER_ID)).toBe(5)
  const { request } = decision.pending
  const resolved = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [face],
    rollMode: request.rollMode
  })
  expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
  return { room, after: await readRoomHistory(room.room.base.stub) }
}

describe('room massive-damage save', () => {
  it('records a failed save and changes nothing else', async () => {
    const { room, after } = await biteAndSave(2)
    expect(massiveDamageSaves(after)).toMatchObject([
      {
        outcome: 'SAVE_FAILURE',
        application: { targetActorId: HOLDER_ID, appliedAmount: 6 },
        d20: { selectedNatural: 2, dc: 15 }
      }
    ])
    expect(readActorHitPoints(after, HOLDER_ID)).toBe(5)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('records a made save', async () => {
    const { room, after } = await biteAndSave(20)
    expect(massiveDamageSaves(after)).toMatchObject([{ outcome: 'SAVE_SUCCESS' }])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('undoes the Bite with its recorded save', async () => {
    const { room } = await biteAndSave(2)
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(readActorHitPoints(await readRoomHistory(room.room.base.stub), HOLDER_ID)).toBe(11)
  })

  it('owes no save below half the maximum or with the rule off', async () => {
    for (const room of [await bitingRoom(5), await bitingRoom(6, false)]) {
      await biteHits(room)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(massiveDamageSaves(await readRoomHistory(room.room.base.stub))).toEqual([])
    }
  })
})

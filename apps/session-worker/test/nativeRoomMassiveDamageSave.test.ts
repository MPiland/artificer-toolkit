import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
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
async function bitingRoom(
  damage: number,
  massiveDamage = true,
  seed?: Parameters<typeof actionRoom>[0]['seed']
) {
  const attacker = biteWolf('ATTACK', { damage })
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds: massiveDamage ? ['MASSIVE_DAMAGE'] : [],
    seed
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

/** The failed save raises the SRD System Shock on the holder: the holder enters `face` on its d10. */
async function enterShock(room: Awaited<ReturnType<typeof bitingRoom>>, face: number) {
  const dice = await room.pendingDecision()
  if (dice.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
    throw new Error(`Expected the System Shock die, got ${dice.pending.kind}.`)
  expect(dice.pending).toMatchObject({ rollerActorId: HOLDER_ID, request: { min: 1, max: 10 } })
  const answer = await room.resolve(dice, {
    kind: 'ENTER_INTEGER',
    requestId: dice.pending.request.requestId,
    value: face
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('room massive-damage save', () => {
  it('records a failed save and rolls System Shock on the holder', async () => {
    const { room, after } = await biteAndSave(2)
    expect(massiveDamageSaves(after)).toMatchObject([
      {
        outcome: 'SAVE_FAILURE',
        application: { targetActorId: HOLDER_ID, appliedAmount: 6 },
        d20: { selectedNatural: 2, dc: 15 }
      }
    ])
    expect(readActorHitPoints(after, HOLDER_ID)).toBe(5)
    await enterShock(room, 1)
    expect(readActorHitPoints(await readRoomHistory(room.room.base.stub), HOLDER_ID)).toBe(0)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('records a made save', async () => {
    const { room, after } = await biteAndSave(20)
    expect(massiveDamageSaves(after)).toMatchObject([{ outcome: 'SAVE_SUCCESS' }])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('undoes the Bite with its recorded save and System Shock', async () => {
    const { room } = await biteAndSave(2)
    await enterShock(room, 1)
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

describe('room massive-damage save with a die the holder keeps for after the d20 (SPELLS-31.T4c1b)', () => {
  const heldDieRoom = () =>
    bitingRoom(
      6,
      true,
      seedModifierGrant({
        sourceActorId: HOLDER_ID,
        holderActorId: HOLDER_ID,
        lifecycle: {},
        effect: heldSaveDieEffect(),
        sourceLabel: resistance.label
      })
    )

  /** A natural 10 and the +1 Constitution modifier make 11, four short of the DC 15. */
  async function openWindow(room: Awaited<ReturnType<typeof heldDieRoom>>) {
    await biteHits(room)
    const save = await room.pendingDecision()
    if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a massive-damage save.')
    const { request } = save.pending
    const rolled = await room.resolve(save, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [10],
      rollMode: request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
    return { decision, pending: decision.pending }
  }

  const useDie = (
    room: Awaited<ReturnType<typeof heldDieRoom>>,
    opened: Awaited<ReturnType<typeof openWindow>>
  ) =>
    room.resolve(opened.decision, {
      kind: 'D20_WINDOW_USE',
      requestId: opened.pending.requestId,
      optionId: opened.pending.options[0]!.optionId,
      faces: [4]
    })

  it('saves with the die and owes no System Shock', async () => {
    const room = await heldDieRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const opened = await openWindow(room)
    expect(opened.pending).toMatchObject({
      rollerActorId: HOLDER_ID,
      d20: { selectedNatural: 10, total: 11 },
      options: [{ label: 'Resistance', count: 1, faces: 4, sign: 'ADD' }]
    })
    // Nothing settles while the window pends.
    expect(massiveDamageSaves(await readRoomHistory(room.room.base.stub))).toEqual([])

    const settled = await useDie(room, opened)
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(massiveDamageSaves(after)).toMatchObject([
      {
        outcome: 'SAVE_SUCCESS',
        d20: { selectedNatural: 10, total: 15, dc: 15 }
      }
    ])
    expect(after.activeEffects).toHaveLength(before.activeEffects.length - 1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('keeps the die and the 11 when declined, so the save fails into System Shock', async () => {
    const room = await heldDieRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const opened = await openWindow(room)
    const settled = await room.resolve(opened.decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: opened.pending.requestId
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(massiveDamageSaves(after)).toMatchObject([
      { outcome: 'SAVE_FAILURE', d20: { selectedNatural: 10, total: 11 } }
    ])
    expect(after.activeEffects).toHaveLength(before.activeEffects.length)
    await enterShock(room, 1)
  })

  it('undoes a spent die with the Bite', async () => {
    const room = await heldDieRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const heldIds = before.activeEffects.map((effect) => effect.id)
    const opened = await openWindow(room)
    await useDie(room, opened)
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(
      heldIds.length - 1
    )

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.activeEffects.map((effect) => effect.id).sort()).toEqual([...heldIds].sort())
    expect(readActorHitPoints(reverted, HOLDER_ID)).toBe(11)
  })
})

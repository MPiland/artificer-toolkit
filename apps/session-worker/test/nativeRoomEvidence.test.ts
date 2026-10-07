import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { liveSessionWebSocketClientMessageDtoSchema } from '@artificer-toolkit/schema/api/liveSessions'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x600)
const TARGET_ID = testUuid(0x601)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A room whose acting Wolf has `creature` and whose target is a plain Wolf. */
function wolvesRoom(
  creature: CreatureAuthored,
  options: Omit<Parameters<typeof actionRoom>[0], 'actors' | 'ownerFeatureId'> = {}
) {
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(creature, 'Bite').id
  })
}

/** Every stored d20 evidence record (it carries both roll modes) in the Run's rule receipts. */
function storedD20Evidence(history: RoomHistory) {
  // Phase receipts repeat earlier evidence, so each request is reported once.
  const found = new Map<unknown, Record<string, unknown>>()
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if ('derivedRollMode' in record && 'rawFaces' in record) found.set(record.requestId, record)
      else Object.values(record).forEach(visit)
    }
  }
  for (const receipt of history.receipts) visit(parseReceiptExecution(receipt))
  return [...found.values()]
}

/** Starts the action and returns the pending d20 prompt the room raised for it. */
async function startedWithPrompt(room: Awaited<ReturnType<typeof wolvesRoom>>) {
  const { answer } = await room.startAction(TARGET_ID)
  expect(answer.type).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
  return { ...decision, pending: decision.pending }
}

describe('room d20 evidence', () => {
  it('lets the GM roll a creature save twice and settles the latest roll', async () => {
    // The two app rolls show 5, then 12.
    const room = await wolvesRoom(biteWolf('SAVE'), { rolls: [4, 11] })
    const decision = await startedWithPrompt(room)
    expect(decision.pending.rollerActorId).toBe(TARGET_ID)

    // "Roll dice" twice: each attempt is recorded and nothing settles.
    expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
    expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(room.room.base.stub)).evidenceRolls
    expect(held.map((row) => row.attempt)).toEqual([1, 2])
    expect(held.map((row) => row.faces)).toEqual([[5], [12]])
    expect(await readPendingActionDecision(room.room.base.stub)).toEqual(decision)

    // Only the latest roll of this request by this responder settles it.
    for (const rollId of [held[0]!.id, crypto.randomUUID()])
      expect(
        await room.resolve(decision, {
          kind: 'SYSTEM_ROLL',
          requestId: decision.pending.request.requestId,
          rollId
        })
      ).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'ROLL_UNAVAILABLE' })
    expect(
      (
        await room.resolve(decision, {
          kind: 'SYSTEM_ROLL',
          requestId: decision.pending.request.requestId,
          rollId: held[1]!.id
        })
      ).type
    ).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(storedD20Evidence(await readRoomHistory(room.room.base.stub))).toEqual([
      expect.objectContaining({
        requestId: decision.pending.request.requestId,
        rawFaces: held[1]!.faces,
        rollMode: decision.pending.request.rollMode,
        derivedRollMode: decision.pending.request.rollMode
      })
    ])
  })

  it('settles an overridden advantage app roll with both faces and the selected natural', async () => {
    // The two advantage dice show 3 and 16.
    const room = await wolvesRoom(biteWolf('SAVE'), { rolls: [2, 15] })
    const decision = await startedWithPrompt(room)
    expect(decision.pending.request.rollMode).toBe('NORMAL')
    expect((await room.rollDice(decision, 'ADVANTAGE')).type).toBe('COMMAND_COMMITTED')
    const [held] = (await readRoomHistory(room.room.base.stub)).evidenceRolls
    expect(held).toMatchObject({
      faces: [3, 16],
      value: 16,
      rollMode: 'ADVANTAGE',
      derivedRollMode: 'NORMAL'
    })
    await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: decision.pending.request.requestId,
      rollId: held!.id
    })
    expect(storedD20Evidence(await readRoomHistory(room.room.base.stub))).toEqual([
      expect.objectContaining({
        rawFaces: [3, 16],
        selectedNatural: 16,
        rollMode: 'ADVANTAGE',
        derivedRollMode: 'NORMAL'
      })
    ])
  })

  it('lets the GM enter an attack roll and rejects a forged face count', async () => {
    const room = await wolvesRoom(biteWolf('ATTACK'))
    const decision = await startedWithPrompt(room)
    expect(decision.pending.rollerActorId).toBe(SOURCE_ID)
    const frame = (rawFaces: number[]) => ({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: room.resolveCommand(decision, {
          kind: 'ENTER_DICE',
          requestId: decision.pending.request.requestId,
          rawFaces,
          rollMode: 'ADVANTAGE'
        })
      }
    })
    // The room drops a frame the wire contract refuses, so a forged face count never reaches it.
    expect(liveSessionWebSocketClientMessageDtoSchema.safeParse(frame([18])).success).toBe(false)
    expect(liveSessionWebSocketClientMessageDtoSchema.safeParse(frame([3, 18])).success).toBe(true)
    expect(
      (
        await room.resolve(decision, {
          kind: 'ENTER_DICE',
          requestId: decision.pending.request.requestId,
          rawFaces: [3, 18],
          rollMode: 'ADVANTAGE'
        })
      ).type
    ).toBe('COMMAND_COMMITTED')
    expect(storedD20Evidence(await readRoomHistory(room.room.base.stub))).toEqual([
      expect.objectContaining({
        rawFaces: [3, 18],
        selectedNatural: 18,
        rollMode: 'ADVANTAGE',
        derivedRollMode: 'NORMAL'
      })
    ])
  })

  it('raises no save prompt in a Manual Run, where a save-forcing action is refused whole', async () => {
    const room = await wolvesRoom(biteWolf('SAVE'), { automationMode: 'MANUAL' })
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await room.startAction(TARGET_ID)
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(storedD20Evidence(before)).toEqual([])
  })

  it('rolls on the server without a prompt when the roller auto-rolls', async () => {
    // The target's save die shows 7.
    const room = await wolvesRoom(biteWolf('SAVE'), { autoRoll: 'GAME_MASTER', rolls: [6] })
    const { answer } = await room.startAction(TARGET_ID)
    expect(answer.type).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(storedD20Evidence(await readRoomHistory(room.room.base.stub))).toEqual([
      expect.objectContaining({ rawFaces: [7], rollMode: 'NORMAL', derivedRollMode: 'NORMAL' })
    ])
  })
})

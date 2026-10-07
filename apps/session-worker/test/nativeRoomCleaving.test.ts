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
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x900)
const TARGET_IDS = [testUuid(0x901), testUuid(0x902), testUuid(0x903)]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Wolf whose Bite hits for 40 within 20 ft, beside three plain Wolves of 11 hit points: with
 * Cleaving on, the finalized damage carries through the chain (40 - 11 = 29, then 29 - 11 = 18).
 */
function cleavingRoom(options: { autoRoll?: 'GAME_MASTER'; rolls?: readonly number[] }) {
  const attacker = biteWolf('ATTACK', { damage: 40, reachFeet: 20 })
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: attacker }),
      ...TARGET_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds: ['CLEAVING']
  })
}

type CleavingRoom = Awaited<ReturnType<typeof cleavingRoom>>

/** The attack at the first target, with the Scene tokens Cleaving measures from. */
async function startAttack(room: CleavingRoom) {
  const { answer } = await room.startAction(TARGET_IDS[0]!, [], room.sceneContext())
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The Cleaving choice the room offers the GM, and the way to answer it with its first option. */
async function pendingChoice(room: CleavingRoom) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'OPTIONAL_COMBAT_CLEAVING')
    throw new Error('Expected the Cleaving choice.')
  return { ...decision, pending: decision.pending }
}

describe('room Cleaving chain', () => {
  it.each(['AUTO_ROLL', 'PROMPT'] as const)(
    'carries one finalized %s attack through a bounded chain without rolling again',
    async (mode) => {
      // The attack die shows 19 and hits.
      const room = await cleavingRoom(
        mode === 'AUTO_ROLL' ? { autoRoll: 'GAME_MASTER', rolls: [18] } : { rolls: [18] }
      )
      await startAttack(room)
      if (mode === 'PROMPT') {
        const prompt = await room.pendingDecision()
        if (prompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
        const { request } = prompt.pending
        const answered = await room.resolve(prompt, {
          kind: 'ENTER_DICE',
          requestId: request.requestId,
          rawFaces: request.rollMode === 'NORMAL' ? [19] : [19, 19],
          rollMode: request.rollMode
        })
        expect(answered.type).toBe('COMMAND_COMMITTED')
      }
      const dice = room.room.diceDrawn()

      const first = await pendingChoice(room)
      expect(first.pending.options).toHaveLength(2)
      expect(
        (
          await room.resolve(first, {
            kind: 'OPTION',
            optionId: first.pending.options[0]!.optionId
          })
        ).type
      ).toBe('COMMAND_COMMITTED')
      const second = await pendingChoice(room)
      expect(second.pending.options).toHaveLength(1)
      expect(second.occurrence.id).not.toBe(first.occurrence.id)
      expect(
        (
          await room.resolve(second, {
            kind: 'OPTION',
            optionId: second.pending.options[0]!.optionId
          })
        ).type
      ).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

      const history = await readRoomHistory(room.room.base.stub)
      expect(
        history.actors
          .filter((actor) => actor.id !== SOURCE_ID)
          .map((actor) => JSON.parse(actor.stateJson).currentHitPoints)
      ).toEqual([0, 0, 0])
      // The chain's children carry the finalized damage: no die was drawn for them.
      expect(room.room.diceDrawn()).toBe(dice)
      const carried = history.receipts
        .map((receipt) => parseReceiptExecution(receipt))
        .flatMap((execution) =>
          execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
          execution.applicationOutputs.kind === 'CLEAVING_DAMAGE'
            ? [execution.applicationOutputs.damage.requestedAmount]
            : []
        )
      expect(carried.sort((left, right) => right - left)).toEqual([29, 18])
    }
  )
})

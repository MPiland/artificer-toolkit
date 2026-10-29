import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
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

const SOURCE_ID = testUuid(0x900)
const TARGET_IDS = [testUuid(0x901), testUuid(0x902), testUuid(0x903)]
const ENDING_GRANT_ID = testUuid(0x904)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Wolf whose Bite hits for 40 within 20 ft, beside three plain Wolves of 11 hit points: with
 * Cleaving on, the finalized damage carries through the chain (40 - 11 = 29, then 29 - 11 = 18).
 */
function cleavingRoom(options: {
  autoRoll?: 'GAME_MASTER'
  rolls?: readonly number[]
  /** The target that holds a Concentration the Bite then ends. */
  concentrationOwnerActorId?: string
  /** The target that holds a grant ending on incapacitation (D113), which the Bite's chain defeats. */
  grantHolderActorId?: string
  /** The creatures the Bite can reach; the first is the attack's target. */
  targetIds?: readonly string[]
}) {
  const attacker = biteWolf('ATTACK', { damage: 40, reachFeet: 20 })
  return actionRoom({
    ...options,
    concentration: options.concentrationOwnerActorId !== undefined,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: attacker }),
      ...(options.targetIds ?? TARGET_IDS).map((id) =>
        srdCreatureActor({ id, creature: plainWolf })
      )
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds: ['CLEAVING'],
    seed: async ({ effects, encounterId, occurredAt }) => {
      if (options.grantHolderActorId === undefined) return
      await effects.create({
        id: ENDING_GRANT_ID,
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId,
          targetActorId: options.grantHolderActorId
        },
        lifecycle: { schemaVersion: 1, remainingTicks: 10 },
        definition: plannedModifierGrant({
          encounterId,
          sourceActorId: options.grantHolderActorId,
          holderActorId: options.grantHolderActorId,
          lifecycle: {
            endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_INCAPACITATED' }]
          },
          rounds: 10
        }).definition,
        occurredAt
      })
    }
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

  describe('with a target that holds a grant ending on incapacitation (D113)', () => {
    it('ends the grant in the response that defeats its holder, and the action’s undo restores it', async () => {
      const room = await cleavingRoom({
        autoRoll: 'GAME_MASTER',
        rolls: [18],
        grantHolderActorId: TARGET_IDS[1],
        targetIds: TARGET_IDS.slice(0, 2)
      })
      await startAttack(room)
      const heldGrantIds = async () =>
        (await readRoomHistory(room.room.base.stub)).activeEffects.map((effect) => effect.id)
      expect(await heldGrantIds()).toContain(ENDING_GRANT_ID)

      const first = await pendingChoice(room)
      const option = first.pending.options.find((entry) => entry.targetActorId === TARGET_IDS[1])
      const answered = await room.resolve(first, { kind: 'OPTION', optionId: option!.optionId })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
      expect(await heldGrantIds()).not.toContain(ENDING_GRANT_ID)

      const undone = await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
      expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
      expect(await heldGrantIds()).toContain(ENDING_GRANT_ID)
    })

    it('ends the grant in a later response of the chain, whose parent is the earlier response', async () => {
      const room = await cleavingRoom({
        autoRoll: 'GAME_MASTER',
        rolls: [18],
        grantHolderActorId: TARGET_IDS[2]
      })
      await startAttack(room)
      const heldGrantIds = async () =>
        (await readRoomHistory(room.room.base.stub)).activeEffects.map((effect) => effect.id)

      const first = await pendingChoice(room)
      const toSecond = first.pending.options.find((entry) => entry.targetActorId === TARGET_IDS[1])
      expect(
        (await room.resolve(first, { kind: 'OPTION', optionId: toSecond!.optionId })).type
      ).toBe('COMMAND_COMMITTED')
      expect(await heldGrantIds()).toContain(ENDING_GRANT_ID)

      const second = await pendingChoice(room)
      const answered = await room.resolve(second, {
        kind: 'OPTION',
        optionId: second.pending.options[0]!.optionId
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
      expect(await heldGrantIds()).not.toContain(ENDING_GRANT_ID)
    })
  })

  describe('with a target that holds Concentration (D95)', () => {
    const concentrationEnds = (history: RoomHistory) =>
      history.receipts.flatMap((receipt) => {
        const execution = parseReceiptExecution(receipt)
        return execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
          execution.applicationOutputs.kind === 'CONCENTRATION_END'
          ? [execution.applicationOutputs]
          : []
      })

    it('ends a defeated first target’s Concentration in the attack commit that offers the chain', async () => {
      const room = await cleavingRoom({
        autoRoll: 'GAME_MASTER',
        rolls: [18],
        concentrationOwnerActorId: TARGET_IDS[0]
      })
      await startAttack(room)
      const offered = await readRoomHistory(room.room.base.stub)
      expect(offered.maintainedStates).toEqual([])
      expect(concentrationEnds(offered)).toMatchObject([
        { ownerActorId: TARGET_IDS[0], reason: 'DEFEATED' }
      ])
      const first = await pendingChoice(room)
      expect(
        (
          await room.resolve(first, {
            kind: 'OPTION',
            optionId: first.pending.options[0]!.optionId
          })
        ).type
      ).toBe('COMMAND_COMMITTED')
      expect(concentrationEnds(await readRoomHistory(room.room.base.stub))).toHaveLength(1)
    })

    it('ends a later target’s Concentration in the Cleaving response commit that defeats it', async () => {
      const room = await cleavingRoom({
        autoRoll: 'GAME_MASTER',
        rolls: [18],
        concentrationOwnerActorId: TARGET_IDS[1]
      })
      await startAttack(room)
      const offered = await readRoomHistory(room.room.base.stub)
      expect(offered.maintainedStates).toHaveLength(1)
      expect(concentrationEnds(offered)).toEqual([])
      const first = await pendingChoice(room)
      const option = first.pending.options.find((entry) => entry.targetActorId === TARGET_IDS[1])
      const answer = await room.resolve(first, { kind: 'OPTION', optionId: option!.optionId })
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const settled = await readRoomHistory(room.room.base.stub)
      expect(settled.maintainedStates).toEqual([])
      expect(concentrationEnds(settled)).toMatchObject([
        { ownerActorId: TARGET_IDS[1], reason: 'DEFEATED' }
      ])
    })
  })
})

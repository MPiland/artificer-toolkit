import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { dependentEffectDefinition } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomChatBodies,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0x800)
const CHARACTER_ACTOR_ID = testUuid(0x801)
const CHARACTER_ID = testUuid(0x802)
const DEPENDENT_HOLDER_ID = testUuid(0x803)
const INDEPENDENT_EFFECT_ID = testUuid(0x5300)
const HOLDER_ID = testUuid(0x804)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Wolf hits the Character, who maintains Concentration (the maintained state, with one dependent
 * effect on another Wolf and one independent effect that outlives it). `autoRoll` BOTH makes the
 * Character's player roll its Constitution save on the server; GAME_MASTER leaves it a prompt.
 */
function concentratingRoom(
  options: Pick<
    Parameters<typeof actionRoom>[0],
    'autoRoll' | 'automationMode' | 'rolls' | 'characterPlay'
  >
) {
  const attacker = biteWolf('ATTACK')
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: DEPENDENT_HOLDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    concentration: true,
    concentrationOwnerActorId: CHARACTER_ACTOR_ID,
    concentrationDependentActorIds: [DEPENDENT_HOLDER_ID],
    seed: async ({ effects, encounterId, occurredAt }) => {
      await effects.create({
        id: INDEPENDENT_EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: DEPENDENT_HOLDER_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: 3 },
        definition: dependentEffectDefinition({ encounterId, sourceActorId: DEPENDENT_HOLDER_ID }),
        occurredAt
      })
    }
  })
}

type ConcentratingRoom = Awaited<ReturnType<typeof concentratingRoom>>

const effectIds = (history: RoomHistory) => history.activeEffects.map((effect) => effect.id)

/** The room's Concentration check outputs, one per check the Run settled. */
function concentrationChecks(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'CONCENTRATION_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
}

/** The attacker's Bite on the Character: a settled parent action and its Character batch. */
async function startedBite(room: ConcentratingRoom) {
  const { command, answer } = await room.startAction(CHARACTER_ACTOR_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const parent = (await readRoomHistory(room.room.base.stub)).receipts.find(
    (receipt) => receipt.commandId === command.commandId
  )
  if (!parent) throw new Error('The parent action receipt is missing.')
  const execution = parseReceiptExecution(parent)
  if (execution.status !== 'COMPLETE') throw new Error('The parent action did not complete.')
  expect(execution.applicationOutputs.kind).toBe('CHARACTER_MECHANICS_BATCH')
}

describe('room Concentration checks', () => {
  it('pauses on the Character’s player and keeps the Concentration on a successful save', async () => {
    // The Wolf's attack die shows 19 and hits for 1 damage.
    const room = await concentratingRoom({ autoRoll: 'GAME_MASTER', rolls: [18] })
    const before = await readRoomHistory(room.room.base.stub)
    expect(before.maintainedStates).toHaveLength(1)
    await startedBite(room)

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    expect(decision.pending).toMatchObject({
      rollerActorId: CHARACTER_ACTOR_ID,
      request: { min: 1, max: 20, rollMode: 'NORMAL' }
    })
    expect(concentrationChecks(await readRoomHistory(room.room.base.stub))).toEqual([])

    const { request } = decision.pending
    const answer = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [20],
      rollMode: request.rollMode
    })
    expect(answer.type).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([{ outcome: 'SAVE_SUCCESS' }])
    expect(after.maintainedStates.map((state) => state.id)).toEqual(
      before.maintainedStates.map((state) => state.id)
    )
    expect(effectIds(after)).toEqual(expect.arrayContaining(effectIds(before)))
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('ends the exact Concentration and its dependent effect on a failed save, keeping an independent one', async () => {
    const room = await concentratingRoom({ autoRoll: 'GAME_MASTER', rolls: [18] })
    const before = await readRoomHistory(room.room.base.stub)
    const [dependentId] = room.room.dependentEffectIds
    expect(effectIds(before)).toEqual(expect.arrayContaining([dependentId, INDEPENDENT_EFFECT_ID]))
    await startedBite(room)

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    const { request } = decision.pending
    const answer = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [1],
      rollMode: request.rollMode
    })
    expect(answer.type).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([{ outcome: 'SAVE_FAILURE' }])
    expect(after.maintainedStates).toEqual([])
    expect(effectIds(after)).toEqual([INDEPENDENT_EFFECT_ID])
    expect(after.runs[0]!.version).toBeGreaterThan(before.runs[0]!.version)
  })

  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' as const, kept: true },
    { face: 1, outcome: 'SAVE_FAILURE' as const, kept: false }
  ])(
    'settles an auto-rolled Concentration save atomically for $outcome',
    async ({ face, outcome, kept }) => {
      // The attack die shows 19; the Character's player auto-rolls the save die.
      const room = await concentratingRoom({ autoRoll: 'BOTH', rolls: [18, face - 1] })
      const [dependentId] = room.room.dependentEffectIds
      await startedBite(room)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      const after = await readRoomHistory(room.room.base.stub)
      expect(concentrationChecks(after)).toMatchObject([{ outcome }])
      expect(after.maintainedStates).toHaveLength(kept ? 1 : 0)
      expect(effectIds(after).includes(dependentId!)).toBe(kept)
      expect(effectIds(after)).toContain(INDEPENDENT_EFFECT_ID)
    }
  )

  it('raises no Concentration check when the finalized applied damage is zero', async () => {
    // The Character is already at 0 hit points, so the Wolf's hit applies no damage.
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { currentHitPoints: 0 }
    })
    const before = await readRoomHistory(room.room.base.stub)
    await startedBite(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toEqual([])
    expect(after.maintainedStates.map((state) => state.id)).toEqual(
      before.maintainedStates.map((state) => state.id)
    )
  })

  it('raises no Concentration prompt in a Manual Run, where the damaging action is refused whole', async () => {
    const room = await concentratingRoom({ automationMode: 'MANUAL' })
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID)
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
    expect(before.maintainedStates).toHaveLength(1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})

const conditionId = (code: string) => {
  const condition = srdSystemRecord.conditionTypes.find((candidate) => candidate.code === code)
  if (!condition) throw new Error(`The SRD ${code} condition is missing.`)
  return condition.id
}

/** A Creature holds the Concentration the Wolf's Bite then hits (with a dependent effect on a second Wolf). */
function creatureHolderRoom(
  holder: Pick<Parameters<typeof srdCreatureActor>[0], 'conditionIds' | 'currentHitPoints'> & {
    hidden?: boolean
  }
) {
  const attacker = biteWolf('ATTACK')
  const { hidden, ...holderOptions } = holder
  return actionRoom({
    autoRoll: 'GAME_MASTER',
    rolls: [18],
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      {
        ...srdCreatureActor({ id: HOLDER_ID, creature: plainWolf, ...holderOptions }),
        public: !hidden
      },
      srdCreatureActor({ id: DEPENDENT_HOLDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    concentration: true,
    concentrationOwnerActorId: HOLDER_ID,
    concentrationDependentActorIds: [DEPENDENT_HOLDER_ID]
  })
}

/** The Concentration end children (D95) the room recorded, one receipt each. */
function concentrationEnds(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return receipt.commandType === 'CONCENTRATION_END' &&
      execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
      execution.applicationOutputs.kind === 'CONCENTRATION_END'
      ? [{ receipt, output: execution.applicationOutputs }]
      : []
  })
}

describe('room Concentration ends without a check (D95)', () => {
  it('ends a Character’s Concentration when the hit drops it to 0 hit points, rolling and prompting nothing', async () => {
    // The Wolf's hit deals 1 damage to a Character on 1 hit point, who falls Unconscious.
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { currentHitPoints: 1 }
    })
    const [dependentId] = room.room.dependentEffectIds
    const before = await readRoomHistory(room.room.base.stub)
    await startedBite(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toEqual([])
    expect(after.maintainedStates).toEqual([])
    expect(effectIds(after)).not.toContain(dependentId)
    expect(effectIds(after)).toContain(INDEPENDENT_EFFECT_ID)
    const [end, ...others] = concentrationEnds(after)
    expect(others).toEqual([])
    expect(end!.output).toMatchObject({
      kind: 'CONCENTRATION_END',
      ownerActorId: CHARACTER_ACTOR_ID,
      maintainedStateId: before.maintainedStates[0]!.id,
      reason: 'INCAPACITATED',
      cleanup: { maintainedStateId: before.maintainedStates[0]!.id }
    })
    expect(end!.output.cleanup.removedDependentEffectIds).toContain(dependentId)
    const parent = after.receipts.find((receipt) => receipt.commandType !== 'CONCENTRATION_END')
    expect(end!.output.parentOccurrenceId).toBe(parent!.occurrenceId)
  })

  it('refuses to undo an action whose damage ended a Concentration, naming what it cannot restore', async () => {
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { currentHitPoints: 1 }
    })
    await startedBite(room)
    const answer = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE',
      message: expect.stringContaining('lost Concentration')
    })
  })

  it.each([
    { name: 'defeated', holder: { currentHitPoints: 1 }, reason: 'DEFEATED' as const },
    {
      name: 'Paralyzed',
      holder: { conditionIds: [conditionId('PARALYZED')] },
      reason: 'INCAPACITATED' as const
    },
    {
      name: 'Stunned',
      holder: { conditionIds: [conditionId('STUNNED')] },
      reason: 'INCAPACITATED' as const
    },
    {
      name: 'Incapacitated',
      holder: { conditionIds: [conditionId('INCAPACITATED')] },
      reason: 'INCAPACITATED' as const
    }
  ])(
    'ends a Creature’s Concentration when it is $name, with no check and a table notice',
    async (scenario) => {
      const room = await creatureHolderRoom(scenario.holder)
      const before = await readRoomHistory(room.room.base.stub)
      expect(before.maintainedStates).toHaveLength(1)
      const { answer } = await room.startAction(HOLDER_ID)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      const after = await readRoomHistory(room.room.base.stub)
      expect(concentrationChecks(after)).toEqual([])
      expect(after.maintainedStates).toEqual([])
      expect(after.activeEffects).toEqual([])
      expect(concentrationEnds(after).map(({ output }) => output.reason)).toEqual([scenario.reason])
      expect(await readRoomChatBodies(room.room.base.stub)).toEqual([
        expect.stringMatching(
          scenario.reason === 'DEFEATED'
            ? /is defeated and loses Concentration\.$/
            : /can't act and loses Concentration\.$/
        )
      ])
    }
  )

  it('posts no notice for a hidden Creature’s end, which is private like its check card', async () => {
    const room = await creatureHolderRoom({ conditionIds: [conditionId('STUNNED')], hidden: true })
    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationEnds(after)).toHaveLength(1)
    expect(after.maintainedStates).toEqual([])
    expect(await readRoomChatBodies(room.room.base.stub)).toEqual([])
  })

  it('ends a Character’s Concentration while a Sheet condition stops it acting, posting the table notice', async () => {
    const stunned = { conditionTypeId: conditionId('STUNNED'), label: 'Stunned' }
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { conditions: [stunned] }
    })
    await startedBite(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toEqual([])
    expect(after.maintainedStates).toEqual([])
    expect(concentrationEnds(after).map(({ output }) => output.reason)).toEqual(['INCAPACITATED'])
    expect(await readRoomChatBodies(room.room.base.stub)).toEqual([
      expect.stringMatching(/can't act and loses Concentration\.$/)
    ])
  })

  it('keeps a Character’s Concentration while it is only Grappled and Restrained (speed 0), asking for the check', async () => {
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: {
        conditions: [
          { conditionTypeId: conditionId('GRAPPLED'), label: 'Grappled' },
          { conditionTypeId: conditionId('RESTRAINED'), label: 'Restrained' }
        ]
      }
    })
    await startedBite(room)
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationEnds(after)).toEqual([])
    expect(after.maintainedStates).toHaveLength(1)
    expect((await room.pendingDecision()).pending.kind).toBe('D20_EVIDENCE')
  })
})

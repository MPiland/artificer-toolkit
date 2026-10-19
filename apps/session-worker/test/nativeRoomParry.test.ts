import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-33.T4k1: a melee attack that hits a Creature holding Parry (an authored `ATTACKED_SELF`
 * reaction qualified to a melee attack the reactor sees) offers the GM Use or Decline before the
 * outcome applies. Use spends the Creature's reaction and adds its Armor Class bonus against that one
 * attack only.
 */

const WOLF_ID = testUuid(0x7e0)
const KNIGHT_ID = testUuid(0x7e1)
const KNIGHT_PARRY_BONUS = 2
const meleeBite = biteWolf('ATTACK')

/** The attack Bite made a ranged weapon attack, so Parry's melee qualifier refuses it. */
const rangedBite = creatureAuthoredDtoSchema.parse({
  ...meleeBite,
  features: meleeBite.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          effects: feature.effects?.map((effect) => ({
            ...effect,
            invocation: { ...effect.invocation, triggerCode: 'RANGED_WEAPON_ATTACK' as const }
          }))
        }
  )
})

const blindedId = () => {
  const found = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  if (!found) throw new Error('Missing BLINDED condition fixture.')
  return found.id
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf whose Bite attacks first, next to a Knight. */
function parryRoom({
  bite = meleeBite,
  knightConditionIds = [],
  ...options
}: Omit<Parameters<typeof actionRoom>[0], 'actors' | 'ownerFeatureId'> & {
  bite?: typeof meleeBite
  knightConditionIds?: string[]
} = {}) {
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: bite }),
      srdCreatureActor({ id: KNIGHT_ID, creature: knight, conditionIds: knightConditionIds })
    ],
    ownerFeatureId: creatureFeature(bite, 'Bite').id
  })
}
type Room = Awaited<ReturnType<typeof parryRoom>>

/**
 * Starts the Bite at the Knight and answers its attack d20 so the total beats the Knight's armor
 * class by `margin` (0 hits it exactly). Returns the armor class the attack was bound to.
 */
async function strike(room: Room, margin: number) {
  const started = await room.startAction(KNIGHT_ID)
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack d20.')
  const context = await readPendingActionContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
    throw new Error('Expected a pending attack d20.')
  const { dc, modifier } = context.d20Policy
  const face = dc + margin - modifier
  expect(face, 'the face must be neither a natural 1 nor a natural 20').toBeGreaterThan(1)
  expect(face).toBeLessThan(20)
  const { request } = decision.pending
  const answer = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: request.rollMode === 'NORMAL' ? [face] : [face, face],
    rollMode: request.rollMode
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return dc
}

/** The reaction choice the room asks of the GM for the hit Knight. */
async function offeredParry(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The Bite's settled batch on the Knight. */
function knightBatch(history: RoomHistory) {
  const batch = areaReceipts(history).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === KNIGHT_ID
  )?.outputs
  if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') throw new Error('The Bite left no batch.')
  return batch
}

const hitPointsLost = (batch: ReturnType<typeof knightBatch>) =>
  batch.targetTransition.before.currentHitPoints - batch.targetTransition.after.currentHitPoints

async function undoLastAction(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('room Parry against a melee hit (SPELLS-33.T4k1)', () => {
  it('holds the hit for the GM’s choice, applying and spending nothing', async () => {
    const room = await parryRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await strike(room, 0)

    const { pending } = await offeredParry(room)
    expect(pending.targetActorId).toBe(KNIGHT_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    const history = await readRoomHistory(room.room.base.stub)
    expect(areaReceipts(history).children).toEqual([])
    expect(history.actors).toEqual(before.actors)
  })

  it('turns the hit into a miss when used, spends the Knight’s reaction, keeps no effect, and undoes', async () => {
    const room = await parryRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const armorClass = await strike(room, 0)
    const { decision, pending } = await offeredParry(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    const batch = knightBatch(history)
    expect(hitPointsLost(batch)).toBe(0)
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      adjustment: { defenseBefore: armorClass, defenseAfter: armorClass + KNIGHT_PARRY_BONUS },
      actionEconomyTransition: { beforeUsed: 0, afterUsed: 1 },
      activeEffectTransitions: []
    })
    // The bonus counted against this attack alone: nothing stays on the Knight for the next one.
    expect(history.activeEffects).toEqual(before.activeEffects)

    await undoLastAction(room)
    const restored = await readRoomHistory(room.room.base.stub)
    expect(restored.actors).toEqual(before.actors)
    expect(restored.activeEffects).toEqual(before.activeEffects)

    // The reaction is back: the same hit offers Parry again.
    await strike(room, 0)
    await offeredParry(room)
  })

  it('applies the hit when declined, spending no reaction', async () => {
    const room = await parryRoom()
    await strike(room, 0)
    const { decision } = await offeredParry(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    const batch = knightBatch(await readRoomHistory(room.room.base.stub))
    expect(hitPointsLost(batch)).toBe(1)
    expect(batch.reaction).toMatchObject({ selection: 'DECLINE', actionEconomyTransition: null })
  })

  it('offers nothing against a ranged attack', async () => {
    const room = await parryRoom({ bite: rangedBite })
    await strike(room, 0)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const batch = knightBatch(await readRoomHistory(room.room.base.stub))
    expect(hitPointsLost(batch)).toBe(1)
    expect(batch.reaction).toBeNull()
  })

  it('offers nothing to a Knight who cannot see the attacker', async () => {
    const room = await parryRoom({ knightConditionIds: [blindedId()] })
    await strike(room, 0)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(knightBatch(await readRoomHistory(room.room.base.stub)).reaction).toBeNull()
  })

  it('refuses an answer from the attacker’s player: the GM decides for the Knight', async () => {
    const room = await parryRoom({ otherPlayerControlledActorIds: [WOLF_ID] })
    await strike(room, 0)
    const { decision } = await offeredParry(room)

    const refused = await room.sendAsPlayer(
      room.resolveCommand(decision, { kind: 'DECLINE' }),
      'OTHER_PLAYER'
    )
    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(await readPendingActionDecision(room.room.base.stub)).not.toBeNull()
  })
})

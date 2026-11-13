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

/** The settled batch the action of `sourceActorId` left on the Knight. */
function batchOnKnight(history: RoomHistory, sourceActorId: string) {
  const batch = areaReceipts(history).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
      outputs.sourceActorId === sourceActorId &&
      outputs.targetActorId === KNIGHT_ID
  )?.outputs
  if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
    throw new Error(`The action of ${sourceActorId} left no batch.`)
  return batch
}

/**
 * The Bite's settled batch on the Knight. It is picked by its attacker: the Parry the Knight uses
 * as a child action (D219) commits its own batch on the Knight before the Bite's.
 */
const knightBatch = (history: RoomHistory) => batchOnKnight(history, WOLF_ID)

/** The batch the Knight's own Parry, run as a child of the Bite (D219), left on itself. */
const parryChildBatch = (history: RoomHistory) => batchOnKnight(history, KNIGHT_ID)

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

  // Restated (QUALITY-8.T1d2b, D219; architect ruling): Parry runs as the Knight's own child action.
  // Its bonus is no longer an adjustment on the Bite's reaction record that keeps no effect: the
  // child commits it as its own effect, which lasts until the Knight is attacked, and the attack it
  // answered ends it. The title said "keeps no effect"; what holds now is "the effect is committed by
  // the child and ended by the attack it answered", so nothing stays on the Knight either way.
  it('turns the hit into a miss when used, spends the Knight’s reaction, ends its effect with the attack it answered, and undoes', async () => {
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
    // Restated: the Bite's batch records no reaction; its attack is bound again to the Knight as the
    // child left it, so the sealed d20 carries the armor class it missed.
    expect(batch.reaction).toBeNull()
    expect(batch.d20).toMatchObject({
      defenseOrDc: armorClass + KNIGHT_PARRY_BONUS,
      resultPath: 'ON_MISS'
    })
    // Restated: the spent reaction and the effect are the child's, sealed on the batch it committed
    // on the Knight.
    const parry = parryChildBatch(history)
    expect(parry.actionEconomyTransition).toMatchObject({ beforeUsed: 0, afterUsed: 1 })
    expect(parry.activeEffectTransitions).toHaveLength(1)
    // The bonus counted against this attack alone: the Bite that missed ended the child's effect, so
    // nothing stays on the Knight for the next one.
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
    const history = await readRoomHistory(room.room.base.stub)
    const batch = knightBatch(history)
    expect(hitPointsLost(batch)).toBe(1)
    // Restated (QUALITY-8.T1d2b, D219): a declined offer of a reaction that would run as a child
    // leaves no record on the Bite's batch. That no reaction was spent is proved by no child having
    // committed a batch on the Knight: the Bite's is the only one.
    expect(batch.reaction).toBeNull()
    expect(areaReceipts(history).children).toHaveLength(1)
  })

  it('still hits when the roll beats the armor class Parry raised, and the hit ends Parry’s effect (D219)', async () => {
    const room = await parryRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const armorClass = await strike(room, KNIGHT_PARRY_BONUS)
    const { decision, pending } = await offeredParry(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    const batch = knightBatch(history)
    expect(hitPointsLost(batch)).toBe(1)
    expect(batch.d20).toMatchObject({
      defenseOrDc: armorClass + KNIGHT_PARRY_BONUS,
      resultPath: 'ON_HIT'
    })
    const parry = parryChildBatch(history)
    expect(parry.actionEconomyTransition).toMatchObject({ beforeUsed: 0, afterUsed: 1 })
    expect(parry.activeEffectTransitions).toHaveLength(1)
    expect(history.activeEffects).toEqual(before.activeEffects)
  })

  it('lets the GM use Parry for the Knight, and refuses the Knight’s use from the attacker’s player (D219)', async () => {
    const room = await parryRoom({ otherPlayerControlledActorIds: [WOLF_ID] })
    await strike(room, 0)
    const { decision, pending } = await offeredParry(room)
    const use = { kind: 'OPTION' as const, optionId: pending.options[0].optionId }

    const refused = await room.sendAsPlayer(room.resolveCommand(decision, use), 'OTHER_PLAYER')
    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(areaReceipts(await readRoomHistory(room.room.base.stub)).children).toEqual([])

    const used = await room.resolve(decision, use)
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    expect(parryChildBatch(history)).toMatchObject({
      sourceActorId: KNIGHT_ID,
      targetActorId: KNIGHT_ID
    })
    expect(hitPointsLost(knightBatch(history))).toBe(0)
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

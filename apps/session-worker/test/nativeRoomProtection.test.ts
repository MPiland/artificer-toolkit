import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { protectionReactionEffect } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { expireReactionOffer } from './reactionTimeoutClock.js'
import {
  readActorHitPoints,
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.T4k1b with QUALITY-7.1: a Wolf's Bite at another Wolf is held, before its d20, for a
 * Character within 5 feet of the bitten Wolf who holds a reaction to an attack aimed at another (D217).
 * The offer is the shared reaction choice, in the pause every reaction before an action uses. Used, the
 * attack is rolled with the roll mode the reaction authors, and the reaction is spent with the action,
 * so one undo restores it. The engine knows no feature: the SRD Protection and a homebrew reaction that
 * needs no shield take the same path.
 */

const ATTACKER_ID = testUuid(0x7e0)
const TARGET_ID = testUuid(0x7e1)
const REACTOR_ACTOR_ID = testUuid(0x7e2)
const REACTOR_ID = testUuid(0x7e3)
const attackBite = biteWolf('ATTACK')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const protectionOption = fighter.features
  ?.find(({ label }) => label === 'Fighting Style')
  ?.options?.find(({ label }) => label === 'Protection')
if (!protectionOption?.effects) throw new Error('The SRD Fighter has no Protection.')

/** The SRD option as the Character's Feature, exactly as authored. */
const protection: ClassFeature = {
  id: protectionOption.id,
  label: protectionOption.label,
  description: protectionOption.description,
  availableAtLevel: 1,
  order: 1,
  effects: protectionOption.effects
}

/** A homebrew reaction authored as Protection is, but needing no shield and reaching 10 feet. */
const distract: ClassFeature = (() => {
  const effect = protectionReactionEffect({
    effect: testUuid(0x7e8),
    range: testUuid(0x7e9),
    path: testUuid(0x7ea),
    result: testUuid(0x7eb),
    outcome: testUuid(0x7ec)
  })
  if (effect.invocation.kind !== 'ACTION') throw new Error('Protection is not an action.')
  return {
    id: testUuid(0x7e7),
    label: 'Distract',
    description: 'Give an attack on a creature within 10 feet of you disadvantage.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        ...effect,
        invocation: {
          ...effect.invocation,
          reactionTrigger: { kind: 'ATTACK_ON_OTHER', requiresSight: true, targetWithinFeet: 10 }
        }
      }
    ]
  }
})()

/**
 * A Wolf whose Bite (+4) attacks a Wolf (AC 13), with a Character 5 feet beyond the bitten Wolf, or
 * `reactorX` along the row (each 100 px is 5 feet).
 */
function protectorRoom(
  input: { feature?: ClassFeature; shield?: boolean; reactorX?: number } = {}
) {
  const { feature = protection, shield = true, reactorX = 350 } = input
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attackBite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    positions: { [REACTOR_ACTOR_ID]: { x: reactorX, y: 150 } },
    ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
    characterClassFeatures: [feature],
    characterEquipment: shield ? [shieldWood] : []
  })
}
type Room = Awaited<ReturnType<typeof protectorRoom>>

async function bite(room: Room) {
  const started = await room.startAction(TARGET_ID, [], room.sceneContext())
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
}

/** The reaction choice the room asks of the Character before the Bite is rolled. */
async function offered(room: Room) {
  await bite(room)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The Bite's d20 prompt and the roll mode it asks for. */
async function attackPrompt(room: Room) {
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE')
    throw new Error(`Expected the attack prompt, got ${attack.pending.kind}.`)
  return { attack, request: attack.pending.request }
}

async function reactionUsed(room: Room) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(
    ({ id }) => id === REACTOR_ACTOR_ID
  )
  if (!row) throw new Error('The room holds no reactor.')
  return encounterRuleUsageUsed(readStoredRunActor(row), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
}

const targetHitPoints = async (room: Room) =>
  readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)

describe('Protection against an attack on another creature in the room (SPELLS-31.T4k1b)', () => {
  it('asks the Character holding a shield before the Bite is rolled, spending nothing yet', async () => {
    const room = await protectorRoom()
    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(pending.options).toHaveLength(1)
    expect(await reactionUsed(room)).toBe(0)
  })

  it('offers it in the pause every reaction before an action shares, pinned by its trigger', async () => {
    const room = await protectorRoom()
    await offered(room)
    const context = await readPendingActionContext(room.room.base.stub)
    if (context.kind !== 'ENCOUNTER_ACTION' || context.pause?.kind !== 'CAST_REACTION')
      throw new Error('Expected the shared reaction pause.')
    expect(context.pause.payload.kind).toBe('ATTACK_ON_OTHER')
    expect(context.pause.payload.reactions.map(({ trigger }) => trigger)).toEqual([
      'ATTACK_ON_OTHER'
    ])
    expect(context.pause.payload.reactions[0]).toMatchObject({
      reactorActorId: REACTOR_ACTOR_ID
    })
    expect(context.rollerActorId).toBe(REACTOR_ACTOR_ID)
  })

  it('rolls the Bite with disadvantage when used, so the lower face misses; the reaction is spent, and one undo restores it', async () => {
    const room = await protectorRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const hitPoints = await targetHitPoints(room)
    const { decision, pending } = await offered(room)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0]!.optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const { attack, request } = await attackPrompt(room)
    expect(request.rollMode).toBe('DISADVANTAGE')
    // 19 + 4 hits AC 13 alone; beside a 2 the lower face misses.
    const rolled = await room.resolve(attack, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [19, 2],
      rollMode: request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBe(hitPoints)
    expect(await reactionUsed(room)).toBe(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('rolls the Bite as it was when the Character declines, spending nothing', async () => {
    const room = await protectorRoom()
    const hitPoints = await targetHitPoints(room)
    const { decision } = await offered(room)
    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    const { attack, request } = await attackPrompt(room)
    expect(request.rollMode).toBe('NORMAL')
    const rolled = await room.resolve(attack, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [19],
      rollMode: request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    expect(await targetHitPoints(room)).toBeLessThan(hitPoints)
    expect(await reactionUsed(room)).toBe(0)
  })

  it('declines the offer once its time runs out, so the Bite is rolled as it was (D207)', async () => {
    const room = await protectorRoom()
    await offered(room)

    await expireReactionOffer(room.room.base.stub)
    const { request } = await attackPrompt(room)
    expect(request.rollMode).toBe('NORMAL')
    expect(await reactionUsed(room)).toBe(0)
  })

  it('never pauses for a Character with no shield equipped', async () => {
    const room = await protectorRoom({ shield: false })
    await bite(room)
    const { request } = await attackPrompt(room)
    expect(request.rollMode).toBe('NORMAL')
  })

  it('never pauses when the bitten Wolf is more than 5 feet from the Character', async () => {
    const room = await protectorRoom({ reactorX: 450 })
    await bite(room)
    const { request } = await attackPrompt(room)
    expect(request.rollMode).toBe('NORMAL')
  })

  it('offers a homebrew reaction the same way, with no shield and from 10 feet', async () => {
    const room = await protectorRoom({ feature: distract, shield: false, reactorX: 450 })
    const { decision, pending } = await offered(room)
    expect(pending.options).toHaveLength(1)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0]!.optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const { request } = await attackPrompt(room)
    expect(request.rollMode).toBe('DISADVANTAGE')
    expect(await reactionUsed(room)).toBe(0)
  })
})

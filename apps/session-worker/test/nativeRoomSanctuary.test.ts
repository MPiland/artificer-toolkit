import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { sanctuary } from '@artificer-toolkit/source-data/srd/spells/sanctuary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, fireballWolf } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-4.T2k3 through the room: a creature that targets a Sanctuary-warded creature with an attack
 * or a harmful spell first makes the caster's Wisdom save, or loses the action. An area that merely
 * catches the creature is not aimed at it, and the ward ends when its holder attacks an enemy.
 */

const ATTACKER_ID = testUuid(0x930)
const WARDED_ID = testUuid(0x931)
const CASTER_ACTOR_ID = testUuid(0x932)
const CASTER_ID = testUuid(0x933)
const BYSTANDER_ID = testUuid(0x934)
/** The save faces (zero-based dice; a player enters one more) that pass any Sanctuary DC and fail it. */
const SAVE_PASSES = 19
const SAVE_FAILS = 0
/** The attack d20 face the Bite adds 4 to: a hit on any armor class. */
const ATTACK_HITS = 19

const attacker = biteWolf('ATTACK')
const [warding] = sanctuary.effects ?? []

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The request id of the d20 evidence a decision is waiting on. */
function diceRequestId(decision: Awaited<ReturnType<typeof readPendingActionDecision>>): string {
  if (decision?.pending.kind !== 'D20_EVIDENCE') throw new Error('No d20 request is pending.')
  return decision.pending.request.requestId
}

/** The Wolf attacker bites the Wolf the Character cast Sanctuary on. */
async function wardedRoom(
  config: {
    rolls: number[]
    autoRoll?: 'BOTH' | 'PLAYER'
    creature?: typeof attacker
    ownerFeatureId?: string
    /** The bystander is under the same caster's ward too. */
    bystanderWarded?: boolean
  } = { rolls: [] }
) {
  if (!warding) throw new Error('The SRD Sanctuary has no effect.')
  const creature = config.creature ?? attacker
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature, disposition: 'HOSTILE' }),
      srdCreatureActor({ id: WARDED_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: BYSTANDER_ID, creature: plainWolf, disposition: 'NEUTRAL' })
    ],
    ownerFeatureId: config.ownerFeatureId ?? creatureFeature(creature, 'Bite').id,
    autoRoll: config.autoRoll ?? 'BOTH',
    rolls: config.rolls,
    fallbackRoll: 0,
    characterSpellcasting: { spells: [fireball], prepared: [fireball.id] },
    seed: async (context) => {
      for (const holderActorId of config.bystanderWarded ? [WARDED_ID, BYSTANDER_ID] : [WARDED_ID])
        await seedModifierGrant({
          sourceActorId: CASTER_ACTOR_ID,
          holderActorId,
          lifecycle: {},
          effect: warding,
          sourceLabel: sanctuary.label
        })(context)
    }
  })
}

type WardedRoom = Awaited<ReturnType<typeof wardedRoom>>

async function standing(room: WardedRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    history,
    wards: history.activeEffects.length,
    wardedHitPoints: readActorHitPoints(history, WARDED_ID),
    // The action's root; a prompted save's answer leaves its own evidence receipt beside it.
    gated: history.receipts.flatMap((receipt) => {
      const execution = parseReceiptExecution(receipt)
      return receipt.commandType === 'RESOLVE_ACTION' &&
        execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
        execution.applicationOutputs.kind === 'ENCOUNTER_GATED_ACTION'
        ? [execution.applicationOutputs]
        : []
    })
  }
}

async function bite(room: WardedRoom) {
  const { answer } = await room.startAction(WARDED_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The retarget offer a failed save earned the attacker; every other creature is a candidate. */
async function retargetOffer(room: WardedRoom) {
  const decision = await readPendingActionDecision(room.room.base.stub)
  if (decision?.pending.kind !== 'ATTACK_RETARGET_CHOICE')
    throw new Error(`No retarget is pending (${decision?.pending.kind}).`)
  return { decision, options: decision.pending.options }
}

/** Lets the failed save lose the action instead of turning it on another creature. */
async function declineRetarget(room: WardedRoom) {
  const { decision } = await retargetOffer(room)
  const lost = await room.resolve(decision, { kind: 'DECLINE' })
  expect(lost.type, JSON.stringify(lost)).toBe('COMMAND_COMMITTED')
}

describe('Sanctuary gates an attack on the warded creature (SPELLS-4.T2k3)', () => {
  it('lets a creature that passes the save attack, and leaves the ward standing', async () => {
    const room = await wardedRoom({ rolls: [SAVE_PASSES, ATTACK_HITS] })
    const before = await standing(room)

    await bite(room)

    const after = await standing(room)
    expect(after.gated).toEqual([])
    expect(after.wardedHitPoints).toBe(before.wardedHitPoints - 1)
    expect(after.wards).toBe(1)
  })

  it('loses the attack of a creature that fails the save, and still spends its action', async () => {
    const room = await wardedRoom({ rolls: [SAVE_FAILS, ATTACK_HITS] })
    const before = await standing(room)

    await bite(room)
    await declineRetarget(room)

    const after = await standing(room)
    expect(after.wardedHitPoints).toBe(before.wardedHitPoints)
    expect(after.wards).toBe(1)
    const [gated] = after.gated
    expect(gated?.lost).toBe('ATTACK')
    expect(gated?.gate.holderActorId).toBe(WARDED_ID)
    expect(gated?.actionEconomyTransition?.afterUsed).toBeGreaterThan(
      gated?.actionEconomyTransition?.beforeUsed ?? Infinity
    )
  })

  it('asks a prompted attacker to roll the save, then lets the attack go on when it passes', async () => {
    const room = await wardedRoom({ rolls: [], autoRoll: 'PLAYER' })
    const before = await standing(room)
    await bite(room)

    const gate = await readPendingActionDecision(room.room.base.stub)
    expect(gate?.pending.kind).toBe('D20_EVIDENCE')
    const passed = await room.send(
      room.resolveCommand(gate!, {
        kind: 'ENTER_DICE',
        requestId: diceRequestId(gate),
        rawFaces: [SAVE_PASSES + 1],
        rollMode: 'NORMAL'
      })
    )
    expect(passed.type, JSON.stringify(passed)).toBe('COMMAND_COMMITTED')

    const attack = await readPendingActionDecision(room.room.base.stub)
    expect(attack?.pending.kind).toBe('D20_EVIDENCE')
    expect(attack!.occurrence.version).toBeGreaterThan(gate!.occurrence.version)
    const hit = await room.send(
      room.resolveCommand(attack!, {
        kind: 'ENTER_DICE',
        requestId: diceRequestId(attack),
        rawFaces: [ATTACK_HITS + 1],
        rollMode: 'NORMAL'
      })
    )
    expect(hit.type, JSON.stringify(hit)).toBe('COMMAND_COMMITTED')

    const after = await standing(room)
    expect(after.gated).toEqual([])
    expect(after.wardedHitPoints).toBe(before.wardedHitPoints - 1)
  })

  it('loses the attack of a prompted attacker whose rolled save fails', async () => {
    const room = await wardedRoom({ rolls: [], autoRoll: 'PLAYER' })
    const before = await standing(room)
    await bite(room)

    const gate = await readPendingActionDecision(room.room.base.stub)
    const failed = await room.send(
      room.resolveCommand(gate!, {
        kind: 'ENTER_DICE',
        requestId: diceRequestId(gate),
        rawFaces: [SAVE_FAILS + 1],
        rollMode: 'NORMAL'
      })
    )
    expect(failed.type, JSON.stringify(failed)).toBe('COMMAND_COMMITTED')

    await declineRetarget(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    expect(after.wardedHitPoints).toBe(before.wardedHitPoints)
    expect(after.gated).toHaveLength(1)
  })

  it('gives the action back when the lost attack is undone', async () => {
    const room = await wardedRoom({ rolls: [SAVE_FAILS, ATTACK_HITS] })
    await bite(room)
    await declineRetarget(room)
    expect((await standing(room)).gated).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })

    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(after.activeEffects).toHaveLength(1)
  })

  it('does not gate an area that merely catches the warded creature', async () => {
    const burst = fireballWolf()
    const room = await wardedRoom({
      rolls: [SAVE_FAILS],
      creature: burst,
      ownerFeatureId: creatureFeature(burst, 'Bite').id
    })
    const before = await standing(room)

    const { answer } = await room.startAreaAction({ x: 250, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await standing(room)
    expect(after.gated).toEqual([])
    expect(after.wardedHitPoints).toBeLessThan(before.wardedHitPoints)
  })
})

describe('A failed Sanctuary save offers a new target (SPELLS-4.T2k3b)', () => {
  it('offers every other creature, never the attacker or the warded one', async () => {
    const room = await wardedRoom({ rolls: [SAVE_FAILS, ATTACK_HITS] })
    await bite(room)

    const { options } = await retargetOffer(room)
    expect(options.map((option) => option.targetActorId).sort()).toEqual(
      [CASTER_ACTOR_ID, BYSTANDER_ID].sort()
    )
    expect((await standing(room)).gated).toEqual([])
  })

  it('turns the attack on the creature the attacker chooses', async () => {
    const room = await wardedRoom({ rolls: [SAVE_FAILS, ATTACK_HITS] })
    const before = await standing(room)
    const bystanderBefore = readActorHitPoints(before.history, BYSTANDER_ID)
    await bite(room)

    const { decision, options } = await retargetOffer(room)
    const turned = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: options.find((option) => option.targetActorId === BYSTANDER_ID)!.optionId
    })
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    expect(after.gated).toEqual([])
    expect(after.wardedHitPoints).toBe(before.wardedHitPoints)
    expect(readActorHitPoints(after.history, BYSTANDER_ID)).toBeLessThan(bystanderBefore)
  })
})

describe('A retargeted action meets the new creature’s ward afresh (SPELLS-4.T2k3b)', () => {
  async function turnOnBystander(room: WardedRoom) {
    const { decision, options } = await retargetOffer(room)
    const turned = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: options.find((option) => option.targetActorId === BYSTANDER_ID)!.optionId
    })
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')
  }

  it('lets the retargeted attack land when it passes the second ward', async () => {
    const room = await wardedRoom({
      rolls: [SAVE_FAILS, SAVE_PASSES, ATTACK_HITS],
      bystanderWarded: true
    })
    const before = await standing(room)
    await bite(room)

    await turnOnBystander(room)

    const after = await standing(room)
    expect(after.gated).toEqual([])
    expect(readActorHitPoints(after.history, BYSTANDER_ID)).toBeLessThan(
      readActorHitPoints(before.history, BYSTANDER_ID)
    )
  })

  it('offers a new target again when the second ward is failed, and loses the action on a decline', async () => {
    const room = await wardedRoom({
      rolls: [SAVE_FAILS, SAVE_FAILS, ATTACK_HITS],
      bystanderWarded: true
    })
    await bite(room)
    await turnOnBystander(room)

    const { options } = await retargetOffer(room)
    expect(options.map((option) => option.targetActorId).sort()).toEqual(
      [CASTER_ACTOR_ID, WARDED_ID].sort()
    )
    await declineRetarget(room)

    const { gated } = await standing(room)
    expect(gated).toHaveLength(1)
    expect(gated[0]?.gate.holderActorId).toBe(BYSTANDER_ID)
  })
})

describe('Sanctuary ends when its holder acts against an enemy (SPELLS-4.T2k3)', () => {
  it('ends when the warded creature attacks', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: WARDED_ID, creature: attacker, disposition: 'FRIENDLY' }),
        srdCreatureActor({ id: ATTACKER_ID, creature: plainWolf, disposition: 'HOSTILE' }),
        characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID })
      ],
      ownerFeatureId: creatureFeature(attacker, 'Bite').id,
      autoRoll: 'BOTH',
      rolls: [ATTACK_HITS],
      fallbackRoll: 0,
      characterSpellcasting: { spells: [fireball], prepared: [fireball.id] },
      seed: seedModifierGrant({
        sourceActorId: CASTER_ACTOR_ID,
        holderActorId: WARDED_ID,
        lifecycle: {},
        effect: warding!,
        sourceLabel: sanctuary.label
      })
    })
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(1)

    const { answer } = await room.startAction(ATTACKER_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toEqual([])
  })
})

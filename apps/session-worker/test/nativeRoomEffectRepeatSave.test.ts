import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0x820)
const HOLDER_ID = testUuid(0x821)
const CASTER_ID = testUuid(0x823)
const LAUGHTER_EFFECT_ID = testUuid(0x5320)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Wolf bites another Wolf, which holds Hideous Laughter cast by another Wolf (D167): the damage
 * owes the holder a repeat save with Advantage, answered by the GM.
 */
async function laughingRoom(heldDie = false) {
  const attacker = biteWolf('ATTACK')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf }),
      srdCreatureActor({ id: CASTER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    seed: async (context) => {
      const { effects, encounterId, occurredAt } = context
      if (heldDie)
        await seedModifierGrant({
          sourceActorId: HOLDER_ID,
          holderActorId: HOLDER_ID,
          lifecycle: {},
          effect: heldSaveDieEffect(),
          sourceLabel: resistance.label
        })(context)
      const planned = plannedTimedCondition({
        encounterId,
        sourceActorId: CASTER_ID,
        holderActorId: HOLDER_ID,
        spell: hideousLaughter,
        lifetimeScope: 'ENCOUNTER'
      })
      await effects.create({
        id: LAUGHTER_EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
}

const effectIds = (history: RoomHistory) => history.activeEffects.map((effect) => effect.id)

/** The repeat-save check outputs, one per check the Run settled. */
function repeatSaveChecks(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [execution.applicationOutputs]
      : []
  })
}

async function biteAndAnswer(face: number) {
  const room = await laughingRoom()
  const before = await readRoomHistory(room.room.base.stub)
  expect(effectIds(before)).toContain(LAUGHTER_EFFECT_ID)
  const { answer } = await room.startAction(HOLDER_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  // Nobody auto-rolls: the GM enters the attack die (a hit), then the holder's save dice.
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected an attack roll.')
  await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId: attack.pending.request.requestId,
    rawFaces: [19],
    rollMode: attack.pending.request.rollMode
  })

  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a repeat save.')
  // The damage trigger carries Advantage.
  expect(decision.pending).toMatchObject({
    rollerActorId: HOLDER_ID,
    request: { min: 1, max: 20, rollMode: 'ADVANTAGE' }
  })
  expect(repeatSaveChecks(await readRoomHistory(room.room.base.stub))).toEqual([])
  const { request } = decision.pending
  const resolved = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [face, face],
    rollMode: request.rollMode
  })
  expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
  return { room, before, after: await readRoomHistory(room.room.base.stub) }
}

describe('room Hideous Laughter damage repeat save', () => {
  it('ends the effect on a made save and bumps the Run version once', async () => {
    const { room, before, after } = await biteAndAnswer(20)
    expect(repeatSaveChecks(after)).toMatchObject([{ outcome: 'SAVE_SUCCESS' }])
    expect(effectIds(after)).not.toContain(LAUGHTER_EFFECT_ID)
    expect(after.runs[0]!.version).toBeGreaterThan(before.runs[0]!.version)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('keeps the effect on a failed save', async () => {
    const { room, after } = await biteAndAnswer(1)
    expect(repeatSaveChecks(after)).toMatchObject([{ outcome: 'SAVE_FAILURE' }])
    expect(effectIds(after)).toContain(LAUGHTER_EFFECT_ID)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})

describe('room Hideous Laughter repeat save with a die the holder keeps for after the d20 (SPELLS-31.T4c1b)', () => {
  /** The holder rolls a natural 1 on both dice, then meets the window the held die opens. */
  async function openWindow() {
    const room = await laughingRoom(true)
    const before = await readRoomHistory(room.room.base.stub)
    await room.startAction(HOLDER_ID)
    const attack = await room.pendingDecision()
    if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected an attack roll.')
    await room.resolve(attack, {
      kind: 'ENTER_DICE',
      requestId: attack.pending.request.requestId,
      rawFaces: [19],
      rollMode: attack.pending.request.rollMode
    })
    const save = await room.pendingDecision()
    if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a repeat save.')
    const { request } = save.pending
    const rolled = await room.resolve(save, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [1, 1],
      rollMode: request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
    // Nothing settles while the window pends.
    const paused = await readRoomHistory(room.room.base.stub)
    expect(repeatSaveChecks(paused)).toEqual([])
    expect(effectIds(paused)).toContain(LAUGHTER_EFFECT_ID)
    return { room, before, decision, pending: decision.pending }
  }

  it('settles the repeat save with the die added, and spends the die', async () => {
    const { room, before, decision, pending } = await openWindow()
    expect(pending).toMatchObject({
      rollerActorId: HOLDER_ID,
      d20: { selectedNatural: 1 },
      options: [{ label: 'Resistance', count: 1, faces: 4, sign: 'ADD' }]
    })
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [4]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    const [check] = repeatSaveChecks(after)
    expect(check).toMatchObject({
      d20: { selectedNatural: 1, total: pending.d20.total + 4, addedDice: [{ rolledFaces: [4] }] }
    })
    expect(check!.outcome).toBe(check!.d20.total >= check!.d20.dc ? 'SAVE_SUCCESS' : 'SAVE_FAILURE')
    expect(effectIds(after)).toHaveLength(
      effectIds(before).length - (check!.outcome === 'SAVE_SUCCESS' ? 2 : 1)
    )
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('keeps the roll, the die and the effect when declined', async () => {
    const { room, before, decision, pending } = await openWindow()
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(repeatSaveChecks(after)).toMatchObject([
      { outcome: 'SAVE_FAILURE', d20: { selectedNatural: 1, total: pending.d20.total } }
    ])
    expect(effectIds(after)).toEqual(effectIds(before))
  })
})

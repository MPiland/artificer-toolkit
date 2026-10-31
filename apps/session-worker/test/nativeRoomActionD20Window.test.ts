import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x7d0)
const TARGET_ID = testUuid(0x7d1)
const HELD_DIE_ID = testUuid(0x7d2)
const saveBite = biteWolf('SAVE')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf whose Bite forces a Dexterity save (DC 10) on a Wolf holding Resistance's after-the-roll die. */
function heldDieRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: saveBite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(saveBite, 'Bite').id,
    seed: seedModifierGrant({
      sourceActorId: TARGET_ID,
      holderActorId: TARGET_ID,
      lifecycle: {},
      effect: heldSaveDieEffect(),
      sourceLabel: resistance.label,
      id: HELD_DIE_ID
    })
  })
}
type Room = Awaited<ReturnType<typeof heldDieRoom>>

/** The target answers its Bite save with a natural 5, which fails the DC 10 save without the die. */
async function openWindow(room: Room) {
  expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
  const save = await room.pendingDecision()
  if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
  const { request } = save.pending
  const rolled = await room.resolve(save, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [5],
    rollMode: request.rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
  return { decision, pending: decision.pending }
}

const holdsDie = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).activeEffects.some(
    (effect) => effect.id === HELD_DIE_ID
  )

/** The Bite's settled target batch. */
function targetBatch(history: RoomHistory) {
  const batch = areaReceipts(history).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === TARGET_ID
  )?.outputs
  if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') throw new Error('The Bite left no batch.')
  return batch
}

const damageTaken = (history: RoomHistory) => {
  const { before, after } = targetBatch(history).targetTransition
  return before.currentHitPoints - after.currentHitPoints
}

describe('room d20 window on a single-target action save', () => {
  it('holds the save for the die once the d20 is seen, applying and spending nothing', async () => {
    const room = await heldDieRoom()
    const { pending } = await openWindow(room)
    expect(pending).toMatchObject({
      rollerActorId: TARGET_ID,
      d20: { selectedNatural: 5 },
      options: [{ label: 'Resistance', count: 1, faces: 4, sign: 'ADD' }]
    })
    expect(areaReceipts(await readRoomHistory(room.room.base.stub)).children).toEqual([])
    expect(await holdsDie(room)).toBe(true)
  })

  it('adds the die to the save, which then passes, and ends the spent effect', async () => {
    const room = await heldDieRoom()
    const { decision, pending } = await openWindow(room)
    const used = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [4]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await holdsDie(room)).toBe(false)
    // The Bite's failed-save damage is not dealt: 5 + modifier + 4 reaches the DC.
    expect(damageTaken(await readRoomHistory(room.room.base.stub))).toBe(0)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await holdsDie(room)).toBe(true)
  })

  it('keeps the roll and the die when declined, so the save fails', async () => {
    const room = await heldDieRoom()
    const { decision, pending } = await openWindow(room)
    const declined = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await holdsDie(room)).toBe(true)
    expect(damageTaken(await readRoomHistory(room.room.base.stub))).toBe(1)
  })

  it('refuses dice and a stale option for the held window', async () => {
    const room = await heldDieRoom()
    const { decision, pending } = await openWindow(room)
    const dice = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: pending.requestId,
      rawFaces: [20],
      rollMode: 'NORMAL'
    })
    expect(dice.type).toBe('COMMAND_REJECTED')
    const stale = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: 'f'.repeat(64),
      faces: [4]
    })
    expect(stale.type).toBe('COMMAND_REJECTED')
    expect((await room.pendingDecision()).pending.kind).toBe('D20_WINDOW')
  })

  it('opens the window when the app rolls the save itself', async () => {
    const room = await actionRoom({
      autoRoll: 'BOTH',
      fallbackRoll: 4,
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: saveBite }),
        srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
      ],
      ownerFeatureId: creatureFeature(saveBite, 'Bite').id,
      seed: seedModifierGrant({
        sourceActorId: TARGET_ID,
        holderActorId: TARGET_ID,
        lifecycle: {},
        effect: heldSaveDieEffect(),
        sourceLabel: resistance.label,
        id: HELD_DIE_ID
      })
    })
    expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
    expect((await room.pendingDecision()).pending.kind).toBe('D20_WINDOW')
  })
})

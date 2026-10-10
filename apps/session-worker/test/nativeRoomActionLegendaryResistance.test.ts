import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { legendaryWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x7c0)
const TARGET_ID = testUuid(0x7c1)
const saveBite = biteWolf('SAVE')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf whose Bite forces a Dexterity save (DC 10) on a Wolf with Legendary Resistance. */
function resistanceRoom(
  options: Omit<Parameters<typeof actionRoom>[0], 'actors' | 'ownerFeatureId'> = {}
) {
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: saveBite }),
      srdCreatureActor({ id: TARGET_ID, creature: legendaryWolf })
    ],
    ownerFeatureId: creatureFeature(saveBite, 'Bite').id
  })
}
type Room = Awaited<ReturnType<typeof resistanceRoom>>

/** Starts the Bite and answers the target's save with a natural 1, which fails the DC 10 save. */
async function failedSave(room: Room) {
  expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
  const answer = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: decision.pending.request.requestId,
    rawFaces: [1],
    rollMode: decision.pending.request.rollMode
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The Legendary Resistance choice the room asks of the failed save. */
async function offeredChoice(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
    throw new Error(`Expected the Legendary Resistance choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

const targetRows = (history: RoomHistory) =>
  history.actors.filter((row) => row.id === TARGET_ID).map(({ _creationTime, ...rest }) => rest)

/** The Bite's settled target batch. */
function targetBatch(history: RoomHistory) {
  const batch = areaReceipts(history).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === TARGET_ID
  )?.outputs
  if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') throw new Error('The Bite left no batch.')
  return batch
}

describe('room Legendary Resistance on a single-target save', () => {
  it('holds the failed save for the creature’s choice, applying and spending nothing', async () => {
    const room = await resistanceRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await failedSave(room)

    const { pending } = await offeredChoice(room)
    expect(pending.targetActorId).toBe(TARGET_ID)
    const history = await readRoomHistory(room.room.base.stub)
    expect(areaReceipts(history).children).toEqual([])
    expect(targetRows(history)).toEqual(targetRows(before))
  })

  it('turns the failure into a success when used, spends one charge and undoes with it', async () => {
    const room = await resistanceRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await failedSave(room)
    const { decision, pending } = await offeredChoice(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const history = await readRoomHistory(room.room.base.stub)
    const batch = targetBatch(history)
    expect(batch.targetFeatureResourceConsumption).toEqual(
      expect.objectContaining({ beforeUsed: 0, afterUsed: 1 })
    )
    expect(batch.legendaryResistance).toMatchObject({ use: true, selectedIndex: 1 })
    const { before: hp, after } = batch.targetTransition
    expect(hp.currentHitPoints - after.currentHitPoints).toBe(0)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const [restored] = targetRows(await readRoomHistory(room.room.base.stub))
    const { resources } = JSON.parse(restored!.stateJson) as {
      resources: { featureCharges?: Record<string, number> }
    }
    expect(Object.values(resources.featureCharges ?? {}).filter((used) => used !== 0)).toEqual([])
    expect(restored!.snapshotChecksum).toBe(targetRows(before)[0]!.snapshotChecksum)
  })

  it('keeps the failure when declined, applying the outcome and spending nothing', async () => {
    const room = await resistanceRoom()
    await failedSave(room)
    const { decision } = await offeredChoice(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const batch = targetBatch(await readRoomHistory(room.room.base.stub))
    expect(batch.targetFeatureResourceConsumption).toBeNull()
    expect(batch.legendaryResistance).toMatchObject({ use: false, selectedIndex: 0 })
    const { before: hp, after } = batch.targetTransition
    expect(hp.currentHitPoints - after.currentHitPoints).toBe(1)
  })

  it('lets the player who controls the creature answer, and refuses the caster’s player', async () => {
    const targetPlayer = await resistanceRoom({ playerControlledActorIds: [TARGET_ID] })
    await failedSave(targetPlayer)
    const owned = await offeredChoice(targetPlayer)
    const answered = await targetPlayer.sendAsPlayer(
      targetPlayer.resolveCommand(owned.decision, { kind: 'DECLINE' })
    )
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(targetPlayer.room.base.stub)).toBeNull()

    const casterPlayer = await resistanceRoom({ playerControlledActorIds: [SOURCE_ID] })
    await failedSave(casterPlayer)
    const foreign = await offeredChoice(casterPlayer)
    const refused = await casterPlayer.sendAsPlayer(
      casterPlayer.resolveCommand(foreign.decision, { kind: 'DECLINE' })
    )
    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(await readPendingActionDecision(casterPlayer.room.base.stub)).not.toBeNull()
  })

  it('refuses dice for a held choice, a stale option, and a decline of a plain save prompt', async () => {
    const room = await resistanceRoom()
    expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
    const prompt = await room.pendingDecision()
    if (prompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
    const { request } = prompt.pending
    const declinedSave = await room.resolve(prompt, { kind: 'DECLINE' })
    expect(declinedSave.type).toBe('COMMAND_REJECTED')

    await room.resolve(prompt, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [1],
      rollMode: request.rollMode
    })
    const { decision, pending } = await offeredChoice(room)
    const dice = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [20],
      rollMode: request.rollMode
    })
    expect(dice.type).toBe('COMMAND_REJECTED')
    const stale = await room.resolve(decision, { kind: 'OPTION', optionId: 'f'.repeat(64) })
    expect(stale.type).toBe('COMMAND_REJECTED')
    expect((await room.pendingDecision()).pending.kind).toBe(pending.kind)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  })

  it('offers the choice when the app rolls the failed save itself', async () => {
    const room = await resistanceRoom({ autoRoll: 'BOTH', fallbackRoll: 0 })
    expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
    const { decision, pending } = await offeredChoice(room)
    expect(pending.targetActorId).toBe(TARGET_ID)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(
      targetBatch(await readRoomHistory(room.room.base.stub)).legendaryResistance
    ).toMatchObject({ use: true })
  })
})

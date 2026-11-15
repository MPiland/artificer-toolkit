import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { concentrationDescriptor, plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { takeDamagedRaises } from './damagedRaiseRecorder.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { CONCENTRATION_STATE_ID } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

vi.mock('@artificer-toolkit/rules-runtime/events/encounterEventHooks', async (importOriginal) =>
  (await import('./damagedRaiseRecorder.js')).recordingDamagedRaises(importOriginal)
)
// The rooms load their modules again, so they meet the recording discovery (damagedRaiseRecorder.ts).
vi.resetModules()

/**
 * QUALITY-14.T2e2c (D220): a resumed damage-save chain reads the discovery sealed on its context.
 * The caster's area damages itself while it concentrates on the Hideous Laughter one target holds,
 * a second target concentrating on its own spell, and that Laughter holder. The caster's failed
 * check ends the Laughter, so the chain owes the second target's check and no repeat save.
 */

const CASTER_ID = testUuid(0x9a0)
const CONCENTRATOR_ID = testUuid(0x9a1)
const LAUGHING_ID = testUuid(0x9a2)
const CONCENTRATOR_STATE_ID = testUuid(0x9a3)
const LAUGHTER_EFFECT_ID = testUuid(0x9a4)

afterEach(() => {
  closeTrackedSockets()
})

function concentratingAreaRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      srdCreatureActor({ id: CONCENTRATOR_ID, creature: plainWolf }),
      srdCreatureActor({ id: LAUGHING_ID, creature: plainWolf })
    ],
    ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id,
    concentration: true,
    concentrationOwnerActorId: CASTER_ID,
    seed: async ({ effects, encounterId, occurredAt }) => {
      await effects.createMaintainedState({
        id: CONCENTRATOR_STATE_ID,
        encounterId,
        ownerActorId: CONCENTRATOR_ID,
        descriptor: await concentrationDescriptor(CONCENTRATOR_ID),
        occurredAt
      })
      const planned = plannedTimedCondition({
        encounterId,
        sourceActorId: CASTER_ID,
        holderActorId: LAUGHING_ID,
        spell: hideousLaughter,
        lifetimeScope: 'ENCOUNTER'
      })
      await effects.create({
        id: LAUGHTER_EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: LAUGHING_ID },
        maintainedEffectStateId: CONCENTRATION_STATE_ID,
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
}

function damageSaveChecks(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
}

async function pendingCheck(room: Awaited<ReturnType<typeof concentratingAreaRoom>>) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a damage-save check.')
  return { decision, pending: decision.pending }
}

/** The room once the area's damage committed and the caster's check waits on its roll. */
async function damagedRoom() {
  const room = await concentratingAreaRoom()
  const before = await readRoomHistory(room.room.base.stub)
  expect(before.activeEffects.map(({ id }) => id)).toContain(LAUGHTER_EFFECT_ID)
  expect(before.maintainedStates.map(({ id }) => id).sort()).toEqual(
    [CONCENTRATION_STATE_ID, CONCENTRATOR_STATE_ID].sort()
  )
  takeDamagedRaises()
  await room.startAreaAction({ x: 50, y: 150 })
  await answerAllSaves(room)
  return room
}

describe('a resumed damage-save chain whose earlier check ended a Concentration (D220)', () => {
  it('asks exactly the checks the sealed discovery still owes', async () => {
    const room = await damagedRoom()
    // QUALITY-14.T2e2e: the area raised DAMAGED(AFTER) once for each holder it damaged, the two
    // Concentration holders among them, and its commit re-derived each raise once to check the plan.
    const raised = takeDamagedRaises()
    expect(raised.room.sort()).toEqual([CASTER_ID, CONCENTRATOR_ID, LAUGHING_ID].sort())
    expect(raised.commit.sort()).toEqual([CASTER_ID, CONCENTRATOR_ID, LAUGHING_ID].sort())

    const caster = await pendingCheck(room)
    expect(caster.pending.rollerActorId).toBe(CASTER_ID)
    const failed = await room.resolve(caster.decision, {
      kind: 'ENTER_DICE',
      requestId: caster.pending.request.requestId,
      rawFaces: [1],
      rollMode: caster.pending.request.rollMode
    })
    expect(failed.type, JSON.stringify(failed)).toBe('COMMAND_COMMITTED')

    const concentrator = await pendingCheck(room)
    expect(concentrator.pending.rollerActorId).toBe(CONCENTRATOR_ID)
    const made = await room.resolve(concentrator.decision, {
      kind: 'ENTER_DICE',
      requestId: concentrator.pending.request.requestId,
      rawFaces: [20],
      rollMode: concentrator.pending.request.rollMode
    })
    expect(made.type, JSON.stringify(made)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    // The resumed chain read its sealed discovery and raised no damage again.
    expect(takeDamagedRaises()).toEqual({ room: [], commit: [] })

    const after = await readRoomHistory(room.room.base.stub)
    expect(damageSaveChecks(after).map(({ source, outcome }) => ({ source, outcome }))).toEqual([
      { source: 'CONCENTRATION', outcome: 'SAVE_FAILURE' },
      { source: 'CONCENTRATION', outcome: 'SAVE_SUCCESS' }
    ])
    expect(after.activeEffects.map(({ id }) => id)).not.toContain(LAUGHTER_EFFECT_ID)
    expect(after.maintainedStates.map(({ id }) => id)).toEqual([CONCENTRATOR_STATE_ID])
  })

  it('replays a repeated answer and refuses one made against the settled check', async () => {
    const room = await damagedRoom()

    const caster = await pendingCheck(room)
    const answer = room.resolveCommand(caster.decision, {
      kind: 'ENTER_DICE',
      requestId: caster.pending.request.requestId,
      rawFaces: [1],
      rollMode: caster.pending.request.rollMode
    })
    expect((await room.send(answer)).type).toBe('COMMAND_COMMITTED')
    const settled = await readRoomHistory(room.room.base.stub)
    const waiting = await room.pendingDecision()

    expect((await room.send(answer)).type).toBe('COMMAND_COMMITTED')
    const stale = await room.resolve(caster.decision, {
      kind: 'ENTER_DICE',
      requestId: caster.pending.request.requestId,
      rawFaces: [20],
      rollMode: caster.pending.request.rollMode
    })
    expect(stale.type, JSON.stringify(stale)).not.toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.room.base.stub)
    expect(after.receipts).toHaveLength(settled.receipts.length)
    expect(await room.pendingDecision()).toEqual(waiting)
  })
})

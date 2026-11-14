import { runInDurableObject } from 'cloudflare:test'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { persistLiveMovementMassiveDamageSave } from '@artificer-toolkit/encounter-persistence/liveMovementConcentrationPersistence'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { movementMassiveDamageSaveExecutionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import type { CreatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { raven } from '@artificer-toolkit/source-data/srd/creatures/raven.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-14.T2d: the damage a zone deals a creature as it moves owes that creature the
 * massive-damage save (ATTACK-16) at the contact, like the damage of an action.
 */

const MOVER_ID = testUuid(0xe71)
const START: ScenePoint = { x: 150, y: 150 }
/** Covers one cell of the row the mover walks along and deals 1 damage. */
const zone = { center: { x: 350, y: 150 }, radius: 50 }
const PAST_ZONE = [START, { x: 450, y: 150 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** `creature` stands beside the 1-damage zone, with the massive-damage rule on or off. */
function zoneRoom(
  creature: CreatureAuthored,
  dice: Pick<Parameters<typeof movementRoom>[0], 'autoRoll' | 'fallbackRoll'>,
  massiveDamage = true
) {
  return movementRoom({
    actors: [srdCreatureActor({ id: MOVER_ID, creature })],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: START },
    spatialEffects: [zone],
    optionalCombatKinds: massiveDamage ? ['MASSIVE_DAMAGE'] : [],
    ...dice
  })
}

/** The massive-damage save outputs, one per save the Run settled. */
function massiveDamageSaves(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'MASSIVE_DAMAGE'
      ? [execution.applicationOutputs]
      : []
  })
}

/** What the Run holds once the move has committed. */
async function settled(room: Awaited<ReturnType<typeof zoneRoom>>) {
  const history = await readRoomHistory(room.base.stub)
  return {
    saves: massiveDamageSaves(history).map(({ outcome, application }) => ({
      outcome,
      targetActorId: application.targetActorId,
      appliedAmount: application.appliedAmount
    })),
    hitPoints: readActorHitPoints(history, MOVER_ID),
    pending: await room.pending()
  }
}

/** `creature` walks through the zone; every die the room rolls shows `face`. */
async function rolledWalk(creature: CreatureAuthored, face: number, massiveDamage = true) {
  const room = await zoneRoom(
    creature,
    { autoRoll: 'GAME_MASTER', fallbackRoll: face - 1 },
    massiveDamage
  )
  const moved = await room.move(PAST_ZONE)
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  return settled(room)
}

describe('zone damage of half a mover’s hit point maximum (QUALITY-14.T2d)', () => {
  // The SRD Cat has 2 hit points, so the zone's 1 damage is half its maximum.
  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' },
    { face: 1, outcome: 'SAVE_FAILURE' }
  ])(
    'records the massive-damage save the room rolls as $outcome',
    async ({ face, outcome }) => {
      expect(await rolledWalk(cat, face)).toEqual({
        saves: [{ outcome, targetActorId: MOVER_ID, appliedAmount: 1 }],
        hitPoints: 1,
        pending: null
      })
    },
    60_000
  )

  it('owes no save with the rule off', async () => {
    expect(await rolledWalk(cat, 1, false)).toEqual({ saves: [], hitPoints: 1, pending: null })
  }, 60_000)

  it('owes no save below half the maximum', async () => {
    // The SRD Wolf has 11 hit points.
    expect(await rolledWalk(plainWolf, 1)).toEqual({ saves: [], hitPoints: 10, pending: null })
  }, 60_000)

  it('owes no save when the damage drops the mover to 0 hit points', async () => {
    // The SRD Raven has 1 hit point.
    expect(await rolledWalk(raven, 1)).toEqual({ saves: [], hitPoints: 0, pending: null })
  }, 60_000)
})

/**
 * Re-persists the massive-damage save the room committed for the move, with `forge` applied to the
 * step, through the room's own store; returns the persistence's refusal.
 */
function repersistSettledSave(
  room: Awaited<ReturnType<typeof zoneRoom>>,
  forge: (step: MassiveSaveStep) => MassiveSaveStep
) {
  return runInDurableObject(room.base.stub, async (_instance, context) => {
    const store = new RoomEncounterStore(context.storage)
    const ctx = { db: store.store } as unknown as Parameters<
      typeof persistLiveMovementMassiveDamageSave
    >[0]
    const state = readRunState(store.documents('encounterRuns')[0]!)
    const receipt = store.documents('encounterRuleReceipts').find((candidate) => {
      const execution = parseReceiptExecution(candidate)
      return (
        execution.status === 'COMPLETE' &&
        execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
        execution.applicationOutputs.source === 'MASSIVE_DAMAGE'
      )
    })
    if (!receipt) throw new Error('Expected the settled massive-damage save.')
    const result = parseReceiptExecution(receipt)
    if (
      result.status !== 'COMPLETE' ||
      result.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK' ||
      result.applicationOutputs.source !== 'MASSIVE_DAMAGE'
    )
      throw new Error('Expected a massive-damage save result.')
    const step = forge({
      state,
      actors: await readRunActors(ctx, state),
      execution: movementMassiveDamageSaveExecutionDtoSchema.parse({
        sourceCommandId: receipt.commandId,
        result
      }),
      parentOccurrenceId: result.applicationOutputs.parentOccurrenceId,
      sourceCommandId: receipt.commandId,
      userId: 'gm',
      authorizedCharacterIds: new Set<string>(),
      occurredAt: new Date().toISOString()
    })
    // The Run holds no Character, so no stream version is read.
    return persistLiveMovementMassiveDamageSave(ctx, step, {
      currentCharacterStreamVersion: async () => {
        throw new Error('The Run holds no Character.')
      }
    }).then(
      () => null,
      (error: Error) => error.message
    )
  })
}

type MassiveSaveStep = Parameters<typeof persistLiveMovementMassiveDamageSave>[1]

describe('a forged movement massive-damage save step (QUALITY-14.T2d)', () => {
  it('refuses a replay of the save the move already settled', async () => {
    const room = await zoneRoom(cat, { autoRoll: 'GAME_MASTER', fallbackRoll: 19 })
    expect((await room.move(PAST_ZONE)).type).toBe('COMMAND_COMMITTED')

    expect(await repersistSettledSave(room, (step) => step)).toBe(
      'The massive-damage save child occurrence already exists.'
    )
  }, 60_000)

  it('refuses a save another command made', async () => {
    const room = await zoneRoom(cat, { autoRoll: 'GAME_MASTER', fallbackRoll: 19 })
    expect((await room.move(PAST_ZONE)).type).toBe('COMMAND_COMMITTED')

    expect(
      await repersistSettledSave(room, (step) => ({
        ...step,
        execution: { ...step.execution, sourceCommandId: crypto.randomUUID() }
      }))
    ).toBe('Live Session movement massive-damage save receipt scope mismatch.')
  }, 60_000)

  it('refuses the save in a MANUAL Run', async () => {
    const room = await zoneRoom(cat, { autoRoll: 'GAME_MASTER', fallbackRoll: 19 })
    expect((await room.move(PAST_ZONE)).type).toBe('COMMAND_COMMITTED')

    expect(
      await repersistSettledSave(room, (step) => ({
        ...step,
        state: { ...step.state, automationMode: 'MANUAL' }
      }))
    ).toBe('Live Session movement massive-damage save receipt scope mismatch.')
  }, 60_000)
})

describe('a zone massive-damage save nobody auto-rolls (QUALITY-14.T2d)', () => {
  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' },
    { face: 1, outcome: 'SAVE_FAILURE' }
  ])(
    'waits for the mover’s dice and settles them as $outcome',
    async ({ face, outcome }) => {
      const room = await zoneRoom(cat, {})
      const moved = await room.move(PAST_ZONE)
      expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
      const asked = await room.pendingFor(true)
      if (asked?.kind !== 'D20_EVIDENCE')
        throw new Error(`Expected a massive-damage save, got ${asked?.kind}.`)
      // The rule's DC 15 Constitution save, rolled by the damaged mover.
      expect(asked).toMatchObject({
        rollerActorId: MOVER_ID,
        trigger: { kind: 'MASSIVE_DAMAGE', dc: 15 },
        request: { min: 1, max: 20, rollMode: 'NORMAL' }
      })
      // The save is not settled while the move waits.
      expect(massiveDamageSaves(await readRoomHistory(room.base.stub))).toEqual([])

      const answered = await room.respond({
        kind: 'ENTER_DICE',
        requestId: asked.request.requestId,
        rawFaces: [face],
        rollMode: asked.request.rollMode
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
      expect(await settled(room)).toEqual({
        saves: [{ outcome, targetActorId: MOVER_ID, appliedAmount: 1 }],
        hitPoints: 1,
        pending: null
      })
    },
    60_000
  )
})

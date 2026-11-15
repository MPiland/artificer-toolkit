import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { canonicalActiveEffectEndTriggers } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { takeDamagedRaises } from './damagedRaiseRecorder.js'
import { movementRoom } from './movementRoomFixture.js'
import { parseReceiptExecution, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

vi.mock('@artificer-toolkit/rules-runtime/events/encounterEventHooks', async (importOriginal) =>
  (await import('./damagedRaiseRecorder.js')).recordingDamagedRaises(importOriginal)
)
// The rooms load their modules again, so they meet the recording discovery (damagedRaiseRecorder.ts).
vi.resetModules()

/**
 * QUALITY-14.T2e2d2 (D220): a move takes damage per contact. Each damaging contact raises its own
 * DAMAGED(AFTER) for the holder and settles what that raise ends and gives before the saves the same
 * contact owes, so a save waiting at the first contact already sees that contact's ends and grants.
 */

const WOLF_ID = testUuid(0xe81)
const CASTER_ID = testUuid(0xe82)
const LAUGHTER_EFFECT_ID = testUuid(0x5681)
const DAMAGE_ENDED_EFFECT_ID = testUuid(0x5682)
const WOLF_START: ScenePoint = { x: 150, y: 150 }
/** Each covers one cell of the row the Wolf walks along and deals 1 fire damage. */
const firstZone = { center: { x: 350, y: 150 }, radius: 50 }
const secondZone = { center: { x: 550, y: 150 }, radius: 50, variant: 1 }
const PAST_BOTH_ZONES = [WOLF_START, { x: 650, y: 150 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf with the Flesh Golem's Aversion of Fire, whose passive trigger grants after fire damage. */
const aversionWolf: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0xe83),
  features: [
    ...(plainWolf.features ?? []),
    creatureFeature(srdByLabel(SRD.creatures, 'Flesh Golem'), 'Aversion of Fire')
  ]
}

/**
 * The Wolf holds SRD Hideous Laughter (a save on damage) and, as fixture data, a second hold of the
 * same conditions that damage ends; nobody auto-rolls, so each contact's save waits.
 */
function laughingAversionRoom() {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: aversionWolf }),
      srdCreatureActor({ id: CASTER_ID, creature: plainWolf })
    ],
    moverActorId: WOLF_ID,
    positions: { [WOLF_ID]: WOLF_START, [CASTER_ID]: { x: 150, y: 950 } },
    spatialEffects: [firstZone, secondZone],
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedTimedCondition({
        encounterId,
        sourceActorId: CASTER_ID,
        holderActorId: WOLF_ID,
        spell: hideousLaughter,
        lifetimeScope: 'ENCOUNTER'
      })
      const owner = { kind: 'ENCOUNTER_ACTOR' as const, encounterId, targetActorId: WOLF_ID }
      await effects.create({
        id: LAUGHTER_EFFECT_ID,
        owner,
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
      const { repeatTriggers: _repeatTriggers, ...recurrence } = planned.definition.recurrence
      await effects.create({
        id: DAMAGE_ENDED_EFFECT_ID,
        owner,
        definition: {
          ...planned.definition,
          recurrence: {
            ...recurrence,
            endTriggers: canonicalActiveEffectEndTriggers<
              NonNullable<typeof recurrence.endTriggers>[number]
            >([{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }])
          }
        },
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
}

/** The repeat-save outcomes the Run settled, in order. */
const repeatSaveOutcomes = (history: RoomHistory) =>
  history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [execution.applicationOutputs.outcome]
      : []
  })

/** What the Wolf holds: Laughter, the damage-ended hold, and the grants its fire damage gave. */
const held = (history: RoomHistory) => {
  const ids = history.activeEffects.map(({ id }) => id)
  return {
    laughing: ids.includes(LAUGHTER_EFFECT_ID),
    damageEndedHold: ids.includes(DAMAGE_ENDED_EFFECT_ID),
    grants: ids.filter((id) => id !== LAUGHTER_EFFECT_ID && id !== DAMAGE_ENDED_EFFECT_ID).length
  }
}

describe('a move crossing two damaging zones against one holder (QUALITY-14.T2e2d2, D220)', () => {
  it('settles each contact’s damage ends and grants before that contact’s own save', async () => {
    const room = await laughingAversionRoom()
    takeDamagedRaises()
    const moved = await room.move(PAST_BOTH_ZONES)
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')

    /** Waits at the next contact's save and answers it with a failed roll. */
    const failSave = async () => {
      const asked = await room.pendingFor(true)
      if (asked?.kind !== 'D20_EVIDENCE')
        throw new Error(`Expected a repeat save, got ${asked?.kind}.`)
      const answered = await room.respond({
        kind: 'ENTER_DICE',
        requestId: asked.request.requestId,
        rawFaces: [1, 1],
        rollMode: asked.request.rollMode
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    }

    // The first contact's DAMAGED(AFTER) settled before its save: the hold it ended is gone and the
    // grant it gave is held, while the save it owes still waits.
    let history = await readRoomHistory(room.base.stub)
    expect(repeatSaveOutcomes(history)).toEqual([])
    expect(held(history)).toEqual({ laughing: true, damageEndedHold: false, grants: 1 })

    await failSave()
    // The second contact raises its own DAMAGED(AFTER): it owes no grant the Wolf already holds,
    // and its save waits after the first contact's settled one.
    history = await readRoomHistory(room.base.stub)
    expect(repeatSaveOutcomes(history)).toEqual(['SAVE_FAILURE'])
    expect(held(history)).toEqual({ laughing: true, damageEndedHold: false, grants: 1 })

    await failSave()
    history = await readRoomHistory(room.base.stub)
    expect(repeatSaveOutcomes(history)).toEqual(['SAVE_FAILURE', 'SAVE_FAILURE'])
    expect(held(history)).toEqual({ laughing: true, damageEndedHold: false, grants: 1 })
    expect(await room.pending()).toBeNull()
    // QUALITY-14.T2e2e: the move raised DAMAGED(AFTER) once per contact for its one holder, and its
    // commit re-derived once the raise of the contact whose damage ended and granted effects.
    expect(takeDamagedRaises()).toEqual({ room: [WOLF_ID, WOLF_ID], commit: [WOLF_ID] })
  }, 60_000)
})

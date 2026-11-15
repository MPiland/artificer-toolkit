import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readRoomHistory
} from './roomHistoryReads.js'
import { seedTurnSaveEffect } from './turnEvidenceFixture.js'

/**
 * SPELLS-4.T2m1b2b (D167): damage a turn effect deals to the incoming creature owes the holder of
 * Hideous Laughter the same repeat save an attack does.
 */

const FIRST_ID = testUuid(0x960)
const SECOND_ID = testUuid(0x961)
const THIRD_ID = testUuid(0x962)
const LAUGHTER_EFFECT_ID = testUuid(0x5660)

afterEach(() => {
  closeTrackedSockets()
})

describe('a room ADVANCE_TURN whose START_OF_TURN damage hits a Hideous Laughter holder', () => {
  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' as const, kept: false },
    { face: 1, outcome: 'SAVE_FAILURE' as const, kept: true }
  ])('rolls the repeat save for the GM ($outcome)', async ({ face, outcome, kept }) => {
    const first = srdCreatureActor({ id: FIRST_ID, creature: plainWolf })
    const second = srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
    const room = await movementRoom({
      actors: [first, second],
      moverActorId: FIRST_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      // A natural 1 fails the DC 30 turn save (1 damage); the repeat save rolls with Advantage.
      rolls: [0, face - 1, face - 1],
      definitions: [],
      seed: async ({ effects, encounterId, occurredAt }) => {
        await seedTurnSaveEffect({
          effects,
          encounterId,
          actor: second,
          stage: 'START_OF_TURN',
          ticks: 1,
          damage: 1,
          occurredAt
        })
        const planned = plannedTimedCondition({
          encounterId,
          sourceActorId: FIRST_ID,
          holderActorId: SECOND_ID,
          spell: hideousLaughter,
          lifetimeScope: 'ENCOUNTER'
        })
        await effects.create({
          id: LAUGHTER_EFFECT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: SECOND_ID },
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    })
    const before = await readRoomHistory(room.base.stub)
    const commandId = crypto.randomUUID()
    const answer = await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    expect(after.activeEffects.map(({ id }) => id).includes(LAUGHTER_EFFECT_ID)).toBe(kept)
    const checks = after.receipts.flatMap((receipt) => {
      const result = parseReceiptExecution(receipt)
      return result.status === 'COMPLETE' &&
        result.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
        result.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
        ? [result.applicationOutputs]
        : []
    })
    expect(checks).toMatchObject([{ outcome }])
  })
})

describe('a room ADVANCE_TURN whose START_OF_TURN damage names its source', () => {
  it.each([
    { label: 'the holder’s source side', turnSourceId: FIRST_ID, checks: 1 },
    { label: 'an enemy of the holder’s source', turnSourceId: THIRD_ID, checks: 0 }
  ])('repeats a source-side save only for $label', async ({ turnSourceId, checks: expected }) => {
    const first = srdCreatureActor({ id: FIRST_ID, creature: plainWolf })
    const second = srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
    const third = srdCreatureActor({ id: THIRD_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    const room = await movementRoom({
      actors: [first, second, third],
      moverActorId: FIRST_ID,
      positions: {
        [FIRST_ID]: { x: 150, y: 150 },
        [SECOND_ID]: { x: 250, y: 150 },
        [THIRD_ID]: { x: 350, y: 150 }
      },
      autoRoll: 'GAME_MASTER',
      rolls: [0, 0, 0],
      definitions: [],
      seed: async ({ effects, encounterId, occurredAt }) => {
        await seedTurnSaveEffect({
          effects,
          encounterId,
          actor: second,
          stage: 'START_OF_TURN',
          ticks: 1,
          damage: 1,
          occurredAt,
          sourceActorId: turnSourceId
        })
        const planned = plannedTimedCondition({
          encounterId,
          sourceActorId: FIRST_ID,
          holderActorId: SECOND_ID,
          spell: hideousLaughter,
          lifetimeScope: 'ENCOUNTER'
        })
        const { recurrence } = planned.definition
        await effects.create({
          id: LAUGHTER_EFFECT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: SECOND_ID },
          definition: {
            ...planned.definition,
            recurrence: {
              ...recurrence,
              repeatTriggers: recurrence.repeatTriggers?.map((trigger) => ({
                ...trigger,
                by: 'SOURCE_SIDE' as const
              }))
            }
          },
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    })
    const before = await readRoomHistory(room.base.stub)
    const commandId = crypto.randomUUID()
    const answer = await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    const repeatSaves = after.receipts.flatMap((receipt) => {
      const result = parseReceiptExecution(receipt)
      return result.status === 'COMPLETE' &&
        result.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
        result.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
        ? [result.applicationOutputs]
        : []
    })
    expect(repeatSaves).toHaveLength(expected)
  })
})

function srdCondition(code: string) {
  const type = SRD_CONDITION_TYPES.find((candidate) => candidate.code === code)
  if (!type) throw new Error(`The SRD has no ${code} condition.`)
  return type.id
}

describe('a room ADVANCE_TURN that ends a Hideous Laughter holder’s turn (QUALITY-14.T2e2f5)', () => {
  it('commits its passed turn-end save, which ends the effect and both conditions it owns', async () => {
    const prone = srdCondition('PRONE')
    const incapacitated = srdCondition('INCAPACITATED')
    const room = await movementRoom({
      actors: [
        srdCreatureActor({
          id: FIRST_ID,
          creature: plainWolf,
          conditionIds: [incapacitated, prone]
        }),
        srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
      ],
      moverActorId: FIRST_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      // A natural 20 passes the Wisdom save.
      rolls: [],
      fallbackRoll: 19,
      definitions: [],
      seed: async ({ effects, encounterId, occurredAt }) => {
        const planned = plannedTimedCondition({
          encounterId,
          sourceActorId: SECOND_ID,
          holderActorId: FIRST_ID,
          spell: hideousLaughter,
          lifetimeScope: 'ENCOUNTER'
        })
        await effects.create({
          id: LAUGHTER_EFFECT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: FIRST_ID },
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    })
    const before = await readRoomHistory(room.base.stub)
    expect(readActorConditionIds(before, FIRST_ID)).toEqual(
      expect.arrayContaining([incapacitated, prone])
    )
    const commandId = crypto.randomUUID()
    const answer = await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    expect(after.activeEffects.map(({ id }) => id)).not.toContain(LAUGHTER_EFFECT_ID)
    expect(readActorConditionIds(after, FIRST_ID)).not.toContain(prone)
    expect(readActorConditionIds(after, FIRST_ID)).not.toContain(incapacitated)
  })
})

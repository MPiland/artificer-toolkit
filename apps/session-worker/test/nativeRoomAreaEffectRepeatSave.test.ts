import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2m1b2b (D167): an area that damages two holders of Hideous Laughter raises one repeat
 * save per holder, each answered by its own controller, each ending only its own effect.
 */

const CASTER_ID = testUuid(0x950)
const FIRST_ID = testUuid(0x951)
const SECOND_ID = testUuid(0x952)
const LAUGHER_ID = testUuid(0x953)
const FIRST_EFFECT_ID = testUuid(0x5650)
const SECOND_EFFECT_ID = testUuid(0x5651)

afterEach(() => {
  closeTrackedSockets()
})

function laughingAreaRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      srdCreatureActor({ id: FIRST_ID, creature: plainWolf }),
      srdCreatureActor({ id: SECOND_ID, creature: plainWolf }),
      srdCreatureActor({ id: LAUGHER_ID, creature: plainWolf })
    ],
    ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id,
    seed: async ({ effects, encounterId, occurredAt }) => {
      for (const [id, holderActorId] of [
        [FIRST_EFFECT_ID, FIRST_ID],
        [SECOND_EFFECT_ID, SECOND_ID]
      ] as const) {
        const planned = plannedTimedCondition({
          encounterId,
          sourceActorId: LAUGHER_ID,
          holderActorId,
          spell: hideousLaughter,
          lifetimeScope: 'ENCOUNTER'
        })
        await effects.create({
          id,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: holderActorId },
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    }
  })
}

const effectIds = (history: RoomHistory) => history.activeEffects.map(({ id }) => id)

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

describe('an area that damages two holders of Hideous Laughter (D167)', () => {
  it('raises one repeat save per holder and ends only the effect of the holder that made it', async () => {
    const room = await laughingAreaRoom()
    expect(effectIds(await readRoomHistory(room.room.base.stub))).toEqual(
      expect.arrayContaining([FIRST_EFFECT_ID, SECOND_EFFECT_ID])
    )
    await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room)

    const faces = new Map([
      [FIRST_ID, 20],
      [SECOND_ID, 1]
    ])
    const answered: string[] = []
    for (let step = 0; step < 2; step += 1) {
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a repeat save.')
      const { rollerActorId, request } = decision.pending
      answered.push(rollerActorId)
      const resolved = await room.resolve(decision, {
        kind: 'ENTER_DICE',
        requestId: request.requestId,
        rawFaces: [faces.get(rollerActorId) ?? 1, faces.get(rollerActorId) ?? 1],
        rollMode: request.rollMode
      })
      expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
    }

    const after = await readRoomHistory(room.room.base.stub)
    expect(new Set(answered)).toEqual(new Set([FIRST_ID, SECOND_ID]))
    expect(
      repeatSaveChecks(after)
        .map(({ outcome }) => outcome)
        .sort()
    ).toEqual(['SAVE_FAILURE', 'SAVE_SUCCESS'])
    expect(effectIds(after)).not.toContain(FIRST_EFFECT_ID)
    expect(effectIds(after)).toContain(SECOND_EFFECT_ID)
  })
})

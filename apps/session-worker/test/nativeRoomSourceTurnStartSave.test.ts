import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  plannedSourceTurnStartEffect,
  sourceTurnStartRuling,
  sourceTurnStartSpell
} from '@artificer-toolkit/rules-runtime/testing/sourceTurnStartSaveSpell'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2ps-c: a condition held until the start of its source's next turn lets the holder save
 * once there; it ends either way, and a failed save proposes the spell's GM ruling.
 */

const HOLDER_ID = testUuid(0x970)
const SOURCE_ID = testUuid(0x971)
const EFFECT_ID = testUuid(0x5670)

afterEach(() => {
  closeTrackedSockets()
})

describe('a room ADVANCE_TURN into the source turn of a held condition', () => {
  it.each([
    { face: 20, path: 'ON_SAVE_SUCCESS' as const },
    { face: 1, path: 'ON_SAVE_FAIL' as const }
  ])('saves once and releases the condition ($path)', async ({ face, path }) => {
    const holder = srdCreatureActor({ id: HOLDER_ID, creature: plainWolf })
    const source = srdCreatureActor({ id: SOURCE_ID, creature: plainWolf })
    const room = await movementRoom({
      actors: [holder, source],
      moverActorId: HOLDER_ID,
      positions: { [HOLDER_ID]: { x: 150, y: 150 }, [SOURCE_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      rolls: [face - 1, face - 1],
      definitions: [],
      seed: async ({ effects, encounterId, occurredAt }) => {
        const planned = await plannedSourceTurnStartEffect({
          spell: sourceTurnStartSpell([sourceTurnStartRuling]),
          encounterId,
          sourceActorId: SOURCE_ID,
          holderActorId: HOLDER_ID
        })
        await effects.create({
          id: EFFECT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    })
    const before = await readRoomHistory(room.base.stub)
    expect(before.activeEffects.map(({ id }) => id)).toContain(EFFECT_ID)
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
    expect(after.activeEffects.map(({ id }) => id)).not.toContain(EFFECT_ID)
    const turnEffects = after.receipts.flatMap((receipt) => {
      const result = parseReceiptExecution(receipt)
      return result.status === 'TURN_LIFECYCLE_COMPLETE' && result.incomingTurn.kind === 'EXECUTED'
        ? result.incomingTurn.executions
        : []
    })
    expect(turnEffects).toHaveLength(1)
    const [turnEffect] = turnEffects
    expect(turnEffect?.d20?.resultPath).toBe(path)
    // The turn receipt shows the ruling beside the save; it proposes only when the save failed.
    expect(
      turnEffect?.execution.status === 'COMPLETE'
        ? turnEffect.execution.evidence.trace.find(
            ({ nodeId }) => nodeId === 'manual_adjudication-1'
          )?.outputs
        : undefined
    ).toMatchObject({ authoredPath: 'ON_SAVE_FAIL', resolvedPath: path })
  })
})

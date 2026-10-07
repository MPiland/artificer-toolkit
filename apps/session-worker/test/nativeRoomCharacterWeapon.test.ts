import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xb00)
const FIGHTER_ID = testUuid(0xb01)
const WOLF_ID = testUuid(0xb02)

/** The captured Fighter's Strength 15 (standard array) is a +2 modifier. */
const STRENGTH_MODIFIER = 2

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('a Character weapon critical hit in the room', () => {
  it('rolls the equipped Club’s damage die twice and adds the Strength modifier once', async () => {
    // The Fighter's attack d20 shows 20; the two d4s show 3 and 4.
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [19, 2, 3],
      actors: [
        characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      characterPlay: { equipped: true },
      characterAction: (action) => action.label.includes('Club')
    })
    // No Scene is bound to measure the Club's reach (D11).
    const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(room.room.diceDrawn()).toBe(3)

    const { receipts } = await readRoomHistory(room.room.base.stub)
    const [receipt] = receipts.filter(({ commandType }) => commandType === 'RESOLVE_ACTION')
    const settled = parseReceiptExecution(receipt!)
    if (
      settled.status !== 'COMPLETE' ||
      settled.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    )
      throw new Error('Expected a settled Club attack on the Wolf.')
    const batch = settled.applicationOutputs
    expect(batch.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(
      batch.applications.flatMap((application) =>
        application.kind === 'DAMAGE' ? [application.requestedAmount] : []
      )
    ).toEqual([3 + 4 + STRENGTH_MODIFIER])
  })
})

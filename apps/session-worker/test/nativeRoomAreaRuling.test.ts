import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { zoneOfTruth } from '@artificer-toolkit/source-data/srd/spells/zone-of-truth.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3m: an area that tests no one and leaves each creature it catches to the GM. The cast
 * catches the creatures in its area with no save, in one commit, and lands its timed ruling on each.
 */

const CHARACTER_ACTOR_ID = testUuid(0x8c0)
const CHARACTER_ID = testUuid(0x8c1)
const NEAR_ID = testUuid(0x8c2)
const OTHER_NEAR_ID = testUuid(0x8c3)
const FAR_ID = testUuid(0x8c4)

afterEach(closeTrackedSockets)

describe('room cast of an area GM ruling (QUALITY-15.T3m)', () => {
  it('lands the ruling on each creature its sphere catches and on none beyond it', async () => {
    // Zone of Truth's 15-foot sphere (300 px) at x = 800 reaches the Wolves at 700 and 900, not the
    // one at 1500 or the Character at 150.
    const room = await actionRoom({
      actors: [
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        ...[NEAR_ID, OTHER_NEAR_ID, FAR_ID].map((id) =>
          srdCreatureActor({ id, creature: plainWolf })
        )
      ],
      positions: {
        [NEAR_ID]: { x: 700, y: 150 },
        [OTHER_NEAR_ID]: { x: 900, y: 150 },
        [FAR_ID]: { x: 1500, y: 150 }
      },
      characterSpellcasting: { spells: [zoneOfTruth], prepared: [zoneOfTruth.id] },
      characterAction: (action) => action.label.startsWith('Zone of Truth'),
      fallbackRoll: 10
    })

    const { answer } = await room.startAreaAction({ x: 800, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const stored = await readRoomHistory(room.room.base.stub)
    const caught = [NEAR_ID, OTHER_NEAR_ID].sort()
    expect(stored.activeEffects.map(({ targetActorId }) => targetActorId).sort()).toEqual(caught)
    const { roots, children } = areaReceipts(stored)
    expect(roots).toHaveLength(1)
    expect(children.map(({ outputs }) => outputs.targetActorId).sort()).toEqual(caught)
  }, 120000)
})

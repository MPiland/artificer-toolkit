import { runInDurableObject } from 'cloudflare:test'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { theFiend } from '@artificer-toolkit/source-data/srd/classes/the-fiend.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4i2: Dark One's Blessing is a `DEFEAT_TEMPORARY_HIT_POINTS` grant. The room gives the
 * holder temporary hit points when its own action reduces a hostile creature to 0 hit points.
 */

const WARLOCK_ACTOR_ID = testUuid(0xa10)
const WARLOCK_ID = testUuid(0xa11)
const WOLF_ID = testUuid(0xa12)
const found = theFiend.features?.find(({ label }) => label === "Dark One's Blessing")
if (!found) throw new Error("The SRD Fiend authors Dark One's Blessing.")
const BLESSING = { ...found, availableAtLevel: 1 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

async function strike(wolfHitPoints: number, features: readonly (typeof BLESSING)[]) {
  const room = await actionRoom({
    autoRoll: 'BOTH',
    // The attack d20 shows 20 and the Club's d4 shows 3, enough to defeat the wolf at 1 hit point.
    rolls: [19, 2, 3],
    fallbackRoll: 0,
    actors: [
      characterActor({ id: WARLOCK_ACTOR_ID, characterId: WARLOCK_ID }),
      srdCreatureActor({
        id: WOLF_ID,
        creature: plainWolf,
        currentHitPoints: wolfHitPoints,
        disposition: 'HOSTILE'
      })
    ],
    characterClassFeatures: features,
    characterPlay: { equipped: true },
    characterAction: (action) => action.label.includes('Club')
  })
  const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const vitals = vitalsOf(await readRoomHistory(room.room.base.stub))
  const warlockTemporary = await runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === WARLOCK_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.temp
  })
  return {
    warlockTemporary,
    wolfHitPoints: vitals.find(({ id }) => id === WOLF_ID)?.currentHitPoints
  }
}

describe("room Dark One's Blessing (SPELLS-31.T4i2)", () => {
  it('gives the holder at least 1 temporary hit point for defeating a hostile creature', async () => {
    const { warlockTemporary, wolfHitPoints } = await strike(1, [BLESSING])
    expect(wolfHitPoints).toBe(0)
    expect(warlockTemporary).toBeGreaterThanOrEqual(1)
  }, 120000)

  it('gives nothing when the hit leaves the creature standing or the holder has no such grant', async () => {
    const standing = await strike(11, [BLESSING])
    expect(standing.wolfHitPoints).toBeGreaterThan(0)
    expect(standing.warlockTemporary).toBe(0)
    expect((await strike(1, [])).warlockTemporary).toBe(0)
  }, 120000)
})

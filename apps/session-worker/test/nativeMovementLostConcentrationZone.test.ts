import { runInDurableObject } from 'cloudflare:test'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { spatialDamageEffect } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { CONCENTRATION_STATE_ID, movementRoom } from './movementRoomFixture.js'

/**
 * D220: a Concentration lost mid-move stops that zone's later damage. The mover maintains a damaging
 * zone of its own (a Moonbeam) further along its path; an enemy's zone damages it first, it fails
 * the Concentration check, and the walk on through where its own zone stood deals nothing.
 */

const MOVER_ID = testUuid(0x200)
const CHARACTER_ID = testUuid(0x400)
const MOVER_START: ScenePoint = { x: 150, y: 150 }
const OWN_ZONE_ID = testUuid(0x6015)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('a zone whose source loses Concentration mid-move (D220)', () => {
  it('deals no later damage once the first contact ended the Concentration that maintains it', async () => {
    const room = await movementRoom({
      actors: [characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: MOVER_START },
      autoRoll: 'PLAYER',
      concentration: true,
      characterPlay: { currentHitPoints: 20 },
      // The enemy's zone, crossed first.
      spatialEffects: [{ center: { x: 350, y: 150 }, radius: 50 }],
      // The Concentration check rolls a natural 1 and fails.
      rolls: [0],
      seed: async ({ spatial, encounterId }) => {
        const zone = await spatialDamageEffect({
          encounterId,
          targetActorId: MOVER_ID,
          center: { x: 500, y: 150 },
          radius: 20,
          variant: 1
        })
        if (zone.id !== OWN_ZONE_ID) throw new Error('The mover zone fixture id changed.')
        await spatial.create({ ...zone, maintainedEffectStateId: CONCENTRATION_STATE_ID })
      }
    })

    await room.move([MOVER_START, { x: 650, y: 150 }])

    const receipts = await room.receipts()
    const checks = receipts.filter((entry) => entry.commandType === 'DAMAGE_SAVE_CHECK')
    expect(checks.map((entry) => entry.result)).toMatchObject([
      {
        applicationOutputs: {
          outcome: 'SAVE_FAILURE',
          cleanup: { maintainedStateId: CONCENTRATION_STATE_ID, removedZoneIds: [OWN_ZONE_ID] }
        }
      }
    ])
    // Only the enemy's zone acted on the mover; its own zone ended before the walk reached it.
    const [move] = receipts.filter((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')
    const { executions } = move!.result as {
      executions: { candidate: { candidate: { effectId: string } } }[]
    }
    expect(executions.map(({ candidate }) => candidate.candidate.effectId)).toEqual([
      room.spatialEffectIds[0]
    ])
    // Its own zone ended with the Concentration, and only the failed check rolled a die.
    const zoneIds = await runInDurableObject(room.base.stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage)
        .documents('encounterSpatialRuleEffects')
        .map(({ id }) => id)
    )
    expect(zoneIds).not.toContain(OWN_ZONE_ID)
    expect(room.diceDrawn()).toBe(1)
  })
})

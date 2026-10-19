import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { owl } from '@artificer-toolkit/source-data/srd/creatures/owl.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { reactionWeapon } from './reactionClubFixture.js'

/**
 * SPELLS-33.T5k (D156): the SRD Flyby feature, authored as an `OPPORTUNITY_ATTACK_IMMUNITY` grant,
 * gives its holder a walk out of an enemy's reach that provokes no opportunity attack.
 */

const FIGHTER_ACTOR_ID = testUuid(0x5b50)
const FIGHTER_ID = testUuid(0x5b51)
const MOVER_ID = testUuid(0x5b52)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf carrying the Owl's SRD Flyby feature. */
const flybyWolf: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0x5b53),
  features: [...(plainWolf.features ?? []), creatureFeature(owl, 'Flyby')]
}

/** The mover leaves the Fighter's reach; returns the kind of decision the move leaves pending. */
async function pendingKindAfterLeavingReach(mover: CreatureAuthored) {
  const room = await movementRoom({
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: MOVER_ID, creature: mover })
    ],
    moverActorId: MOVER_ID,
    positions: { [FIGHTER_ACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
    characterEquipment: [reactionWeapon('BLUDGEONING')]
  })
  const moved = await room.move([MOVER_START, { x: 450, y: 150 }])
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  return (await room.pending())?.context.kind
}

describe('room Flyby (SPELLS-33.T5k)', () => {
  it('offers the Fighter an opportunity attack on a creature without Flyby', async () => {
    expect(await pendingKindAfterLeavingReach(plainWolf)).toBe('ENCOUNTER_MOVEMENT_REACTION')
  }, 60_000)

  it('offers no opportunity attack on a creature with Flyby', async () => {
    expect(await pendingKindAfterLeavingReach(flybyWolf)).toBeUndefined()
  }, 60_000)
})

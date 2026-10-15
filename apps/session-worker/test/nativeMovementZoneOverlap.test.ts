import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * SPELLS-24: a zone affects a creature only when its footprint overlaps the zone with positive
 * area; touching the edge never does (user ruling 2026-10-14, D103 "Catching").
 */

const MOVER_ID = testUuid(0x200)
const MOVER_START: ScenePoint = { x: 150, y: 150 }
/** Covers x 300 to 400 and y 100 to 200 on the room's 100 px tokens. */
const zone = { center: { x: 350, y: 150 }, radius: 50 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function zoneRoom() {
  return movementRoom({
    actors: [srdCreatureActor({ id: MOVER_ID, creature: plainWolf })],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: MOVER_START },
    autoRoll: 'GAME_MASTER',
    spatialEffects: [zone]
  })
}

describe('a zone caught by positive-area overlap', () => {
  it('takes no effect while touching the zone edge, and takes it once the footprint crosses in', async () => {
    const room = await zoneRoom()

    // The mover's footprint now spans x 200 to 300: it touches the zone at (300, 150) only.
    const touching = await room.move([MOVER_START, { x: 250, y: 150 }])
    expect(touching).toMatchObject({ type: 'COMMAND_COMMITTED' })
    expect(await room.receipts()).toEqual([])

    const crossing = await room.move(
      [
        { x: 250, y: 150 },
        { x: 450, y: 150 }
      ],
      room.encounterVersion,
      room.scene.version + 1
    )
    expect(crossing).toMatchObject({ type: 'COMMAND_COMMITTED' })
    const move = (await room.receipts()).find((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')
    expect(move?.result).toMatchObject({
      executions: [{ ordinal: 0 }],
      spatialEffectTransitions: [{ transition: { kind: 'DELETE' } }]
    })
  })

  it('takes no effect when the footprint only slides tangent to the zone', async () => {
    const room = await zoneRoom()

    // Along y 250 the footprint spans y 200 to 300 and touches the zone's lower edge.
    const answer = await room.move([MOVER_START, { x: 150, y: 250 }, { x: 550, y: 250 }])

    expect(answer).toMatchObject({ type: 'COMMAND_COMMITTED' })
    expect(await room.receipts()).toEqual([])
  })
})

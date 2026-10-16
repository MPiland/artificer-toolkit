import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * SPELLS-17.6: a Scene undo restores a token's position only. A move that settled Encounter
 * mechanics (damage, ended grants) is refused, and the action undo does not revert a move either.
 */

const MOVER_ID = testUuid(0x200)
const MOVER_START: ScenePoint = { x: 150, y: 150 }
const hazard = { center: { x: 350, y: 150 }, radius: 50 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function wolfRoom() {
  return movementRoom({
    actors: [srdCreatureActor({ id: MOVER_ID, creature: plainWolf })],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: MOVER_START },
    autoRoll: 'GAME_MASTER',
    spatialEffects: [hazard]
  })
}

type Room = Awaited<ReturnType<typeof wolfRoom>>

function undoSceneMove(room: Room, expectedSceneVersion: number) {
  const commandId = crypto.randomUUID()
  return room.send(commandId, {
    scope: 'SCENE',
    command: {
      type: 'UNDO_LAST_SCENE_MOVE',
      commandId,
      expectedSceneVersion,
      sceneId: room.scene.id
    }
  })
}

describe('Scene undo of an Encounter move', () => {
  it('undoes a move that settled no Encounter mechanics', async () => {
    const room = await wolfRoom()
    await room.move([MOVER_START, { x: 250, y: 150 }])
    expect(await room.receipts()).toEqual([])

    const undone = await undoSceneMove(room, room.scene.version + 1)

    expect(undone).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVE_UNDONE', position: MOVER_START } } }
    })
  })

  it('refuses a move that settled Encounter mechanics, so the damage cannot outlive the position', async () => {
    const room = await wolfRoom()
    await room.move([MOVER_START, { x: 450, y: 150 }])
    expect((await room.receipts()).map(({ commandType }) => commandType)).toEqual([
      'MOVE_SCENE_TOKEN'
    ])

    const undone = await undoSceneMove(room, room.scene.version + 1)

    expect(undone).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'INVALID_COMMAND',
      message: 'This move settled Encounter mechanics and cannot be undone as a Scene move.'
    })
    expect((await room.receipts()).map(({ commandType }) => commandType)).toEqual([
      'MOVE_SCENE_TOKEN'
    ])
  })

  it('does not let the action undo revert a move either', async () => {
    const room = await wolfRoom()
    await room.move([MOVER_START, { x: 450, y: 150 }])

    const commandId = crypto.randomUUID()
    const reverted = await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'REVERT_LAST_ACTION',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: room.encounterVersion + 1
      }
    })

    expect(reverted).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'REVERT_UNAVAILABLE' })
  })
})

import { runInDurableObject } from 'cloudflare:test'
import {
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom, type MovementRoomConfig } from './movementRoomFixture.js'

/**
 * ATTACK-7.5 (D105): a grappler that moves drags the creature it holds along the same displacement,
 * at double cost, in one Scene move that one undo reverts; the dragged creature never reacts.
 */

const GRAPPLER_ID = testUuid(0xe70)
const HELD_ID = testUuid(0xe71)
const GRAPPLER_START: ScenePoint = { x: 150, y: 150 }
const HELD_START: ScenePoint = { x: 50, y: 150 }
const GRAPPLED = srdCondition('Grappled')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A HOSTILE grappler holds a FRIENDLY Wolf whose Bite is an opportunity attack, just behind it. */
async function dragRoom(
  options: { dragged: boolean } & Pick<MovementRoomConfig, 'sceneOverrides'>
) {
  let heldTokenId = ''
  const room = await movementRoom({
    actors: [
      srdCreatureActor({ id: GRAPPLER_ID, creature: plainWolf }),
      srdCreatureActor({
        id: HELD_ID,
        creature: reactionWolf,
        disposition: 'FRIENDLY',
        conditionIds: [GRAPPLED]
      })
    ],
    moverActorId: GRAPPLER_ID,
    positions: { [GRAPPLER_ID]: GRAPPLER_START, [HELD_ID]: HELD_START },
    autoRoll: 'GAME_MASTER',
    fallbackRoll: 0,
    ...(options.sceneOverrides ? { sceneOverrides: options.sceneOverrides } : {}),
    seed: async ({ effects, encounterId, occurredAt, tokenIdOf }) => {
      heldTokenId = tokenIdOf(HELD_ID)
      await effects.create({
        id: testUuid(0xe72),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HELD_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: GRAPPLER_ID,
          conditionIds: [GRAPPLED],
          dragged: options.dragged
        }),
        occurredAt
      })
    }
  })
  return { room, heldTokenId }
}

/** The feet the actor's movements this Encounter used, as the room recorded them. */
async function feetMoved(room: Awaited<ReturnType<typeof dragRoom>>['room'], actorId: string) {
  const movements = await runInDurableObject(room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
  )
  return movements
    .filter((movement) => movement.actorId === actorId)
    .reduce((total, { usedFeet }) => total + usedFeet, 0)
}

describe('a grappler drags the creature it holds (ATTACK-7.T7, D105), in the room', () => {
  it('moves the held creature with it in one Scene move, at double cost, with no reaction', async () => {
    const { room, heldTokenId } = await dragRoom({ dragged: true })

    const moved = await room.move([GRAPPLER_START, { x: 450, y: 150 }])

    expect(moved).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: {
        result: {
          version: room.scene.version + 1,
          delta: {
            kind: 'BATCH',
            deltas: [
              { kind: 'TOKEN_MOVED', tokenId: room.moverTokenId, position: { x: 450, y: 150 } },
              { kind: 'TOKEN_MOVED', tokenId: heldTokenId, position: { x: 350, y: 150 } }
            ]
          }
        }
      }
    })
    // The held Wolf leaves the grappler's reach only by moving with it, so it never reacts.
    expect(await room.pending()).toBeNull()
    // 300 px is 15 ft; both Wolves are Medium, so the drag costs double.
    expect(await feetMoved(room, GRAPPLER_ID)).toBe(30)
    expect(await feetMoved(room, HELD_ID)).toBe(0)
  }, 60_000)

  it('lets the held creature react to a grappler whose hold does not drag', async () => {
    const { room } = await dragRoom({ dragged: false })

    await room.move([GRAPPLER_START, { x: 450, y: 150 }])

    expect((await room.pending())?.context.kind).toBe('ENCOUNTER_MOVEMENT_REACTION')
  }, 60_000)

  it('undoes the whole drag in one Scene undo', async () => {
    const { room, heldTokenId } = await dragRoom({ dragged: true })
    await room.move([GRAPPLER_START, { x: 450, y: 150 }])

    const commandId = crypto.randomUUID()
    const undone = await room.send(commandId, {
      scope: 'SCENE',
      command: {
        type: 'UNDO_LAST_SCENE_MOVE',
        commandId,
        expectedSceneVersion: room.scene.version + 1,
        sceneId: room.scene.id
      }
    })

    expect(undone).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: {
        result: {
          delta: {
            kind: 'BATCH',
            deltas: [
              { kind: 'TOKEN_MOVE_UNDONE', tokenId: room.moverTokenId, position: GRAPPLER_START },
              { kind: 'TOKEN_MOVE_UNDONE', tokenId: heldTokenId, position: HELD_START }
            ]
          }
        }
      }
    })
  }, 60_000)

  it('refuses a drag that would pull the held creature through a wall', async () => {
    const wall = {
      kind: 'WALL' as const,
      id: testUuid(0xe73),
      a: { x: 100, y: 0 },
      b: { x: 100, y: 1000 },
      blocksLight: true,
      blocksMovement: true
    }
    const { room } = await dragRoom({ dragged: true, sceneOverrides: { barriers: [wall] } })

    const moved = await room.move([GRAPPLER_START, { x: 250, y: 150 }])

    expect(moved).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'MOVEMENT_BLOCKED',
      message: 'Release the grapple first.'
    })
    expect(await feetMoved(room, GRAPPLER_ID)).toBe(0)
  }, 60_000)
})

import { runInDurableObject } from 'cloudflare:test'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * MOVE-4.T2b1: a creature clinging to another through a `SOURCE_FOLLOWS_TARGET` relationship moves
 * with it in the same Scene move, at no cost to either, and moves within its space unblocked.
 */

const MOUNT_ID = testUuid(0xe80)
const CLIMBER_ID = testUuid(0xe81)
const START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A HOSTILE Wolf and, inside its space, a FRIENDLY Wolf whose Bite is an opportunity attack. With
 * `clinging`, the FRIENDLY Wolf applied a relationship on the HOSTILE one that it follows.
 */
async function clingRoom(options: { mover: 'MOUNT' | 'CLIMBER'; clinging: boolean }) {
  let climberTokenId = ''
  const room = await movementRoom({
    actors: [
      srdCreatureActor({ id: MOUNT_ID, creature: plainWolf }),
      srdCreatureActor({ id: CLIMBER_ID, creature: reactionWolf, disposition: 'FRIENDLY' })
    ],
    moverActorId: options.mover === 'MOUNT' ? MOUNT_ID : CLIMBER_ID,
    positions: { [MOUNT_ID]: START, [CLIMBER_ID]: START },
    autoRoll: 'GAME_MASTER',
    fallbackRoll: 0,
    seed: async ({ effects, encounterId, occurredAt, tokenIdOf }) => {
      climberTokenId = tokenIdOf(CLIMBER_ID)
      await effects.create({
        id: testUuid(0xe82),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: MOUNT_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: CLIMBER_ID,
          conditionIds: [],
          follows: options.clinging
        }),
        occurredAt
      })
    }
  })
  return { room, climberTokenId }
}

/** The feet the actor's movements this Encounter used, as the room recorded them. */
async function feetMoved(room: Awaited<ReturnType<typeof clingRoom>>['room'], actorId: string) {
  const movements = await runInDurableObject(room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
  )
  return movements
    .filter((movement) => movement.actorId === actorId)
    .reduce((total, { usedFeet }) => total + usedFeet, 0)
}

describe('a clinging creature follows the creature it clings to (MOVE-4.T2b1), in the room', () => {
  it('moves the clinging creature with its mount in one Scene move, at no extra cost, with no reaction', async () => {
    const { room, climberTokenId } = await clingRoom({ mover: 'MOUNT', clinging: true })

    const moved = await room.move([START, { x: 450, y: 150 }])

    expect(moved).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: {
        result: {
          version: room.scene.version + 1,
          delta: {
            kind: 'BATCH',
            deltas: [
              { kind: 'TOKEN_MOVED', tokenId: room.moverTokenId, position: { x: 450, y: 150 } },
              { kind: 'TOKEN_MOVED', tokenId: climberTokenId, position: { x: 450, y: 150 } }
            ]
          }
        }
      }
    })
    // The clinging Wolf never leaves its mount's reach, so it never reacts.
    expect(await room.pending()).toBeNull()
    // 300 px is 15 ft; a clinging creature, unlike a dragged one, does not double the cost.
    expect(await feetMoved(room, MOUNT_ID)).toBe(15)
    expect(await feetMoved(room, CLIMBER_ID)).toBe(0)
  }, 60_000)

  it('leaves the creature behind when its relationship does not follow', async () => {
    const { room } = await clingRoom({ mover: 'MOUNT', clinging: false })

    await room.move([START, { x: 450, y: 150 }])

    expect((await room.pending())?.context.kind).toBe('ENCOUNTER_MOVEMENT_REACTION')
  }, 60_000)

  it('undoes the mount’s move and its clinging creature’s in one Scene undo', async () => {
    const { room, climberTokenId } = await clingRoom({ mover: 'MOUNT', clinging: true })
    await room.move([START, { x: 450, y: 150 }])

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
              { kind: 'TOKEN_MOVE_UNDONE', tokenId: room.moverTokenId, position: START },
              { kind: 'TOKEN_MOVE_UNDONE', tokenId: climberTokenId, position: START }
            ]
          }
        }
      }
    })
  }, 60_000)

  it('lets the clinging creature move out of and back into its hostile mount’s space', async () => {
    const path = [START, { x: 250, y: 150 }, START]
    const clinging = await clingRoom({ mover: 'CLIMBER', clinging: true })

    expect(await clinging.room.move(path)).toMatchObject({ type: 'COMMAND_COMMITTED' })

    // Without the relationship the hostile Wolf's space still refuses the endpoint.
    const free = await clingRoom({ mover: 'CLIMBER', clinging: false })
    expect(await free.room.move(path)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'MOVEMENT_BLOCKED'
    })
  }, 60_000)
})

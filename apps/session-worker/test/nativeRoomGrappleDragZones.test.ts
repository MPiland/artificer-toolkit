import {
  characterActor,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import {
  plainWolf,
  reactionWolf,
  spatialDamageEffect
} from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T1k (D170): the Scene effects a drag crosses settle on the dragged creature in the
 * grappler's own move, through the same spatial candidate execution a forced move uses. A token is
 * 100 px and a cell 5 ft; the held creature walks the grappler's path from 100 px behind it.
 */

const GRAPPLER_ID = testUuid(0xf70)
const HELD_ID = testUuid(0xf71)
const HELD_CHARACTER_ID = testUuid(0xf73)
const GRAPPLER_START: ScenePoint = { x: 150, y: 150 }
const HELD_START: ScenePoint = { x: 50, y: 150 }
const GRAPPLED = srdCondition('Grappled')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A grappler holds, and drags, a Wolf (or Character) next to a zone that hurts only the held one. */
async function zoneDragRoom(
  zone: { center: ScenePoint; radius: number; save?: boolean },
  options: {
    heldHitPoints?: number
    heldKinds?: ('VOLUNTARY' | 'FORCED')[]
    activation?: 'ONE_SHOT' | 'REPEATABLE'
    heldCharacter?: boolean
  } = {}
) {
  const room = await movementRoom({
    actors: [
      srdCreatureActor({ id: GRAPPLER_ID, creature: plainWolf }),
      options.heldCharacter
        ? characterActor({ id: HELD_ID, characterId: HELD_CHARACTER_ID })
        : srdCreatureActor({
            id: HELD_ID,
            creature: reactionWolf,
            disposition: 'FRIENDLY',
            conditionIds: [GRAPPLED],
            currentHitPoints: options.heldHitPoints
          })
    ],
    moverActorId: GRAPPLER_ID,
    positions: { [GRAPPLER_ID]: GRAPPLER_START, [HELD_ID]: HELD_START },
    autoRoll: options.heldCharacter ? 'BOTH' : 'GAME_MASTER',
    fallbackRoll: 0,
    ...(options.heldCharacter ? { concentration: true, concentrationOwnerActorId: HELD_ID } : {}),
    seed: async ({ effects, spatial, encounterId, occurredAt }) => {
      await effects.create({
        id: testUuid(0xf72),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HELD_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: GRAPPLER_ID,
          conditionIds: [GRAPPLED],
          dragged: true
        }),
        occurredAt
      })
      await spatial.create(
        await spatialDamageEffect({
          encounterId,
          targetActorId: HELD_ID,
          movementKinds: options.heldKinds ?? ['VOLUNTARY', 'FORCED'],
          triggerModes: ['ENTER', 'CROSS'],
          activation: options.activation ?? 'REPEATABLE',
          ...zone
        })
      )
    }
  })
  return room
}
type Room = Awaited<ReturnType<typeof zoneDragRoom>>

const dragTo = (room: Room, x: number) => room.move([GRAPPLER_START, { x, y: 150 }])

const heldHitPoints = async (room: Room) =>
  readActorHitPoints(await readRoomHistory(room.base.stub), HELD_ID)

describe('a drag through Scene effects (SPELLS-4.T1k, D170)', () => {
  it('settles the damage of a zone the dragged creature passes through, in the grappler’s own move', async () => {
    const room = await zoneDragRoom({ center: { x: 250, y: 150 }, radius: 20 })
    const heldBefore = await heldHitPoints(room)

    const moved = await dragTo(room, 450)

    expect(moved).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: {
        result: {
          delta: {
            kind: 'BATCH',
            deltas: [
              { kind: 'TOKEN_MOVED', tokenId: room.moverTokenId, position: { x: 450, y: 150 } },
              { kind: 'TOKEN_MOVED', position: { x: 350, y: 150 } }
            ]
          }
        }
      }
    })
    expect(await heldHitPoints(room)).toBe(heldBefore! - 1)
    expect(await room.pending()).toBeNull()
    expect((await room.receipts()).map(({ commandType }) => commandType)).toEqual([
      'MOVE_SCENE_TOKEN'
    ])
  }, 60_000)

  it('settles the damage of a zone the dragged creature lands in', async () => {
    const room = await zoneDragRoom({ center: { x: 350, y: 150 }, radius: 20 })
    const before = await heldHitPoints(room)

    await dragTo(room, 450)

    expect(await heldHitPoints(room)).toBe(before! - 1)
  }, 60_000)

  it('settles a zone the dragged creature never touches as nothing', async () => {
    const room = await zoneDragRoom({ center: { x: 650, y: 150 }, radius: 20 })
    const before = await heldHitPoints(room)

    await dragTo(room, 450)

    expect(await heldHitPoints(room)).toBe(before)
    expect(await room.receipts()).toEqual([])
  }, 60_000)

  it('leaves a zone that only catches a voluntary mover alone: a drag is a forced move for the held creature', async () => {
    const room = await zoneDragRoom(
      { center: { x: 250, y: 150 }, radius: 20 },
      { heldKinds: ['VOLUNTARY'] }
    )
    const before = await heldHitPoints(room)

    await dragTo(room, 450)

    expect(await heldHitPoints(room)).toBe(before)
  }, 60_000)

  it('stops the whole drag where a zone drops the dragged creature to 0 hit points', async () => {
    const room = await zoneDragRoom(
      { center: { x: 250, y: 150 }, radius: 20 },
      { heldHitPoints: 1 }
    )

    const moved = await dragTo(room, 450)

    expect(await heldHitPoints(room)).toBe(0)
    expect(moved).toMatchObject({ type: 'COMMAND_COMMITTED' })
    const deltas = (
      moved as { delta: { result: { delta: { deltas: { position: ScenePoint }[] } } } }
    ).delta.result.delta.deltas
    // Both tokens stop at the same displacement short of the end of the path.
    expect(deltas[0]!.position.x).toBeLessThan(450)
    expect(deltas[1]!.position.x - deltas[0]!.position.x).toBe(HELD_START.x - GRAPPLER_START.x)
  }, 60_000)

  it('rolls a save-or-damage zone with the room’s dice and records the outcome (homebrew zone)', async () => {
    const room = await zoneDragRoom({ center: { x: 250, y: 150 }, radius: 20, save: true })
    const before = await heldHitPoints(room)

    await dragTo(room, 450)

    expect(await heldHitPoints(room)).toBe(before! - 1)
    expect(await room.pending()).toBeNull()
  }, 60_000)

  it('breaks the Concentration of a Character the drag takes through a zone', async () => {
    const room = await zoneDragRoom(
      { center: { x: 250, y: 150 }, radius: 20 },
      { heldCharacter: true }
    )
    expect((await readRoomHistory(room.base.stub)).maintainedStates).toHaveLength(1)

    await dragTo(room, 450)

    expect((await readRoomHistory(room.base.stub)).maintainedStates).toEqual([])
  }, 60_000)

  it('refuses the Scene undo of a drag that settled a zone, with both creatures where the drag left them', async () => {
    const room = await zoneDragRoom({ center: { x: 250, y: 150 }, radius: 20 })
    const before = await heldHitPoints(room)
    await dragTo(room, 450)
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
      type: 'COMMAND_REJECTED',
      message: 'This move settled Encounter mechanics and cannot be undone as a Scene move.'
    })
    expect(await heldHitPoints(room)).toBe(before! - 1)
  }, 60_000)
})

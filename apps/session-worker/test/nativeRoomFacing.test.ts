import { runInDurableObject } from 'cloudflare:test'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * ATTACK-12.T1: with the Facing rule on, a voluntary move may end in a facing, and a creature may
 * turn as a reaction. Turning is never movement, the Scene undo of a move turns the token back, and
 * the action undo of a reaction turns it back and returns the reaction. The SRD Facing rule allows
 * 90-degree steps.
 */

const MOVER_ID = testUuid(0xa12)
const WATCHER_ID = testUuid(0xa13)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function facingRoom(facing = true) {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: WATCHER_ID, creature: plainWolf })
    ],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: MOVER_START, [WATCHER_ID]: { x: 650, y: 150 } },
    optionalCombatKinds: facing ? ['FACING'] : []
  })
}

type Room = Awaited<ReturnType<typeof facingRoom>>

const tokenIdOf = (actorId: string) => `f${actorId.slice(1)}`

function encounterVersion(room: Room) {
  return runInDurableObject(room.base.stub, async (_instance, context) => {
    const [run] = new RoomEncounterStore(context.storage).documents('encounterRuns')
    if (!run) throw new Error('The room holds no Run.')
    return run.version
  })
}

function feetMoved(room: Room) {
  return runInDurableObject(room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('encounterTurnMovements')
      .reduce((total, { usedFeet }) => total + usedFeet, 0)
  )
}

/** The facing of an actor's token in the Scene the room last synced to the GM. */
function facingOf(room: Room, actorId: string) {
  const sync = [...room.base.messages].reverse().find((message) => message.type === 'STATE_SYNC')
  if (sync?.type !== 'STATE_SYNC' || !sync.state.scene)
    throw new Error('The room has sent the GM no Scene.')
  return sync.state.scene.tokens.find(({ id }) => id === tokenIdOf(actorId))?.rotationDegrees
}

function moveFacing(room: Room, path: readonly ScenePoint[], facingDegrees: number) {
  const commandId = crypto.randomUUID()
  return room.send(commandId, {
    scope: 'SCENE',
    command: {
      type: 'MOVE_SCENE_TOKEN',
      commandId,
      correlationId: null,
      expectedEncounterVersion: room.encounterVersion,
      expectedSceneVersion: room.scene.version,
      movementKind: 'VOLUNTARY',
      path,
      sceneId: room.scene.id,
      tokenId: room.moverTokenId,
      facingDegrees
    }
  })
}

async function encounterCommand(room: Room, command: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  return room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      ...command,
      encounterId: room.encounterId,
      commandId,
      expectedVersion: await encounterVersion(room)
    }
  })
}

const changeFacing = (room: Room, rotationDegrees: number) =>
  encounterCommand(room, {
    type: 'CHANGE_FACING',
    actorId: WATCHER_ID,
    rotationDegrees,
    acknowledgedWarnings: []
  })

describe('Facing (ATTACK-12.T1)', () => {
  it('ends a move in the chosen facing without spending movement on the turn, and the Scene undo turns it back', async () => {
    const room = await facingRoom()

    const moved = await moveFacing(room, [MOVER_START, { x: 250, y: 150 }], 90)

    expect(moved).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVED', rotationDegrees: 90 } } }
    })
    // One 5-ft square walked; the turn costs nothing more.
    expect(await feetMoved(room)).toBe(5)

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
          delta: { kind: 'TOKEN_MOVE_UNDONE', position: MOVER_START, rotationDegrees: 0 }
        }
      }
    })
  })

  it('turns a creature as a reaction without moving it, and the action undo turns it back and returns the reaction', async () => {
    const room = await facingRoom()

    const turned = await changeFacing(room, 180)
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')
    expect(facingOf(room, WATCHER_ID)).toBe(180)
    expect(await feetMoved(room)).toBe(0)

    // Its reaction is spent, so a second turn this round needs the GM's override.
    const again = await changeFacing(room, 90)
    expect(again.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(again)).toContain('RULE_WARNINGS')
    expect(facingOf(room, WATCHER_ID)).toBe(180)

    const reverted = await encounterCommand(room, { type: 'REVERT_LAST_ACTION' })
    expect(reverted.type, JSON.stringify(reverted)).toBe('COMMAND_COMMITTED')
    expect(facingOf(room, WATCHER_ID)).toBe(0)
    expect((await changeFacing(room, 90)).type).toBe('COMMAND_COMMITTED')
    expect(facingOf(room, WATCHER_ID)).toBe(90)
  })

  it('refuses a facing between the rule’s steps, and any facing when the rule is off', async () => {
    const on = await facingRoom()
    for (const refused of [
      await moveFacing(on, [MOVER_START, { x: 250, y: 150 }], 45),
      await changeFacing(on, 45)
    ]) {
      expect(refused.type).toBe('COMMAND_REJECTED')
      expect(JSON.stringify(refused)).toContain('FACING_UNAVAILABLE')
    }
    expect(facingOf(on, MOVER_ID)).toBe(0)

    const off = await facingRoom(false)
    for (const refused of [
      await moveFacing(off, [MOVER_START, { x: 250, y: 150 }], 90),
      await changeFacing(off, 90)
    ]) {
      expect(refused.type).toBe('COMMAND_REJECTED')
      expect(JSON.stringify(refused)).toContain('FACING_UNAVAILABLE')
    }
    expect(await feetMoved(off)).toBe(0)
  })
})

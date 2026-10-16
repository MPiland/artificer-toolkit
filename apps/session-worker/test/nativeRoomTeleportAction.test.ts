import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { mistyStep } from '@artificer-toolkit/source-data/srd/spells/misty-step.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-28.T1b (AC SPELLS-28.2): casting Misty Step grants a bounded one-shot teleport allowance
 * that a following TELEPORT move consumes, with no path and no opportunity attack. A player's
 * TELEPORT without an allowance is refused; the GM's is not. Undo runs the move first, then the cast.
 */

const CHARACTER_ACTOR_ID = testUuid(0x9a0)
const CHARACTER_ID = testUuid(0x9a1)
const WOLF_ID = testUuid(0x9a2)
const START: ScenePoint = { x: 150, y: 150 }
const WOLF_AT: ScenePoint = { x: 250, y: 150 }
/** 5 squares of 5 ft: within Misty Step's 30 ft. */
const IN_RANGE: ScenePoint = { x: 150, y: 650 }
/** 8 squares: 40 ft, out of range. */
const OUT_OF_RANGE: ScenePoint = { x: 150, y: 950 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The player's Character, who knows Misty Step, shares the Scene with a Wolf that reacts to leaving reach. */
function mistyRoom() {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [],
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: reactionWolf })
    ],
    positions: { [CHARACTER_ACTOR_ID]: START, [WOLF_ID]: WOLF_AT },
    characterSpellcasting: { spells: [mistyStep], prepared: [mistyStep.id] },
    characterAction: (action) => action.label.startsWith(mistyStep.label)
  })
}

type Room = Awaited<ReturnType<typeof mistyRoom>>

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

const blocked = (answer: unknown, reason: string) =>
  expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'DOMAIN_REJECTED', reason })

/** The Character's unconsumed teleport allowances, as the GM's Encounter session shows them. */
async function allowances(room: Room) {
  const first = room.room.base.messages.length
  room.room.base.socket.send(
    JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false })
  )
  const state = await vi.waitFor(() => {
    const message = room.room.base.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state
  })
  return state.turnMovement.find(({ actorId }) => actorId === CHARACTER_ACTOR_ID)?.teleport ?? []
}

async function castMistyStep(room: Room) {
  const { answer } = await room.startAction(CHARACTER_ACTOR_ID, [], room.sceneContext(0))
  committed(answer)
}

/** The Character's player teleports it from `from` to `to`, against the Scene version `sceneVersion`. */
async function playerTeleport(
  room: Room,
  to: ScenePoint,
  { from = START, sceneVersion = room.room.scene.version } = {}
) {
  const player = await room.room.asPlayer()
  return player.teleport([from, to], await room.version(), sceneVersion)
}

function undoSceneMove(room: Room, expectedSceneVersion: number) {
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'SCENE',
    command: {
      type: 'UNDO_LAST_SCENE_MOVE',
      commandId,
      expectedSceneVersion,
      sceneId: room.room.scene.id
    }
  })
}

async function revertLastAction(room: Room) {
  const commandId = crypto.randomUUID()
  return room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId,
    expectedVersion: await room.version()
  })
}

describe('the Misty Step teleport (AC SPELLS-28.2)', () => {
  it('refuses a player’s teleport that no cast granted, and leaves the GM’s ungated', async () => {
    const room = await mistyRoom()

    blocked(await playerTeleport(room, IN_RANGE), 'TELEPORT_UNAVAILABLE')

    const gm = await room.room.teleport(
      [START, IN_RANGE],
      await room.version(),
      room.room.scene.version
    )
    committed(gm)
  })

  it('grants a 30 foot allowance on the cast, which the player’s move spends without a reaction', async () => {
    const room = await mistyRoom()
    expect(await allowances(room)).toEqual([])

    await castMistyStep(room)
    expect(await allowances(room)).toEqual([
      expect.objectContaining({ maxFeet: 30, destinationKind: 'VISIBLE' })
    ])

    committed(await playerTeleport(room, IN_RANGE))

    expect(await allowances(room)).toEqual([])
    // The Wolf's reach was left with no path crossed: no reaction waits for a decision.
    expect(await room.room.pending()).toBeNull()
    blocked(
      await playerTeleport(room, START, { from: IN_RANGE, sceneVersion: room.room.scene.version + 1 }),
      'TELEPORT_UNAVAILABLE'
    )
  })

  it('refuses a destination past the range or on another token, and keeps the allowance', async () => {
    const room = await mistyRoom()
    await castMistyStep(room)

    blocked(await playerTeleport(room, OUT_OF_RANGE), 'MOVEMENT_BLOCKED')
    blocked(await playerTeleport(room, WOLF_AT), 'MOVEMENT_BLOCKED')

    expect(await allowances(room)).toHaveLength(1)
    committed(await playerTeleport(room, IN_RANGE))
  })

  it('undoes the move first, then the cast; the cast alone cannot be undone once the move landed', async () => {
    const room = await mistyRoom()
    await castMistyStep(room)
    committed(await playerTeleport(room, IN_RANGE))

    expect(await revertLastAction(room)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE'
    })
    expect(await allowances(room)).toEqual([])

    const undoneMove = await undoSceneMove(room, room.room.scene.version + 1)
    expect(undoneMove).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVE_UNDONE', position: START } } }
    })
    expect(await allowances(room)).toEqual([
      expect.objectContaining({ maxFeet: 30, destinationKind: 'VISIBLE' })
    ])

    committed(await revertLastAction(room))
    expect(await allowances(room)).toEqual([])
    blocked(
      await playerTeleport(room, IN_RANGE, { sceneVersion: room.room.scene.version + 2 }),
      'TELEPORT_UNAVAILABLE'
    )
  })
})

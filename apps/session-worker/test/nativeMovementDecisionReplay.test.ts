import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { movementRoom, type MovementRoomConfig } from './movementRoomFixture.js'

const MOVER_ID = testUuid(0x200)
const REACTOR_ID = testUuid(0x201)
const MOVER_START: ScenePoint = { x: 150, y: 150 }
const EAST = [MOVER_START, { x: 750, y: 150 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof movementRoom>>
type Viewer = Pick<Awaited<ReturnType<typeof connectPlayer>>, 'messages' | 'socket'>

/** A FRIENDLY Wolf whose Bite is an opportunity attack beside a HOSTILE Wolf walking east. */
function reactionRoom(extra: Partial<MovementRoomConfig> = {}) {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    ],
    moverActorId: MOVER_ID,
    positions: { [REACTOR_ID]: { x: 150, y: 50 }, [MOVER_ID]: MOVER_START },
    ...extra
  })
}

/** The one PENDING decision the mover's walk raised, as the answer to it addresses it. */
async function pendingDecision(room: Room) {
  const pending = await room.pending()
  if (!pending) throw new Error('No movement decision is pending.')
  return {
    encounterId: room.encounterId,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrence.id,
    expectedOccurrenceVersion: pending.occurrence.version
  }
}

const answer = (commandId: string, decision: Awaited<ReturnType<typeof pendingDecision>>) => ({
  scope: 'ENCOUNTER',
  command: {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId,
    correlationId: null,
    resolution: { kind: 'DECLINE' },
    ...decision
  }
})

const voided = (commandId: string, decision: Awaited<ReturnType<typeof pendingDecision>>) => ({
  scope: 'ENCOUNTER',
  command: { type: 'VOID_RULE_OCCURRENCE', commandId, ...decision }
})

const committedFor = (viewer: Viewer, commandId: string) =>
  viewer.messages.filter(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )

const scopes = (messages: readonly LiveSessionWebSocketServerMessageDto[]) =>
  messages.map((message) => (message.type === 'COMMAND_COMMITTED' ? message.delta?.scope : null))

/** Sends `command` on the viewer's socket and waits until `total` messages answer its key. */
async function sendCommand(
  viewer: Viewer,
  commandId: string,
  command: Record<string, unknown>,
  total: number
) {
  viewer.socket.send(JSON.stringify({ type: 'COMMAND', expectedSessionSequence: 0, command }))
  await vi.waitFor(() => expect(committedFor(viewer, commandId)).toHaveLength(total))
  return committedFor(viewer, commandId)
}

/** What a retry shows of a message live sent: a Scene result carries the replay mark. */
function asReplay(message: LiveSessionWebSocketServerMessageDto | undefined) {
  if (message?.type !== 'COMMAND_COMMITTED') throw new Error('Expected a committed command.')
  const { delta } = message
  return delta?.scope === 'SCENE'
    ? { ...message, delta: { ...delta, result: { ...delta.result, replayed: true } } }
    : message
}

const gm = (room: Room): Viewer => room.base

it('replays the Scene receipt and the Encounter result of a player answer, in the order live sent them', async () => {
  const room = await reactionRoom({ playerControlledActorIds: [REACTOR_ID] })
  const player = await connectPlayer(room.base)
  await room.move(EAST)
  const commandId = crypto.randomUUID()
  const command = answer(commandId, await pendingDecision(room))

  const live = await sendCommand(player, commandId, command, 2)
  const replay = (await sendCommand(player, commandId, command, 4)).slice(2)

  expect(scopes(live)).toEqual(['SCENE', 'ENCOUNTER'])
  expect(scopes(replay)).toEqual(scopes(live))
  expect(replay).toEqual(live.map(asReplay))
})

it('replays both messages of a GM void of a movement decision', async () => {
  const room = await reactionRoom()
  await room.move(EAST)
  const commandId = crypto.randomUUID()
  const command = voided(commandId, await pendingDecision(room))

  const live = await sendCommand(gm(room), commandId, command, 2)
  const replay = (await sendCommand(gm(room), commandId, command, 4)).slice(2)

  expect(scopes(live)).toEqual(['SCENE', 'ENCOUNTER'])
  expect(scopes(replay)).toEqual(scopes(live))
  expect(replay).toEqual(live.map(asReplay))
})

it('replays a hidden mover to a player as live projected it, never as the GM saw it', async () => {
  const room = await reactionRoom({
    hiddenActorIds: [MOVER_ID],
    playerControlledActorIds: [REACTOR_ID]
  })
  const player = await connectPlayer(room.base)
  await room.move(EAST)
  const commandId = crypto.randomUUID()
  const command = answer(commandId, await pendingDecision(room))

  const live = await sendCommand(player, commandId, command, 2)
  const replay = (await sendCommand(player, commandId, command, 4)).slice(2)

  // The GM sees the walk; the player is told only that the Scene advanced.
  expect(scopes(committedFor(gm(room), commandId))).toContain('SCENE')
  expect(scopes(live)).toEqual(['SCENE_VERSION', 'ENCOUNTER'])
  expect(replay).toEqual(live.map(asReplay))
  expect(JSON.stringify(replay)).not.toContain(room.moverTokenId)
})

it('replays a Scene command in an Encounter room as the one message its sender was sent', async () => {
  const room = await reactionRoom()
  const commandId = crypto.randomUUID()
  const command = {
    scope: 'SCENE',
    command: {
      type: 'MOVE_SCENE_TOKEN',
      commandId,
      correlationId: null,
      expectedEncounterVersion: room.encounterVersion,
      expectedSceneVersion: room.scene.version,
      movementKind: 'VOLUNTARY',
      path: EAST,
      sceneId: room.scene.id,
      tokenId: room.moverTokenId
    }
  }

  const live = await sendCommand(gm(room), commandId, command, 1)
  const replay = (await sendCommand(gm(room), commandId, command, 2)).slice(1)

  expect(scopes(live)).toEqual(['SCENE'])
  expect(replay).toEqual(live.map(asReplay))
})

it('refuses a retry that changes the payload under the same key, as before', async () => {
  const room = await reactionRoom({ playerControlledActorIds: [REACTOR_ID] })
  const player = await connectPlayer(room.base)
  await room.move(EAST)
  const commandId = crypto.randomUUID()
  const decision = await pendingDecision(room)
  const live = await sendCommand(player, commandId, answer(commandId, decision), 2)
  const first = player.messages.length

  player.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: answer(commandId, { ...decision, expectedOccurrenceVersion: 99 })
    })
  )

  await vi.waitFor(() =>
    expect(player.messages.slice(first)).toContainEqual(
      expect.objectContaining({
        type: 'COMMAND_REJECTED',
        commandId,
        code: 'INVALID_COMMAND',
        message: 'The command ID was already used for different input.'
      })
    )
  )
  expect(committedFor(player, commandId)).toEqual(live)
})

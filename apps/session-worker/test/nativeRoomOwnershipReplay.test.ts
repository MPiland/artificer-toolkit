import { SELF } from 'cloudflare:test'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets, secret, signTicket, trackSocket } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

const MOVER_ID = testUuid(0x200)
const REACTOR_ID = testUuid(0x201)
const MOVER_START: ScenePoint = { x: 150, y: 150 }
const EAST = [MOVER_START, { x: 750, y: 150 }]
/** What only the GM projection of an actor carries (ADR 0034 decision 1). */
const GM_ONLY_ACTOR_FIELDS = ['currentHitPoints', 'features', 'gmNotes', 'resources', 'statBlock']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

/** A FRIENDLY Wolf whose Bite is an opportunity attack beside a HOSTILE Wolf walking east. */
const reactionRoom = () =>
  movementRoom({
    actors: [
      srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    ],
    moverActorId: MOVER_ID,
    positions: { [REACTOR_ID]: { x: 150, y: 50 }, [MOVER_ID]: MOVER_START }
  })

function waitForClose(socket: WebSocket): Promise<CloseEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for WebSocket closure.')),
      5_000
    )
    socket.addEventListener(
      'close',
      (event) => {
        clearTimeout(timeout)
        resolve(event)
      },
      { once: true }
    )
  })
}

/**
 * Hands the Campaign to `ownerId` as Convex does: every membership gets a new epoch, the Campaign
 * scope revision moves, and the room is told through the `INVALIDATE_INPUTS` notice it is sent.
 */
async function transferOwnership(room: Room, ownerId: string, formerOwnerId: string) {
  const { base } = room
  const membershipEpoch = new Date(Date.parse(base.capture.origin.membershipEpoch) + 1).toISOString()
  base.authorization.members = [
    { membershipEpoch, role: 'OWNER', userId: ownerId },
    { membershipEpoch, role: 'PLAYER', userId: formerOwnerId }
  ]
  base.capture.origin = { ...base.capture.origin, membershipEpoch }
  room.campaignRevision.current = crypto.randomUUID()
  const response = await SELF.fetch(`https://session.test${LIVE_SESSION_CONTROL_PATH}`, {
    body: JSON.stringify({
      campaignId: base.capture.campaignId,
      operation: { type: 'INVALIDATE_INPUTS', scopes: ['CAMPAIGN'] }
    }),
    headers: { 'content-type': 'application/json', [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret },
    method: 'POST'
  })
  expect(response.ok).toBe(true)
}

/** A fresh socket for `userId` in `role`, admitted on the room's current membership. */
async function reconnect(
  room: Room,
  member: { userId: string; role: 'OWNER' | 'PLAYER'; accessToken: string }
) {
  const { base } = room
  const response = await base.stub.fetch(
    base.request(
      await signTicket({
        authorityEpoch: base.authorityEpoch,
        campaignId: base.capture.campaignId,
        issuedAt: base.issuedAt,
        role: member.role,
        subject: member.userId
      })
    )
  )
  const socket = response.webSocket
  if (!socket) throw new Error('Missing reconnected WebSocket.')
  trackSocket(socket)
  const messages: LiveSessionWebSocketServerMessageDto[] = []
  socket.addEventListener('message', (event) => {
    messages.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data))))
  })
  socket.accept()
  socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: member.accessToken }))
  await vi.waitFor(() =>
    expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  return { messages, socket }
}

/** Sends `command` and waits for the Scene receipt and the Encounter result that answer it. */
async function sendUntilEncounterResult(
  viewer: { messages: LiveSessionWebSocketServerMessageDto[]; socket: WebSocket },
  commandId: string,
  command: Record<string, unknown>
) {
  const first = viewer.messages.length
  viewer.socket.send(JSON.stringify({ type: 'COMMAND', expectedSessionSequence: 0, command }))
  return vi.waitFor(() => {
    const answered = viewer.messages
      .slice(first)
      .flatMap((message) =>
        message.type === 'COMMAND_COMMITTED' &&
        message.commandId === commandId &&
        message.delta?.scope === 'ENCOUNTER'
          ? [message.delta.result]
          : []
      )
    if (!answered[0]) throw new Error('The room has not answered with an Encounter result.')
    return answered[0]
  })
}

/** The room's GM voids the one PENDING movement decision the mover's walk raised. */
async function gmVoidsMovementDecision(room: Room) {
  await room.move(EAST)
  const pending = await room.pending()
  if (!pending) throw new Error('No movement decision is pending.')
  const commandId = crypto.randomUUID()
  const command = {
    scope: 'ENCOUNTER',
    command: {
      type: 'VOID_RULE_OCCURRENCE',
      commandId,
      encounterId: room.encounterId,
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrence.id,
      expectedOccurrenceVersion: pending.occurrence.version
    }
  }
  const live = await sendUntilEncounterResult(room.base, commandId, command)
  return { command, commandId, live }
}

it('presents a replay to the issuer as GM once the room has the notice that returned ownership', async () => {
  const room = await reactionRoom()
  const { base } = room
  const { command, commandId, live } = await gmVoidsMovementDecision(room)
  for (const actor of live.projection.actors)
    expect(Object.keys(actor)).toEqual(expect.arrayContaining(GM_ONLY_ACTOR_FIELDS))

  const departed = waitForClose(base.socket)
  await transferOwnership(room, base.playerId, base.userId)
  await expect(departed).resolves.toMatchObject({ reason: 'Campaign access ended.' })
  await transferOwnership(room, base.userId, base.playerId)

  const owner = await reconnect(room, {
    userId: base.userId,
    role: 'OWNER',
    accessToken: base.accessToken
  })
  const replay = await sendUntilEncounterResult(owner, commandId, command)

  expect(replay.projection).toEqual(live.projection)
})

it('presents a replay to a former owner as the redacted player projection once the room has the notice', async () => {
  const room = await reactionRoom()
  const { base } = room
  const { command, commandId, live } = await gmVoidsMovementDecision(room)

  const departed = waitForClose(base.socket)
  await transferOwnership(room, base.playerId, base.userId)
  await expect(departed).resolves.toMatchObject({ reason: 'Campaign access ended.' })

  const former = await reconnect(room, {
    userId: base.userId,
    role: 'PLAYER',
    accessToken: base.accessToken
  })
  const replay = await sendUntilEncounterResult(former, commandId, command)

  expect(replay.projection.id).toBe(live.projection.id)
  expect(replay.projection.actors.length).toBeGreaterThan(0)
  for (const actor of replay.projection.actors)
    for (const field of GM_ONLY_ACTOR_FIELDS) expect(Object.keys(actor)).not.toContain(field)
})

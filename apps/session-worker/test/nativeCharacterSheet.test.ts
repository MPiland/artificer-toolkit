import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  liveSessionActivationInputSchema,
  liveSessionBootstrapInputSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import { liveRoomInputsInputSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  liveSessionTransientCaptureInputSchema,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { characterSheetInputsFixture } from './characterSheetInputsFixture.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import { ROOM_INPUTS_PATH, roomInputsResponse } from './roomInputsFixture.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const sockets: WebSocket[] = []
const activationFingerprint = 'a'.repeat(64)

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
  vi.restoreAllMocks()
})

type Role = 'OWNER' | 'PLAYER'

function signAccessToken(subject: string, issuedAt: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setExpirationTime(issuedAt + 3_600)
    .sign(new TextEncoder().encode(secret))
}

/**
 * A native room whose Character, content, System and Run reads are the real inputs of
 * `characterSheetInputsFixture`; only Convex's transport is replaced. The GM opens the room, the
 * assigned player owns the Character and a second player holds no assignment.
 */
async function sheetRoom() {
  const campaignId = crypto.randomUUID()
  const characterId = crypto.randomUUID()
  const authorityEpoch = crypto.randomUUID()
  const issuedAt = Math.floor(Date.now() / 1_000)
  const gmId = crypto.randomUUID()
  const ownerId = crypto.randomUUID()
  const strangerId = crypto.randomUUID()
  const membershipEpoch = new Date().toISOString()
  const members = [
    { membershipEpoch, role: 'OWNER' as const, userId: gmId },
    { membershipEpoch, role: 'PLAYER' as const, userId: ownerId },
    { membershipEpoch, role: 'PLAYER' as const, userId: strangerId }
  ]
  const assignments = [{ characterId, userId: ownerId }]
  const inputs = await characterSheetInputsFixture({
    campaignId,
    characterId,
    ownerUserId: ownerId
  })
  const accessTokens = new Map(
    await Promise.all(
      members.map(
        async ({ userId }) => [userId, await signAccessToken(userId, issuedAt)] as [string, string]
      )
    )
  )
  const capture: LiveSessionTransientCapture = {
    campaignId,
    systemId: inputs.systemId,
    observedCharacterRevisions: [],
    origin: { membershipEpoch, role: 'OWNER', userId: gmId },
    presentation: null,
    recipients: [],
    sceneEncounterId: null,
    originBoundTokenControl: [],
    sceneHeader: null,
    sceneSnapshot: null,
    visionFreshness: null
  }
  const stub = env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(campaignId))
  let currentEpoch = authorityEpoch
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
      if (pathname === ROOM_INPUTS_PATH) {
        const body = liveRoomInputsInputSchema.parse(await request.json())
        return Response.json(
          roomInputsResponse(body.scope, {
            campaignId,
            systemId: inputs.systemId,
            ownerUserId: gmId,
            members,
            assignments,
            characterInputs: inputs.characterInputs
          })
        )
      }
      if (pathname === ROOM_AUTHORIZATION_PATH)
        return Response.json(
          roomAuthorizationResponse({
            members,
            assignments,
            characterRevisions: [{ characterId, revision: inputs.characterRevision }],
            play: {
              encounter: {
                encounterId: inputs.encounterId,
                sceneId: crypto.randomUUID(),
                healthDisplayDefault: 'HIDDEN',
                actors: [
                  {
                    id: inputs.actorId,
                    kind: 'CHARACTER',
                    sourceId: characterId,
                    controllerUserIds: [],
                    healthDisplay: null
                  }
                ],
                tokens: []
              }
            }
          })
        )
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        expect(request.headers.get('authorization')).toBe(
          `Bearer ${accessTokens.get(body.expectedUserId)}`
        )
        return Response.json({
          ...capture,
          origin: { membershipEpoch, role: body.expectedRole, userId: body.expectedUserId }
        })
      }
      if (pathname === '/live-sessions/bootstrap') {
        const body = liveSessionBootstrapInputSchema.parse(await request.json())
        currentEpoch = body.authorityEpoch
        return Response.json({
          activationFingerprint,
          persistedSequence: 0,
          persistedStateChecksum: activationFingerprint
        })
      }
      if (pathname === '/live-sessions/activate') {
        const body = liveSessionActivationInputSchema.parse(await request.json())
        const now = new Date().toISOString()
        return Response.json({
          activationFingerprint,
          campaignId,
          createdAt: now,
          epoch: currentEpoch,
          persistedSequence: 0,
          persistedStateChecksum: body.stateChecksum,
          phase: 'DO_ACTIVE',
          updatedAt: now
        })
      }
      throw new Error(`Unexpected native request: ${pathname}`)
    })
  })

  async function connect(userId: string, role: Role) {
    const ticket = await new SignJWT({
      authorityEpoch,
      campaignId,
      role,
      v: LIVE_SESSION_TICKET_VERSION
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(LIVE_SESSION_TICKET_ISSUER)
      .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
      .setSubject(userId)
      .setJti(crypto.randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 60)
      .sign(new TextEncoder().encode(secret))
    const response = await stub.fetch(
      new Request(`https://session.test/live-session/${campaignId}`, {
        headers: { upgrade: 'websocket', 'x-artificer-live-session-ticket': ticket }
      })
    )
    const socket = response.webSocket
    if (!socket) throw new Error('Missing native test WebSocket.')
    sockets.push(socket)
    const messages: LiveSessionWebSocketServerMessageDto[] = []
    socket.addEventListener('message', (event) => {
      messages.push(
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data)))
      )
    })
    socket.accept()
    socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: accessTokens.get(userId) }))
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
    )
    return { messages, socket }
  }

  const gm = await connect(gmId, 'OWNER')
  const owner = await connect(ownerId, 'PLAYER')
  const stranger = await connect(strangerId, 'PLAYER')

  /** One Sheet command from a member; resolves with the room's reply to that command ID. */
  async function play(
    member: Awaited<ReturnType<typeof connect>>,
    command: { type: 'ADJUST_HIT_POINTS'; mode: 'DAMAGE' | 'HEAL'; amount: number },
    commandId: string,
    expectedVersion: number
  ) {
    member.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'CHARACTER_SHEET',
          characterId,
          encounterId: inputs.encounterId,
          command: { ...command, commandId, expectedVersion }
        }
      })
    )
    await vi.waitFor(() =>
      expect(
        member.messages.filter(
          (message) =>
            (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
            message.commandId === commandId
        )
      ).not.toHaveLength(0)
    )
    return member.messages.filter(
      (message) =>
        (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
        message.commandId === commandId
    )
  }

  const hitPoints = () =>
    runInDurableObject(stub, (_instance, state) => {
      const row = new RoomEncounterStore(state.storage)
        .documents('characterPlayStates')
        .find((play) => play.characterId === characterId)
      if (!row) throw new Error('Missing room Character play state.')
      return { current: readCharacterPlay(row).hitpoints.current, streamVersion: row.streamVersion }
    })

  return { gm, gmId, owner, stranger, play, hitPoints, characterId, stub, ...inputs }
}

it('plays a Character Sheet command through the room with the real Character rules path', async () => {
  const room = await sheetRoom()
  expect(await room.hitPoints()).toEqual({ current: 11, streamVersion: 1 })
  const commandId = crypto.randomUUID()

  const [committed] = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    commandId,
    1
  )
  if (committed?.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(committed))
  expect(committed.delta).toMatchObject({
    scope: 'CHARACTER_SHEET',
    result: {
      streamVersion: 2,
      historyEntry: { eventType: 'ADJUST_HIT_POINTS' }
    }
  })
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })

  // The GM advances the same sequence without the Character's private history.
  await vi.waitFor(() =>
    expect(
      room.gm.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toEqual([{ type: 'COMMAND_COMMITTED', commandId, delta: null, sequence: committed.sequence }])
  )
  await vi.waitFor(() =>
    expect(
      room.stranger.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toEqual([{ type: 'COMMAND_COMMITTED', commandId, delta: null, sequence: committed.sequence }])
  )

  // An exact retry returns the stored result and does not play the command again.
  const retried = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    commandId,
    1
  )
  expect(retried.at(-1)).toEqual(committed)
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
})

it("commits a GM Encounter actor's Sheet command on the held Character with its receipt (D78)", async () => {
  const room = await sheetRoom()
  const commandId = crypto.randomUUID()
  const sheetCommandId = crypto.randomUUID()
  // The room's fetch stub throws for every Convex Encounter route, so a commit is room-native.
  room.gm.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: room.encounterId,
          commandId,
          expectedVersion: 1,
          actorId: room.actorId,
          characterCommand: {
            type: 'ADJUST_HIT_POINTS',
            commandId: sheetCommandId,
            expectedVersion: 1,
            mode: 'DAMAGE',
            amount: 3
          }
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      room.gm.messages.find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === commandId
      )
    ).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { scope: 'ENCOUNTER', result: { projection: { version: 2 } } }
    })
  )
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
  const evidence = await runInDurableObject(room.stub, (_instance, state) => {
    const store = new RoomEncounterStore(state.storage)
    return {
      receipts: store.documents('characterCommandReceipts'),
      commands: store.documents('encounterRunCommands')
    }
  })
  expect(evidence.receipts).toEqual([
    expect.objectContaining({
      characterId: room.characterId,
      commandId: sheetCommandId,
      actorId: room.gmId
    })
  ])
  expect(evidence.commands).toEqual([
    expect.objectContaining({
      commandId,
      commandType: 'UPDATE_ACTOR',
      characterReceiptId: evidence.receipts[0]!.id
    })
  ])
})

it('refuses a Sheet command from a player who does not own the Character', async () => {
  const room = await sheetRoom()
  const commandId = crypto.randomUUID()

  const [rejected] = await room.play(
    room.stranger,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    commandId,
    1
  )

  expect(rejected).toMatchObject({
    type: 'COMMAND_REJECTED',
    code: 'DOMAIN_REJECTED',
    commandId,
    message: 'Assigned Character not found.'
  })
  expect(await room.hitPoints()).toEqual({ current: 11, streamVersion: 1 })
})

import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionExecutorRequestDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { EncounterSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { afterEach, assert, it, vi } from 'vitest'

import { LiveSessionRoomJournal } from '../src/roomJournal.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const campaignId = '00000000-0000-4000-8000-000000000101'
const sessionId = '00000000-0000-4000-8000-000000000102'
const userId = '00000000-0000-4000-8000-000000000103'
const ticketId = '00000000-0000-4000-8000-000000000104'
const encounterId = '00000000-0000-4000-8000-000000000105'
const sceneId = '00000000-0000-4000-8000-000000000106'
const definitionId = '00000000-0000-4000-8000-000000000107'
const tokenId = '00000000-0000-4000-8000-000000000108'
const mapAssetId = '00000000-0000-4000-8000-000000000109'
const commandId = '00000000-0000-4000-8000-000000000110'
const laterCommandId = '00000000-0000-4000-8000-000000000111'
const attachCommandId = '00000000-0000-4000-8000-000000000112'
const attachSessionId = '00000000-0000-4000-8000-000000000115'
const multiSessionId = '00000000-0000-4000-8000-000000000116'
const secondTokenId = '00000000-0000-4000-8000-000000000117'
const secondMoveCommandId = '00000000-0000-4000-8000-000000000118'
const actorId = '00000000-0000-4000-8000-000000000119'
const characterId = '00000000-0000-4000-8000-000000000120'
const privacySessionId = '00000000-0000-4000-8000-000000000123'
const gmUserId = '00000000-0000-4000-8000-000000000124'
const foggedUserId = '00000000-0000-4000-8000-000000000125'
const privacyCommandId = '00000000-0000-4000-8000-000000000126'
const leaseSessionId = '00000000-0000-4000-8000-000000000132'
const terminalSessionId = '00000000-0000-4000-8000-000000000133'
const retryableCommandId = '00000000-0000-4000-8000-000000000134'
const reauthorizationSessionId = '00000000-0000-4000-8000-000000000141'
const staleOwnerUserId = '00000000-0000-4000-8000-000000000142'
const removedPlayerUserId = '00000000-0000-4000-8000-000000000143'
const retainedPlayerUserId = '00000000-0000-4000-8000-000000000144'
const overdueLeaseSessionId = '00000000-0000-4000-8000-000000000145'
const overdueLeaseCommandId = '00000000-0000-4000-8000-000000000146'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function issueTicket(
  jti = ticketId,
  ticketSessionId = sessionId,
  role: 'OWNER' | 'PLAYER' = 'OWNER',
  subject = userId
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1_000)
  return new SignJWT({
    campaignId,
    role,
    sessionId: ticketSessionId,
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setExpirationTime(issuedAt + 60)
    .setIssuedAt(issuedAt)
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setJti(jti)
    .setSubject(subject)
    .sign(new TextEncoder().encode(secret))
}

function sceneState(version: number, tokenX: number): EncounterSceneStateDto {
  return {
    annotations: [],
    barriers: [],
    campaignId,
    darknessZones: [],
    definitionId,
    definitionVersion: 1,
    doorStates: {},
    encounterId,
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
    id: sceneId,
    lights: [],
    map: { assetId: mapAssetId, height: 100, tileManifestAssetId: null, width: 100 },
    measurements: [],
    name: 'Worker test scene',
    tokens: [
      {
        actorId,
        assetId: null,
        controlledByUserIds: [userId],
        height: 1,
        hidden: false,
        id: tokenId,
        label: 'Hero',
        locked: false,
        position: { x: tokenX, y: 20 },
        rotationDegrees: 0,
        vision: null,
        width: 1
      }
    ],
    version,
    visionRevealMode: 'ON_DRAG'
  }
}

function multiTokenSceneState(
  version: number,
  firstTokenX: number,
  secondTokenX: number,
  firstTokenControllerId = userId,
  secondTokenControllerId = userId
): EncounterSceneStateDto {
  const state = sceneState(version, firstTokenX)
  return {
    ...state,
    annotations: [
      {
        id: '00000000-0000-4000-8000-000000000121',
        position: { x: 15, y: 15 },
        text: 'GM-only annotation',
        visibility: 'GM_ONLY'
      }
    ],
    fogMode: 'PER_PLAYER',
    tokens: [
      { ...state.tokens[0]!, controlledByUserIds: [firstTokenControllerId] },
      {
        ...state.tokens[0]!,
        controlledByUserIds: [secondTokenControllerId],
        id: secondTokenId,
        label: 'Companion',
        position: { x: secondTokenX, y: 40 }
      },
      {
        ...state.tokens[0]!,
        controlledByUserIds: [firstTokenControllerId],
        hidden: true,
        id: '00000000-0000-4000-8000-000000000122',
        label: 'Hidden owner token',
        position: { x: 10, y: 10 }
      }
    ]
  }
}

function sceneMoveCommand(
  id: string,
  expectedSceneVersion: number,
  tokenX: number
): LiveSessionCommandDto {
  return {
    aggregateKind: 'SCENE',
    command: {
      commandId: id,
      encounterId,
      expectedSceneVersion,
      path: [
        { x: tokenX - 5, y: 20 },
        { x: tokenX, y: 20 }
      ],
      sceneId,
      tokenId,
      type: 'MOVE_SCENE_TOKEN'
    }
  }
}

function waitForMessage(socket: WebSocket): Promise<LiveSessionWebSocketServerMessageDto> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for WebSocket message.')),
      5_000
    )
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timeout)
        try {
          resolve(
            liveSessionWebSocketServerMessageDtoSchema.parse(
              JSON.parse(typeof event.data === 'string' ? event.data : '') as unknown
            )
          )
        } catch (error) {
          reject(error)
        }
      },
      { once: true }
    )
  })
}

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

function waitForMessages(
  socket: WebSocket,
  count: number
): Promise<LiveSessionWebSocketServerMessageDto[]> {
  return new Promise((resolve, reject) => {
    const messages: LiveSessionWebSocketServerMessageDto[] = []
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${count} WebSocket messages.`)),
      5_000
    )
    const onMessage = (event: MessageEvent) => {
      try {
        messages.push(
          liveSessionWebSocketServerMessageDtoSchema.parse(
            JSON.parse(typeof event.data === 'string' ? event.data : '') as unknown
          )
        )
        if (messages.length !== count) return
        clearTimeout(timeout)
        socket.removeEventListener('message', onMessage)
        resolve(messages)
      } catch (error) {
        clearTimeout(timeout)
        socket.removeEventListener('message', onMessage)
        reject(error)
      }
    }
    socket.addEventListener('message', onMessage)
  })
}

async function expectNoMessage(
  socket: WebSocket,
  timeoutMs = 100,
  ignoredTypes: readonly string[] = []
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, timeoutMs)
    const onMessage = (event: MessageEvent) => {
      if (
        typeof event.data === 'string' &&
        ignoredTypes.includes((JSON.parse(event.data) as { type?: string }).type ?? '')
      ) {
        return
      }
      cleanup()
      reject(new Error(`Unexpected WebSocket message: ${String(event.data)}`))
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.removeEventListener('message', onMessage)
    }
    socket.addEventListener('message', onMessage)
  })
}

function within<T>(label: string, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Timed out during ${label}.`)), 5_000)
    })
  ])
}

async function waitForJournalIdle(stub: DurableObjectStub): Promise<void> {
  await within(
    'live-session journal idle check',
    (async () => {
      for (;;) {
        const active = await runInDurableObject(
          stub,
          (_instance, state) =>
            state.storage.sql
              .exec<{ count: number }>(
                `SELECT COUNT(*) AS count
               FROM command_inbox
               WHERE status IN ('PENDING', 'EXECUTING', 'COMPLETED')`
              )
              .one().count
        )
        if (active === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
          return
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 5))
      }
    })()
  )
}

async function prepareForHibernationEviction(stub: DurableObjectStub): Promise<void> {
  await waitForJournalIdle(stub)
  await runInDurableObject(stub, async (_instance, state) => {
    // Miniflare treats a scheduled alarm as an active test reference. Production hibernation
    // preserves it; deleting it here lets eviction exercise constructor reconstruction instead.
    await state.storage.deleteAlarm()
  })
}

async function waitForNoServerSockets(stub: DurableObjectStub): Promise<void> {
  await within(
    'live-session socket close',
    (async () => {
      for (;;) {
        const count = await runInDurableObject(
          stub,
          (_instance, state) => state.getWebSockets().length
        )
        if (count === 0) return
        await new Promise<void>((resolve) => setTimeout(resolve, 5))
      }
    })()
  )
}

async function connect(
  stub: DurableObjectStub,
  ticket: string,
  requestedSessionId = sessionId
): Promise<{
  ready: Promise<LiveSessionWebSocketServerMessageDto>
  response: Response
  socket: WebSocket
}> {
  const response = await stub.fetch(
    new Request(`https://session.test/live-session/${requestedSessionId}`, {
      headers: {
        'x-artificer-live-session-ticket': ticket,
        upgrade: 'websocket'
      }
    })
  )
  const socket = response.webSocket
  assert(socket !== null)
  const ready = waitForMessage(socket)
  socket.accept()
  return { ready, response, socket }
}

it('rejects disallowed origins and tickets for a different session before room admission', async ({
  expect
}) => {
  const ticket = await issueTicket('00000000-0000-4000-8000-000000000113')
  const protocols = `${LIVE_SESSION_WEBSOCKET_PROTOCOL}, artificer.ticket.${ticket}`
  const missingOrigin = await exports.default.fetch(
    new Request(`https://session.test/live-session/${sessionId}`, {
      headers: {
        'sec-websocket-protocol': protocols,
        upgrade: 'websocket'
      }
    })
  )
  expect(missingOrigin.status).toBe(403)
  expect(await missingOrigin.text()).toBe('WebSocket origin is not allowed.')

  const disallowedOrigin = await exports.default.fetch(
    new Request(`https://session.test/live-session/${sessionId}`, {
      headers: {
        origin: 'https://evil.test',
        'sec-websocket-protocol': protocols,
        upgrade: 'websocket'
      }
    })
  )
  expect(disallowedOrigin.status).toBe(403)
  expect(await disallowedOrigin.text()).toBe('WebSocket origin is not allowed.')

  const wrongSession = await exports.default.fetch(
    new Request('https://session.test/live-session/00000000-0000-4000-8000-000000000999', {
      headers: {
        origin: 'https://app.test',
        'sec-websocket-protocol': protocols,
        upgrade: 'websocket'
      }
    })
  )
  expect(wrongSession.status).toBe(403)
  expect(await wrongSession.text()).toBe('Live-session ticket does not match the requested room.')
})

it('persists room identity and hibernates an authenticated socket across eviction', async ({
  expect
}) => {
  const operations: LiveSessionExecutorRequestDto['operation'][] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    expect(request.url).toBe('https://executor.test/command')
    expect(request.headers.get('authorization')).toBe(`Bearer ${secret}`)
    const body = JSON.parse(await request.text()) as LiveSessionExecutorRequestDto
    operations.push(body.operation)

    if (body.operation === 'CLAIM') {
      return Response.json({ ok: true, operation: 'CLAIM' })
    }
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [{ characterId, dimRange: { amount: 60, unit: 'FEET' } }],
          encounterCharacterBindings: [{ actorId, characterId, encounterId }],
          sceneStates: [sceneState(0, 20)]
        }
      })
    }
    if (body.operation === 'COMMAND') {
      if (body.command.aggregateKind !== 'SCENE') {
        throw new Error('Expected a Scene command.')
      }
      const requestedCommand = body.command.command
      const next =
        requestedCommand.commandId === commandId
          ? { expectedVersion: 0, tokenX: 25, version: 1 }
          : requestedCommand.commandId === laterCommandId
            ? { expectedVersion: 1, tokenX: 30, version: 2 }
            : null
      if (!next) throw new Error('Unexpected Scene command ID.')
      expect(body.command).toEqual(
        sceneMoveCommand(requestedCommand.commandId, next.expectedVersion, next.tokenX)
      )
      expect(body.sceneVisionContext).toEqual({
        characterVisions: [{ characterId, dimRange: { amount: 60, unit: 'FEET' } }],
        encounterCharacterBindings: [{ actorId, characterId, encounterId }]
      })
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId: requestedCommand.commandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: {
            commandId: requestedCommand.commandId,
            delta: {
              kind: 'TOKEN_MOVED',
              position: { x: next.tokenX, y: 20 },
              tokenId
            },
            replayed: false,
            sceneId,
            version: next.version
          },
          state: sceneState(next.version, next.tokenX),
          version: next.version
        },
        operation: 'COMMAND'
      })
    }
    throw new Error('Unexpected executor operation.')
  })

  const ticket = await issueTicket()
  const objectId = env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${sessionId}`)
  const stub = env.LIVE_SESSION_ROOMS.get(objectId)
  const { ready, response, socket } = await connect(stub, ticket)
  expect(response.status).toBe(101)
  expect(response.headers.get('sec-websocket-protocol')).toBe(LIVE_SESSION_WEBSOCKET_PROTOCOL)
  const initialReady = await ready
  expect(initialReady.type).toBe('READY')
  if (initialReady.type !== 'READY') throw new Error('Expected the initial room snapshot.')
  expect(initialReady.aggregateVersions).toEqual([
    { aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }
  ])
  expect(initialReady.deliverySequence).toBe(0)
  expect(initialReady.sceneSnapshots[0]?.scene.tokens[0]?.position).toEqual({ x: 20, y: 20 })
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT'])

  const command = sceneMoveCommand(commandId, 0, 25)
  const commandMessages = waitForMessages(socket, 2)
  socket.send(JSON.stringify({ command, type: 'COMMAND' }))
  expect(await commandMessages).toEqual([
    { acceptedSequence: 1, commandId, type: 'COMMAND_ACCEPTED' },
    {
      acceptedSequence: 1,
      aggregateId: sceneId,
      aggregateKind: 'SCENE',
      deliverySequence: 1,
      delta: { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId },
      hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
      originCommandId: commandId,
      replayed: false,
      snapshot: null,
      type: 'COMMAND_COMMITTED',
      version: 1
    }
  ])
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'COMMAND'])

  const laterCommand = sceneMoveCommand(laterCommandId, 1, 30)
  const laterMessages = waitForMessages(socket, 2)
  socket.send(JSON.stringify({ command: laterCommand, type: 'COMMAND' }))
  expect(await laterMessages).toEqual([
    { acceptedSequence: 2, commandId: laterCommandId, type: 'COMMAND_ACCEPTED' },
    {
      acceptedSequence: 2,
      aggregateId: sceneId,
      aggregateKind: 'SCENE',
      deliverySequence: 2,
      delta: { kind: 'TOKEN_MOVED', position: { x: 30, y: 20 }, tokenId },
      hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
      originCommandId: laterCommandId,
      replayed: false,
      snapshot: null,
      type: 'COMMAND_COMMITTED',
      version: 2
    }
  ])

  const delayedReplay = waitForMessages(socket, 2)
  socket.send(JSON.stringify({ command, type: 'COMMAND' }))
  const replayMessages = await delayedReplay
  expect(replayMessages[0]).toEqual({
    acceptedSequence: 1,
    commandId,
    type: 'COMMAND_ACCEPTED'
  })
  expect(replayMessages[1]).toMatchObject({
    acceptedSequence: 1,
    aggregateId: sceneId,
    aggregateKind: 'SCENE',
    deliverySequence: 1,
    delta: null,
    hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
    originCommandId: commandId,
    replayed: true,
    snapshot: { scene: { version: 2 } },
    type: 'COMMAND_COMMITTED',
    version: 1
  })
  if (
    replayMessages[1]?.type === 'COMMAND_COMMITTED' &&
    replayMessages[1].aggregateKind === 'SCENE'
  ) {
    expect(replayMessages[1].snapshot?.scene.tokens[0]?.position).toEqual({ x: 30, y: 20 })
  }
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'COMMAND', 'COMMAND'])

  const duplicate = await within(
    'duplicate ticket check',
    stub.fetch(
      new Request(`https://session.test/live-session/${sessionId}`, {
        headers: {
          'x-artificer-live-session-ticket': ticket,
          upgrade: 'websocket'
        }
      })
    )
  )
  expect(duplicate.status).toBe(409)
  expect(await duplicate.text()).toBe('Live-session ticket was already used.')

  expect(
    await within(
      'SQLite inspection',
      runInDurableObject(stub, (_instance, state) =>
        state.storage.sql
          .exec<{ delivery_sequence: number; status: string; ticket_count: number }>(
            `SELECT
                 (SELECT COUNT(*) FROM used_tickets) AS ticket_count,
                 delivery_sequence,
                 status
               FROM command_inbox
               WHERE command_id = ?`,
            laterCommandId
          )
          .one()
      )
    )
  ).toEqual({ delivery_sequence: 2, status: 'COMMITTED', ticket_count: 1 })

  await prepareForHibernationEviction(stub)
  await evictDurableObject(stub)
  const resumed = waitForMessage(socket)
  socket.send(
    JSON.stringify({ lastSeenDeliverySequence: 0, pendingCommandIds: [], type: 'RESUME' })
  )
  const resumedReady = await resumed
  expect(resumedReady.type).toBe('READY')
  if (resumedReady.type !== 'READY') throw new Error('Expected the resumed room snapshot.')
  expect(resumedReady.aggregateVersions).toEqual([
    { aggregateId: sceneId, aggregateKind: 'SCENE', version: 2 }
  ])
  expect(resumedReady.deliverySequence).toBe(2)
  expect(resumedReady.sceneSnapshots[0]?.scene.tokens[0]?.position).toEqual({ x: 30, y: 20 })
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'COMMAND', 'COMMAND'])
  socket.close(1000, 'done')
}, 45_000)

it('attaches a new scene and restores its committed snapshot after hibernation', async ({
  expect
}) => {
  const operations: LiveSessionExecutorRequestDto['operation'][] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const body = JSON.parse(await request.text()) as LiveSessionExecutorRequestDto
    if (body.sessionId !== attachSessionId) {
      if (body.operation === 'RENEW') {
        return Response.json({
          memberships: [{ role: 'OWNER', userId: body.userId }],
          ok: true,
          operation: 'RENEW'
        })
      }
      if (body.operation === 'RELEASE') {
        return Response.json({ ok: true, operation: 'RELEASE' })
      }
      throw new Error(`Unexpected executor request for session ${body.sessionId}.`)
    }
    operations.push(body.operation)

    if (body.operation === 'CLAIM') {
      return Response.json({ ok: true, operation: 'CLAIM' })
    }
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: []
        }
      })
    }
    if (body.operation === 'COMMAND') {
      expect(body.command).toEqual({
        aggregateKind: 'SCENE',
        command: {
          commandId: attachCommandId,
          encounterId,
          sceneDefinitionId: definitionId,
          type: 'ATTACH_SCENE'
        }
      })
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId: attachCommandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: null,
          state: sceneState(0, 20),
          version: 0
        },
        operation: 'COMMAND'
      })
    }
    throw new Error('Unexpected executor operation.')
  })

  const ticket = await issueTicket('00000000-0000-4000-8000-000000000114', attachSessionId)
  const objectId = env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${attachSessionId}`)
  const stub = env.LIVE_SESSION_ROOMS.get(objectId)
  const { ready, socket } = await connect(stub, ticket, attachSessionId)
  await expect(ready).resolves.toMatchObject({
    aggregateVersions: [],
    sceneSnapshots: [],
    type: 'READY'
  })

  const attachMessages = waitForMessages(socket, 2)
  socket.send(
    JSON.stringify({
      command: {
        aggregateKind: 'SCENE',
        command: {
          commandId: attachCommandId,
          encounterId,
          sceneDefinitionId: definitionId,
          type: 'ATTACH_SCENE'
        }
      },
      type: 'COMMAND'
    })
  )
  const [accepted, committed] = await attachMessages
  expect(accepted).toEqual({
    acceptedSequence: 1,
    commandId: attachCommandId,
    type: 'COMMAND_ACCEPTED'
  })
  expect(committed).toMatchObject({
    aggregateId: sceneId,
    aggregateKind: 'SCENE',
    delta: null,
    snapshot: {
      campaignId,
      scene: { id: sceneId, version: 0 },
      sessionId: attachSessionId
    },
    type: 'COMMAND_COMMITTED',
    version: 0
  })
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'COMMAND'])

  await prepareForHibernationEviction(stub)
  await evictDurableObject(stub)
  const resumed = waitForMessage(socket)
  socket.send(
    JSON.stringify({ lastSeenDeliverySequence: 0, pendingCommandIds: [], type: 'RESUME' })
  )
  const resumedReady = await resumed
  expect(resumedReady.type).toBe('READY')
  if (resumedReady.type !== 'READY') throw new Error('Expected the resumed room snapshot.')
  expect(resumedReady.aggregateVersions).toEqual([
    { aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }
  ])
  expect(resumedReady.sceneSnapshots[0]?.scene.id).toBe(sceneId)
  expect(resumedReady.sceneSnapshots[0]?.scene.version).toBe(0)
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'COMMAND'])
  socket.close(1000, 'done')
}, 45_000)

it('keeps resumed receipts and token drag previews private per user and fog view', async ({
  expect
}) => {
  const state = {
    ...sceneState(0, 20),
    barriers: [
      {
        a: { x: 30, y: 0 },
        b: { x: 30, y: 40 },
        blocksLight: true,
        blocksMovement: true,
        id: '00000000-0000-4000-8000-000000000131',
        kind: 'WALL' as const
      }
    ],
    fogLayers: [{ chunks: [], height: 8, ownerUserId: foggedUserId, width: 8 }],
    fogMode: 'PER_PLAYER' as const,
    tokens: sceneState(0, 20).tokens.map((token) => ({
      ...token,
      vision: {
        angleDegrees: 360,
        brightRange: 0,
        dimRange: 10,
        directionDegrees: 0,
        enabled: true
      }
    }))
  }
  const committedState = { ...state, version: 1 }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = JSON.parse(await new Request(input, init).text()) as LiveSessionExecutorRequestDto
    if (body.operation === 'CLAIM') return Response.json({ ok: true, operation: 'CLAIM' })
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: [state]
        }
      })
    }
    if (body.operation === 'COMMAND') {
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId: privacyCommandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: null,
          state: committedState,
          version: 1
        },
        operation: 'COMMAND'
      })
    }
    if (body.operation === 'RENEW') {
      return Response.json({
        memberships: [
          { role: 'OWNER', userId },
          { role: 'OWNER', userId: gmUserId },
          { role: 'PLAYER', userId: foggedUserId }
        ],
        ok: true,
        operation: 'RENEW'
      })
    }
    if (body.operation === 'RELEASE') {
      return Response.json({ ok: true, operation: 'RELEASE' })
    }
    throw new Error('Unexpected executor operation.')
  })

  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${privacySessionId}`)
  )
  const origin = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000127', privacySessionId),
    privacySessionId
  )
  const controller = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000128', privacySessionId, 'PLAYER', userId),
    privacySessionId
  )
  const gm = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000129', privacySessionId, 'OWNER', gmUserId),
    privacySessionId
  )
  const fogged = await connect(
    stub,
    await issueTicket(
      '00000000-0000-4000-8000-000000000130',
      privacySessionId,
      'PLAYER',
      foggedUserId
    ),
    privacySessionId
  )
  await Promise.all([origin.ready, controller.ready, gm.ready, fogged.ready])

  const originPreview = waitForMessage(origin.socket)
  const controllerPreview = waitForMessage(controller.socket)
  const gmPreview = waitForMessage(gm.socket)
  const noFoggedPreview = expectNoMessage(fogged.socket)
  origin.socket.send(
    JSON.stringify({
      envelope: {
        baselineVersion: 0,
        kind: 'TOKEN_DRAG_PREVIEW',
        position: { x: 25, y: 20 },
        previewUserId: userId,
        sceneId,
        sequence: 1,
        tokenId
      },
      type: 'TRANSIENT'
    })
  )
  const [originMessage, controllerMessage, gmMessage] = await Promise.all([
    originPreview,
    controllerPreview,
    gmPreview
  ])
  for (const message of [originMessage, controllerMessage, gmMessage]) {
    expect(message).toMatchObject({
      message: { envelope: { kind: 'TOKEN_DRAG_PREVIEW' }, visionLayers: expect.any(Array) },
      type: 'TRANSIENT'
    })
  }
  for (const message of [originMessage, controllerMessage]) {
    expect(
      message.type === 'TRANSIENT' &&
        message.message.visionReveal?.barriers.some(
          (barrier) => barrier.id === '00000000-0000-4000-8000-000000000131'
        )
    ).toBe(true)
  }
  await noFoggedPreview

  const noInvalidControllerPreview = expectNoMessage(controller.socket)
  const noInvalidGmPreview = expectNoMessage(gm.socket)
  const rejectedOriginPreview = waitForMessage(origin.socket)
  origin.socket.send(
    JSON.stringify({
      envelope: {
        baselineVersion: 0,
        kind: 'TOKEN_DRAG_PREVIEW',
        position: { x: 35, y: 20 },
        sceneId,
        sequence: 2,
        tokenId
      },
      type: 'TRANSIENT'
    })
  )
  await expect(rejectedOriginPreview).resolves.toMatchObject({
    message: { tokenDragResolution: { accepted: false } },
    type: 'TRANSIENT'
  })
  await Promise.all([noInvalidControllerPreview, noInvalidGmPreview])

  const ownerFogPreview = waitForMessage(origin.socket)
  const playerFogPreview = waitForMessage(fogged.socket)
  const noOtherPlayerFogPreview = expectNoMessage(controller.socket)
  gm.socket.send(
    JSON.stringify({
      envelope: {
        baselineVersion: 0,
        explored: true,
        kind: 'FOG_AREA_PREVIEW',
        ownerUserId: foggedUserId,
        rectangle: { a: { x: 10, y: 10 }, b: { x: 40, y: 40 } },
        sceneId,
        sequence: 1
      },
      type: 'TRANSIENT'
    })
  )
  await expect(Promise.all([ownerFogPreview, playerFogPreview])).resolves.toSatisfy(
    (messages: LiveSessionWebSocketServerMessageDto[]) =>
      messages.every(
        (message) =>
          message.type === 'TRANSIENT' && message.message.envelope.kind === 'FOG_AREA_PREVIEW'
      )
  )
  await noOtherPlayerFogPreview

  const originCommand = waitForMessages(origin.socket, 2)
  const observedCommand = waitForMessage(gm.socket)
  origin.socket.send(
    JSON.stringify({ command: sceneMoveCommand(privacyCommandId, 0, 25), type: 'COMMAND' })
  )
  await expect(originCommand).resolves.toContainEqual(
    expect.objectContaining({ hostTiming: { category: 'SCENE_ONLY', durationMs: 12 } })
  )
  const observedCommit = await observedCommand
  expect(observedCommit).toMatchObject({
    originCommandId: privacyCommandId,
    type: 'COMMAND_COMMITTED'
  })
  expect('hostTiming' in observedCommit).toBe(false)

  const gmReady = waitForMessage(gm.socket)
  const noForeignReceipt = expectNoMessage(gm.socket, 100, ['READY'])
  gm.socket.send(
    JSON.stringify({
      lastSeenDeliverySequence: 0,
      pendingCommandIds: [privacyCommandId],
      type: 'RESUME'
    })
  )
  await expect(gmReady).resolves.toMatchObject({ type: 'READY' })
  await noForeignReceipt

  const sameUserReconnect = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000131', privacySessionId),
    privacySessionId
  )
  await sameUserReconnect.ready
  const sameUserResume = waitForMessages(sameUserReconnect.socket, 2)
  sameUserReconnect.socket.send(
    JSON.stringify({
      lastSeenDeliverySequence: 0,
      pendingCommandIds: [privacyCommandId],
      type: 'RESUME'
    })
  )
  await expect(sameUserResume).resolves.toContainEqual(
    expect.objectContaining({
      originCommandId: privacyCommandId,
      replayed: true,
      hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
      type: 'COMMAND_COMMITTED'
    })
  )
  for (const socket of [
    origin.socket,
    controller.socket,
    gm.socket,
    fogged.socket,
    sameUserReconnect.socket
  ]) {
    socket.close(1000, 'done')
  }
}, 45_000)

it('fans out six clients while disjoint scene resources commit concurrently and recover', async ({
  expect
}) => {
  const ownerUserId = '00000000-0000-4000-8001-000000000001'
  const playerUserIds = [
    '00000000-0000-4000-8001-000000000002',
    '00000000-0000-4000-8001-000000000003',
    '00000000-0000-4000-8001-000000000004',
    '00000000-0000-4000-8001-000000000005',
    '00000000-0000-4000-8001-000000000006'
  ] as const
  const operations: LiveSessionExecutorRequestDto['operation'][] = []
  let commandsInFlight = 0
  let maximumCommandsInFlight = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const body = JSON.parse(await request.text()) as LiveSessionExecutorRequestDto
    if (body.sessionId !== multiSessionId) {
      if (body.operation === 'RENEW') {
        return Response.json({
          memberships: [{ role: 'OWNER', userId: body.userId }],
          ok: true,
          operation: 'RENEW'
        })
      }
      if (body.operation === 'RELEASE') {
        return Response.json({ ok: true, operation: 'RELEASE' })
      }
      throw new Error(`Unexpected executor request for session ${body.sessionId}.`)
    }
    operations.push(body.operation)

    if (body.operation === 'CLAIM') return Response.json({ ok: true, operation: 'CLAIM' })
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: [multiTokenSceneState(0, 20, 20, ownerUserId, playerUserIds[0])]
        }
      })
    }
    if (body.operation === 'RENEW') {
      return Response.json({
        memberships: [
          { role: 'OWNER', userId: ownerUserId },
          ...playerUserIds.map((playerUserId) => ({
            role: 'PLAYER' as const,
            userId: playerUserId
          }))
        ],
        ok: true,
        operation: 'RENEW'
      })
    }
    if (body.operation === 'RELEASE') {
      return Response.json({ ok: true, operation: 'RELEASE' })
    }
    if (body.operation !== 'COMMAND' || body.command.aggregateKind !== 'SCENE') {
      throw new Error(`Unexpected executor operation: ${body.operation}`)
    }
    commandsInFlight += 1
    maximumCommandsInFlight = Math.max(maximumCommandsInFlight, commandsInFlight)
    const requestedCommand = body.command.command
    await new Promise<void>((resolve) =>
      setTimeout(resolve, requestedCommand.commandId === commandId ? 25 : 50)
    )
    commandsInFlight -= 1
    if (requestedCommand.commandId === commandId) {
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: {
            commandId,
            delta: { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId },
            replayed: false,
            sceneId,
            version: 1
          },
          state: multiTokenSceneState(1, 25, 20, ownerUserId, playerUserIds[0]),
          version: 1
        },
        operation: 'COMMAND'
      })
    }
    if (requestedCommand.commandId === secondMoveCommandId) {
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId: secondMoveCommandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: {
            commandId: secondMoveCommandId,
            delta: {
              kind: 'TOKEN_MOVED',
              position: { x: 35, y: 40 },
              tokenId: secondTokenId
            },
            replayed: false,
            sceneId,
            version: 2
          },
          state: multiTokenSceneState(2, 25, 35, ownerUserId, playerUserIds[0]),
          version: 2
        },
        operation: 'COMMAND'
      })
    }
    throw new Error('Unexpected Scene command ID.')
  })

  const objectId = env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${multiSessionId}`)
  const stub = env.LIVE_SESSION_ROOMS.get(objectId)
  const clients = await Promise.all(
    Array.from({ length: 6 }, async (_, index) => {
      const ticket = await issueTicket(
        `00000000-0000-4000-8001-${String(index + 1).padStart(12, '0')}`,
        multiSessionId,
        index === 0 ? 'OWNER' : 'PLAYER',
        index === 0 ? ownerUserId : playerUserIds[index - 1]!
      )
      const client = await connect(stub, ticket, multiSessionId)
      const ready = await client.ready
      expect(ready).toMatchObject({ type: 'READY' })
      if (ready.type !== 'READY') throw new Error('Expected the initial room snapshot.')
      return { ready, socket: client.socket }
    })
  )

  const ownerReady = clients[0]!.ready
  expect(ownerReady.sceneSnapshots[0]?.scene.annotations).toHaveLength(1)
  expect(ownerReady.sceneSnapshots[0]?.scene.tokens.map((token) => token.id)).toContain(
    '00000000-0000-4000-8000-000000000122'
  )
  for (const client of clients.slice(1)) {
    expect(client.ready.sceneSnapshots[0]?.scene.annotations).toEqual([])
    expect(client.ready.sceneSnapshots[0]?.scene.tokens.map((token) => token.id)).not.toContain(
      '00000000-0000-4000-8000-000000000122'
    )
  }
  const sockets = clients.map((client) => client.socket)

  const transientMessages = sockets.slice(1).map((socket) => waitForMessage(socket))
  sockets[0]!.send(
    JSON.stringify({
      envelope: {
        baselineVersion: 0,
        kind: 'POINTER_PREVIEW',
        position: { x: 24, y: 18 },
        sceneId,
        sequence: 1
      },
      type: 'TRANSIENT'
    })
  )
  await expect(Promise.all(transientMessages)).resolves.toSatisfy(
    (messages: LiveSessionWebSocketServerMessageDto[]) =>
      messages.every(
        (message) =>
          message.type === 'TRANSIENT' && message.message.envelope.kind === 'POINTER_PREVIEW'
      )
  )

  const received = sockets.map((socket, index) => waitForMessages(socket, index < 2 ? 3 : 2))
  sockets[0]!.send(JSON.stringify({ command: sceneMoveCommand(commandId, 0, 25), type: 'COMMAND' }))
  sockets[1]!.send(
    JSON.stringify({
      command: {
        aggregateKind: 'SCENE',
        command: {
          commandId: secondMoveCommandId,
          encounterId,
          expectedSceneVersion: 0,
          path: [
            { x: 30, y: 40 },
            { x: 35, y: 40 }
          ],
          sceneId,
          tokenId: secondTokenId,
          type: 'MOVE_SCENE_TOKEN'
        }
      },
      type: 'COMMAND'
    })
  )
  const messagesByClient = await Promise.all(received)
  expect(maximumCommandsInFlight).toBe(2)
  for (const messages of messagesByClient) {
    expect(
      messages
        .filter((message) => message.type === 'COMMAND_COMMITTED')
        .map((message) => message.version)
    ).toEqual([1, 2])
  }
  expect(
    messagesByClient[5]
      ?.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.aggregateKind === 'SCENE'
      )
      .every((message) => message.delta === null && message.snapshot !== null)
  ).toBe(true)

  await prepareForHibernationEviction(stub)
  await evictDurableObject(stub)
  const resumed = waitForMessage(sockets[1]!)
  sockets[1]!.send(
    JSON.stringify({ lastSeenDeliverySequence: 0, pendingCommandIds: [], type: 'RESUME' })
  )
  const ready = await resumed
  expect(ready.type).toBe('READY')
  if (ready.type !== 'READY') throw new Error('Expected the recovered room snapshot.')
  expect(ready.deliverySequence).toBe(2)
  expect(
    ready.sceneSnapshots[0]?.scene.tokens.map((token) => [token.id, token.position.x])
  ).toEqual([[secondTokenId, 35]])
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'COMMAND', 'COMMAND'])
  for (const socket of sockets) socket.close(1000, 'done')
}, 45_000)

it('rotates away from a removed first connector and revokes stale-role sockets', async ({
  expect
}) => {
  const renewalUserIds: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = JSON.parse(await new Request(input, init).text()) as LiveSessionExecutorRequestDto
    if (body.operation === 'CLAIM') return Response.json({ ok: true, operation: 'CLAIM' })
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: [sceneState(0, 20)]
        }
      })
    }
    if (body.operation === 'RENEW') {
      renewalUserIds.push(body.userId)
      if (body.userId === removedPlayerUserId) {
        return Response.json(
          { error: { code: 'UNAUTHORIZED', message: 'Campaign membership changed.' } },
          { status: 403 }
        )
      }
      return Response.json({
        memberships: [
          { role: 'OWNER', userId },
          { role: 'PLAYER', userId: staleOwnerUserId },
          { role: 'PLAYER', userId: retainedPlayerUserId }
        ],
        ok: true,
        operation: 'RENEW'
      })
    }
    if (body.operation === 'RELEASE') {
      return Response.json({ ok: true, operation: 'RELEASE' })
    }
    throw new Error(`Unexpected executor operation: ${body.operation}`)
  })

  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${reauthorizationSessionId}`)
  )
  const removedPlayer = await connect(
    stub,
    await issueTicket(
      '00000000-0000-4000-8000-000000000147',
      reauthorizationSessionId,
      'PLAYER',
      removedPlayerUserId
    ),
    reauthorizationSessionId
  )
  const owner = await connect(
    stub,
    await issueTicket(
      '00000000-0000-4000-8000-000000000145',
      reauthorizationSessionId,
      'OWNER',
      userId
    ),
    reauthorizationSessionId
  )
  const staleOwner = await connect(
    stub,
    await issueTicket(
      '00000000-0000-4000-8000-000000000146',
      reauthorizationSessionId,
      'OWNER',
      staleOwnerUserId
    ),
    reauthorizationSessionId
  )
  const retainedPlayer = await connect(
    stub,
    await issueTicket(
      '00000000-0000-4000-8000-000000000148',
      reauthorizationSessionId,
      'PLAYER',
      retainedPlayerUserId
    ),
    reauthorizationSessionId
  )
  await Promise.all([owner.ready, staleOwner.ready, removedPlayer.ready, retainedPlayer.ready])

  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec(
      'UPDATE room_meta SET authority_renewal_at = ? WHERE id = 1',
      Date.now() - 1
    )
    await state.storage.setAlarm(Date.now() + 60_000)
  })
  const staleOwnerRejected = waitForMessage(staleOwner.socket)
  const removedPlayerRejected = waitForMessage(removedPlayer.socket)
  const staleOwnerClosed = waitForClose(staleOwner.socket)
  const removedPlayerClosed = waitForClose(removedPlayer.socket)
  expect(await runDurableObjectAlarm(stub)).toBe(true)
  for (const rejection of await Promise.all([staleOwnerRejected, removedPlayerRejected])) {
    expect(rejection).toEqual({
      code: 'UNAUTHORIZED',
      commandId: null,
      message: 'Campaign membership changed. Reconnect with a new ticket.',
      type: 'COMMAND_REJECTED'
    })
  }
  expect((await staleOwnerClosed).code).toBe(1008)
  expect((await removedPlayerClosed).code).toBe(1008)
  expect(renewalUserIds).toHaveLength(2)
  expect(renewalUserIds[0]).toBe(removedPlayerUserId)
  expect([userId, staleOwnerUserId, retainedPlayerUserId]).toContain(renewalUserIds[1])
  expect(
    [userId, retainedPlayerUserId].includes(
      await runInDurableObject(
        stub,
        (_instance, state) =>
          state.storage.sql
            .exec<{ authority_user_id: string }>(
              'SELECT authority_user_id FROM room_meta WHERE id = 1'
            )
            .one().authority_user_id
      )
    )
  ).toBe(true)
  await expectNoMessage(retainedPlayer.socket)

  const retainedPreview = waitForMessage(retainedPlayer.socket)
  owner.socket.send(
    JSON.stringify({
      envelope: {
        baselineVersion: 0,
        kind: 'POINTER_PREVIEW',
        position: { x: 24, y: 18 },
        sceneId,
        sequence: 1
      },
      type: 'TRANSIENT'
    })
  )
  await expect(retainedPreview).resolves.toMatchObject({
    message: { userId },
    type: 'TRANSIENT'
  })
  owner.socket.close(1000, 'done')
  retainedPlayer.socket.close(1000, 'done')
}, 45_000)

it('keeps an accepted Scene command pending across hibernation until overdue authority renews', async ({
  expect
}) => {
  const operations: LiveSessionExecutorRequestDto['operation'][] = []
  let beginRenewal!: () => void
  let completeRenewal!: () => void
  const renewalBegan = new Promise<void>((resolve) => {
    beginRenewal = resolve
  })
  const renewalReleased = new Promise<void>((resolve) => {
    completeRenewal = resolve
  })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = JSON.parse(await new Request(input, init).text()) as LiveSessionExecutorRequestDto
    if (body.sessionId !== overdueLeaseSessionId) {
      throw new Error(`Unexpected executor request for session ${body.sessionId}.`)
    }
    operations.push(body.operation)
    if (body.operation === 'CLAIM') return Response.json({ ok: true, operation: 'CLAIM' })
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: [sceneState(0, 20)]
        }
      })
    }
    if (body.operation === 'RENEW') {
      beginRenewal()
      await renewalReleased
      return Response.json({
        memberships: [{ role: 'OWNER', userId }],
        ok: true,
        operation: 'RENEW'
      })
    }
    if (body.operation === 'COMMAND') {
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId: overdueLeaseCommandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: {
            commandId: overdueLeaseCommandId,
            delta: { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId },
            replayed: false,
            sceneId,
            version: 1
          },
          state: sceneState(1, 25),
          version: 1
        },
        operation: 'COMMAND'
      })
    }
    throw new Error(`Unexpected executor operation: ${body.operation}`)
  })

  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${overdueLeaseSessionId}`)
  )
  const client = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000147', overdueLeaseSessionId),
    overdueLeaseSessionId
  )
  await client.ready
  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec(
      'UPDATE room_meta SET authority_renewal_at = ? WHERE id = 1',
      Date.now() - 1
    )
    await state.storage.deleteAlarm()
  })
  await evictDurableObject(stub)

  const accepted = waitForMessage(client.socket)
  client.socket.send(
    JSON.stringify({
      command: sceneMoveCommand(overdueLeaseCommandId, 0, 25),
      type: 'COMMAND'
    })
  )
  await expect(accepted).resolves.toEqual({
    acceptedSequence: 1,
    commandId: overdueLeaseCommandId,
    type: 'COMMAND_ACCEPTED'
  })
  await renewalBegan
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'RENEW'])

  const committed = waitForMessage(client.socket)
  completeRenewal()
  await expect(committed).resolves.toMatchObject({
    originCommandId: overdueLeaseCommandId,
    type: 'COMMAND_COMMITTED'
  })
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'RENEW', 'COMMAND'])
  expect(
    await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql
        .exec<{ status: string }>(
          'SELECT status FROM command_inbox WHERE command_id = ?',
          overdueLeaseCommandId
        )
        .one().status
    )
  ).toBe('COMMITTED')
  client.socket.close(1000, 'done')
}, 45_000)

it('renews authority through the persisted alarm after hibernation and releases after grace', async ({
  expect
}) => {
  const operations: LiveSessionExecutorRequestDto['operation'][] = []
  let renewalAttempts = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = JSON.parse(await new Request(input, init).text()) as LiveSessionExecutorRequestDto
    if (body.sessionId !== leaseSessionId) {
      if (body.operation === 'RENEW') {
        return Response.json({
          memberships: [{ role: 'OWNER', userId: body.userId }],
          ok: true,
          operation: 'RENEW'
        })
      }
      if (body.operation === 'RELEASE') {
        return Response.json({ ok: true, operation: 'RELEASE' })
      }
      throw new Error(`Unexpected executor request for session ${body.sessionId}.`)
    }
    operations.push(body.operation)
    if (body.operation === 'CLAIM') return Response.json({ ok: true, operation: 'CLAIM' })
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: [sceneState(0, 20)]
        }
      })
    }
    if (body.operation === 'RENEW') {
      renewalAttempts += 1
      if (renewalAttempts === 1) {
        return Response.json(
          { error: { code: 'COMMAND_FAILED', message: 'Executor unavailable.' } },
          { status: 503 }
        )
      }
      return Response.json({
        memberships: [{ role: 'OWNER', userId }],
        ok: true,
        operation: 'RENEW'
      })
    }
    if (body.operation === 'COMMAND') {
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: {
            commandId,
            delta: { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId },
            replayed: false,
            sceneId,
            version: 1
          },
          state: sceneState(1, 25),
          version: 1
        },
        operation: 'COMMAND'
      })
    }
    if (body.operation === 'RELEASE') {
      return Response.json({ ok: true, operation: body.operation })
    }
    throw new Error('Unexpected executor operation.')
  })

  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${leaseSessionId}`)
  )
  const client = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000135', leaseSessionId),
    leaseSessionId
  )
  await client.ready
  const initialNow = Date.now()
  await runInDurableObject(stub, async (_instance, state) => {
    const journal = new LiveSessionRoomJournal(state.storage)
    journal.acceptCommand({
      actorRole: 'OWNER',
      actorUserId: userId,
      commandId,
      conflictKeys: [`scene:${sceneId}:token:${tokenId}`],
      fingerprint: commandId,
      originSocketId: crypto.randomUUID(),
      payloadJson: JSON.stringify(sceneMoveCommand(commandId, 0, 25))
    })
    await state.storage.deleteAlarm()
  })
  await evictDurableObject(stub)

  vi.useFakeTimers()
  vi.setSystemTime(initialNow + 31_000)
  const resumed = waitForMessage(client.socket)
  client.socket.send(
    JSON.stringify({ lastSeenDeliverySequence: 0, pendingCommandIds: [], type: 'RESUME' })
  )
  await expect(resumed).resolves.toMatchObject({ type: 'READY' })
  expect(await runDurableObjectAlarm(stub)).toBe(true)
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'RENEW'])
  expect(
    await runInDurableObject(
      stub,
      (_instance, state) =>
        state.storage.sql
          .exec<{ status: string }>(
            'SELECT status FROM command_inbox WHERE command_id = ?',
            commandId
          )
          .one().status
    )
  ).toBe('PENDING')
  const renewalRetry = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ authority_renewal_at: number | null; authority_renewal_blocked: number }>(
        `SELECT authority_renewal_at, authority_renewal_blocked
           FROM room_meta WHERE id = 1`
      )
      .one()
  )
  expect(renewalRetry).toEqual({
    authority_renewal_at: initialNow + 33_000,
    authority_renewal_blocked: 1
  })
  expect(await runDurableObjectAlarm(stub)).toBe(true)
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'RENEW'])

  vi.setSystemTime(initialNow + 33_001)
  const committed = waitForMessage(client.socket)
  expect(await runDurableObjectAlarm(stub)).toBe(true)
  await expect(committed).resolves.toMatchObject({
    originCommandId: commandId,
    type: 'COMMAND_COMMITTED'
  })
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'RENEW', 'RENEW', 'COMMAND'])
  const renewedAt = await runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ authority_renewal_at: number | null }>(
          'SELECT authority_renewal_at FROM room_meta WHERE id = 1'
        )
        .one().authority_renewal_at
  )
  expect(renewedAt).toBeGreaterThanOrEqual(initialNow + 43_001)
  vi.useRealTimers()

  client.socket.close(1000, 'done')
  await runInDurableObject(stub, (_instance, state) => {
    for (const socket of state.getWebSockets()) socket.close(1000, 'done')
  })
  await waitForNoServerSockets(stub)
  const scheduledReleaseAt = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ release_at: number | null }>('SELECT release_at FROM room_meta WHERE id = 1')
      .one().release_at
  )
  expect(scheduledReleaseAt).toBeGreaterThan(Date.now())
  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec('UPDATE room_meta SET release_at = ? WHERE id = 1', Date.now() - 1)
    await state.storage.setAlarm(Date.now() + 60_000)
  })
  expect(await runDurableObjectAlarm(stub)).toBe(true)
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'RENEW', 'RENEW', 'COMMAND', 'RELEASE'])
  expect(
    await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql
        .exec<{
          authority_renewal_at: number | null
          authority_renewal_blocked: number
          release_at: number | null
        }>(
          `SELECT authority_renewal_at, authority_renewal_blocked, release_at
           FROM room_meta WHERE id = 1`
        )
        .one()
    )
  ).toEqual({ authority_renewal_at: null, authority_renewal_blocked: 0, release_at: null })
}, 45_000)

it('fails closed when authority renewal is terminally rejected and requires rehydration', async ({
  expect
}) => {
  const operations: LiveSessionExecutorRequestDto['operation'][] = []
  let rejectRenewal = true
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = JSON.parse(await new Request(input, init).text()) as LiveSessionExecutorRequestDto
    if (body.sessionId !== terminalSessionId) {
      if (body.operation === 'RENEW') {
        return Response.json({
          memberships: [{ role: 'OWNER', userId: body.userId }],
          ok: true,
          operation: 'RENEW'
        })
      }
      if (body.operation === 'RELEASE') {
        return Response.json({ ok: true, operation: 'RELEASE' })
      }
      throw new Error(`Unexpected executor request for session ${body.sessionId}.`)
    }
    operations.push(body.operation)
    if (body.operation === 'CLAIM') return Response.json({ ok: true, operation: 'CLAIM' })
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: [sceneState(0, 20)]
        }
      })
    }
    if (body.operation === 'RENEW' && rejectRenewal) {
      rejectRenewal = false
      return Response.json(
        { error: { code: 'CONFLICT', message: 'The live-session authority expired.' } },
        { status: 409 }
      )
    }
    if (body.operation === 'RENEW') {
      return Response.json({
        memberships: [{ role: 'OWNER', userId }],
        ok: true,
        operation: 'RENEW'
      })
    }
    if (body.operation === 'RELEASE') {
      return Response.json({ ok: true, operation: 'RELEASE' })
    }
    throw new Error(`Unexpected executor operation: ${body.operation}`)
  })

  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${terminalSessionId}`)
  )
  const first = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000136', terminalSessionId),
    terminalSessionId
  )
  await first.ready
  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec(
      'UPDATE room_meta SET authority_renewal_at = ? WHERE id = 1',
      Date.now() - 1
    )
    await state.storage.setAlarm(Date.now() + 60_000)
  })
  const closed = new Promise<CloseEvent>((resolve) =>
    first.socket.addEventListener('close', (event) => resolve(event), { once: true })
  )
  expect(await runDurableObjectAlarm(stub)).toBe(true)
  expect((await closed).code).toBe(1012)
  expect(
    await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql
        .exec<{
          authority_renewal_at: number | null
          authority_renewal_blocked: number
          snapshot_json: string | null
        }>(
          `SELECT authority_renewal_at, authority_renewal_blocked, snapshot_json
           FROM room_meta WHERE id = 1`
        )
        .one()
    )
  ).toEqual({ authority_renewal_at: null, authority_renewal_blocked: 0, snapshot_json: null })

  const replacement = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000137', terminalSessionId),
    terminalSessionId
  )
  await expect(replacement.ready).resolves.toMatchObject({ type: 'READY' })
  expect(operations).toEqual(['CLAIM', 'SNAPSHOT', 'RENEW', 'CLAIM', 'SNAPSHOT'])
  replacement.socket.close(1000, 'done')
}, 45_000)

it('releases a same-key fence after terminal rejection and keeps retryable failures pending', async ({
  expect
}) => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = JSON.parse(await new Request(input, init).text()) as LiveSessionExecutorRequestDto
    if (body.operation === 'CLAIM') return Response.json({ ok: true, operation: 'CLAIM' })
    if (body.operation === 'SNAPSHOT') {
      return Response.json({
        operation: 'SNAPSHOT',
        snapshot: {
          aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
          characterVisions: [],
          encounterCharacterBindings: [],
          sceneStates: [sceneState(0, 20)]
        }
      })
    }
    if (body.operation === 'COMMAND') {
      const id = body.command.command.commandId
      if (id === commandId) {
        return Response.json(
          { error: { code: 'INVALID_REQUEST', message: 'The command is invalid.' } },
          { status: 400 }
        )
      }
      if (id === retryableCommandId) {
        return Response.json(
          { error: { code: 'COMMAND_FAILED', message: 'Executor unavailable.' } },
          { status: 503 }
        )
      }
      return Response.json({
        execution: {
          aggregateId: sceneId,
          aggregateKind: 'SCENE',
          commandId: laterCommandId,
          hostTiming: { category: 'SCENE_ONLY', durationMs: 12 },
          replayed: false,
          response: {
            commandId: laterCommandId,
            delta: { kind: 'TOKEN_MOVED', position: { x: 30, y: 20 }, tokenId },
            replayed: false,
            sceneId,
            version: 1
          },
          state: sceneState(1, 30),
          version: 1
        },
        operation: 'COMMAND'
      })
    }
    if (body.operation === 'RENEW') {
      return Response.json({
        memberships: [{ role: 'OWNER', userId }],
        ok: true,
        operation: 'RENEW'
      })
    }
    if (body.operation === 'RELEASE') {
      return Response.json({ ok: true, operation: 'RELEASE' })
    }
    throw new Error('Unexpected executor operation.')
  })

  const testSessionId = '00000000-0000-4000-8000-000000000138'
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${testSessionId}`)
  )
  const client = await connect(
    stub,
    await issueTicket('00000000-0000-4000-8000-000000000139', testSessionId),
    testSessionId
  )
  await client.ready

  const rejected = waitForMessages(client.socket, 2)
  client.socket.send(
    JSON.stringify({ command: sceneMoveCommand(commandId, 0, 25), type: 'COMMAND' })
  )
  await expect(rejected).resolves.toEqual([
    { acceptedSequence: 1, commandId, type: 'COMMAND_ACCEPTED' },
    {
      code: 'INVALID_COMMAND',
      commandId,
      message: 'The command is invalid.',
      type: 'COMMAND_REJECTED'
    }
  ])

  const committed = waitForMessages(client.socket, 2)
  client.socket.send(
    JSON.stringify({ command: sceneMoveCommand(laterCommandId, 0, 30), type: 'COMMAND' })
  )
  await expect(committed).resolves.toContainEqual(
    expect.objectContaining({ originCommandId: laterCommandId, type: 'COMMAND_COMMITTED' })
  )

  const acceptedRetry = waitForMessage(client.socket)
  client.socket.send(
    JSON.stringify({ command: sceneMoveCommand(retryableCommandId, 1, 35), type: 'COMMAND' })
  )
  await expect(acceptedRetry).resolves.toEqual({
    acceptedSequence: 3,
    commandId: retryableCommandId,
    type: 'COMMAND_ACCEPTED'
  })
  await expectNoMessage(client.socket)
  const retryableRow = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ attempts: number; next_attempt_at: number; status: string }>(
        `SELECT attempts, next_attempt_at, status
           FROM command_inbox WHERE command_id = ?`,
        retryableCommandId
      )
      .one()
  )
  expect(retryableRow).toMatchObject({ attempts: 1, status: 'PENDING' })
  expect(retryableRow.next_attempt_at).toBeGreaterThan(Date.now())
  client.socket.close(1000, 'done')
}, 45_000)

it('keeps authority renewal anchored to the last actual claim or renewal', async ({ expect }) => {
  const testSessionId = '00000000-0000-4000-8000-000000000141'
  const testCommandId = '00000000-0000-4000-8000-000000000142'
  const renewalAt = Date.now() + 10_000
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${testSessionId}`)
  )
  await stub.fetch(new Request('https://session.test/not-a-websocket'))

  const stored = await runInDurableObject(stub, (_instance, state) => {
    const journal = new LiveSessionRoomJournal(state.storage)
    journal.ensureRoomIdentity({
      authorityId: crypto.randomUUID(),
      campaignId,
      sessionId: testSessionId
    })
    journal.setAuthorityRenewal(renewalAt)
    journal.acceptCommand({
      actorRole: 'OWNER',
      actorUserId: userId,
      commandId: testCommandId,
      conflictKeys: [`scene:${sceneId}:token:${tokenId}`],
      fingerprint: testCommandId,
      originSocketId: crypto.randomUUID(),
      payloadJson: '{}'
    })
    journal.markExecuting(testCommandId)
    journal.markCompleted(testCommandId, '{}')
    return {
      authorityRenewalAt: journal.loadMeta()?.authorityRenewalAt,
      status: journal.findCommand(testCommandId)?.status
    }
  })

  expect(stored).toEqual({ authorityRenewalAt: renewalAt, status: 'COMPLETED' })
}, 45_000)

it('caps terminal command receipts without pruning pending, executing, or completed work', async ({
  expect
}) => {
  const testSessionId = '00000000-0000-4000-8000-000000000140'
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${testSessionId}`)
  )
  await stub.fetch(new Request('https://session.test/not-a-websocket'))

  const statuses = await runInDurableObject(stub, (_instance, state) => {
    const journal = new LiveSessionRoomJournal(state.storage, { terminalCommandLimit: 2 })
    journal.ensureRoomIdentity({
      authorityId: crypto.randomUUID(),
      campaignId,
      sessionId: testSessionId
    })
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
    const accept = (id: string) =>
      journal.acceptCommand({
        actorRole: 'OWNER',
        actorUserId: userId,
        commandId: id,
        conflictKeys: [`scene:${sceneId}:token:${tokenId}`],
        fingerprint: id,
        originSocketId: crypto.randomUUID(),
        payloadJson: '{}'
      })

    for (const id of ids) accept(id)
    journal.markRejected(ids[0]!, '{}')
    journal.markCompleted(ids[1]!, '{}')
    journal.markExecuting(ids[2]!)
    journal.markRejected(ids[4]!, '{}')
    journal.markCompleted(ids[5]!, '{}')
    journal.commitDelivery(ids[5]!, 1, '{}')

    return ids.map((id) => journal.findCommand(id)?.status ?? null)
  })
  expect(statuses).toEqual([null, 'COMPLETED', 'EXECUTING', 'PENDING', 'REJECTED', 'COMMITTED'])
}, 45_000)

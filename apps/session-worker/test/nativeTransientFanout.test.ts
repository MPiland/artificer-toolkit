import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { sceneCurrentEntityPageSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import { sceneFogLayersPageSchema } from '@artificer-toolkit/schema/api/sceneFog'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneSessionCharacterVisionResultSchema,
  sceneSessionVisionBindingsPageSchema,
  sceneSessionVisionRunsPageSchema
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import {
  liveSessionTransientCaptureInputSchema,
  liveSessionVisionRevisionsInputSchema,
  type LiveSessionTransientCapture,
  type LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const campaignId = '00000000-0000-4000-8000-000000000101'
const authorityEpoch = '00000000-0000-4000-8000-000000000112'
const activationFingerprint = 'a'.repeat(64)
const sceneId = '00000000-0000-4000-8000-000000000103'
const ownerId = '00000000-0000-4000-8000-000000000104'
const playerId = '00000000-0000-4000-8000-000000000105'
const otherPlayerId = '00000000-0000-4000-8000-000000000106'
const tokenId = '00000000-0000-4000-8000-000000000107'
const sockets: WebSocket[] = []
/** Every Convex route path the room requested through `installFetch`, in order. */
const backendPaths: string[] = []
const realNow = Date.now

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
  backendPaths.length = 0
  vi.restoreAllMocks()
})

/** Lets a test move the room's clock forward while real time keeps running. */
function controlClock() {
  let offset = 0
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset)
  return (milliseconds: number) => {
    offset += milliseconds
  }
}

function newRoom() {
  return env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
}

function member(userId: string, role: 'OWNER' | 'PLAYER', epoch = '2026-09-12T00:00:00.000Z') {
  return { membershipEpoch: epoch, role, userId }
}

function header() {
  return sceneLiveStateHeaderSchema.parse({
    ambientIllumination: 'DIM',
    campaignId,
    counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 1 },
    currentCounts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      measurements: 0,
      tokens: 1
    },
    definitionId: '00000000-0000-4000-8000-000000000108',
    definitionSaveId: '00000000-0000-4000-8000-000000000109',
    definitionVersion: 1,
    fogLayerCount: 0,
    fogMode: 'PER_PLAYER',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: sceneId,
    map: {
      assetId: '00000000-0000-4000-8000-000000000110',
      height: 100,
      tileManifestAssetId: null,
      width: 100
    },
    name: 'Scene',
    version: 1,
    visionRevealMode: 'ON_DRAG'
  })
}

const token = {
  assetId: null,
  controlledByUserIds: [playerId],
  height: 5,
  hidden: false,
  id: tokenId,
  label: 'Scout',
  locked: false,
  position: { x: 10, y: 10 },
  rotationDegrees: 0,
  vision: {
    angleDegrees: 360,
    brightRange: 0,
    dimRange: 10,
    directionDegrees: 0,
    enabled: true
  },
  width: 5
}

function captureFor(
  originUserId: string,
  role: 'OWNER' | 'PLAYER',
  recipients: readonly ReturnType<typeof member>[],
  epoch?: string
): LiveSessionTransientCapture {
  return {
    campaignId,
    systemId: '00000000-0000-4000-8000-000000000111',
    observedCharacterRevisions: [],
    origin: member(originUserId, role, epoch),
    presentation: { campaignId, sceneId, version: 1 },
    recipients: [...recipients],
    sceneEncounterId: null,
    sceneMovementDecisionPending: false,
    originBoundTokenControl: [],
    sceneHeader: header(),
    visionFreshness: { campaign: null, play: null, system: null }
  }
}

function installFetch(
  members: readonly ReturnType<typeof member>[],
  mutate?: (
    call: number,
    capture: LiveSessionTransientCapture,
    input: LiveSessionTransientCaptureInput
  ) => LiveSessionTransientCapture | Response | Promise<LiveSessionTransientCapture | Response>,
  entity: typeof token = token
) {
  let captures = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const pathname = new URL(request.url).pathname
    backendPaths.push(pathname)
    if (pathname === '/live-sessions/bootstrap') {
      return Response.json({
        activationFingerprint,
        persistedSequence: 0,
        persistedStateChecksum: activationFingerprint
      })
    }
    if (pathname === '/live-sessions/activate') {
      const body = (await request.json()) as { stateChecksum: string }
      const now = new Date().toISOString()
      return Response.json({
        activationFingerprint,
        campaignId,
        createdAt: now,
        epoch: authorityEpoch,
        persistedSequence: 0,
        persistedStateChecksum: body.stateChecksum,
        phase: 'DO_ACTIVE',
        updatedAt: now
      })
    }
    if (pathname === '/live-sessions/capture') {
      const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
      const origin = members.find((candidate) => candidate.userId === body.expectedUserId)
      if (!origin || origin.role !== body.expectedRole) return new Response(null, { status: 409 })
      const capture = captureFor(
        origin.userId,
        origin.role,
        members.filter((candidate) => candidate.userId !== origin.userId)
      )
      const result = (await mutate?.(++captures, capture, body)) ?? capture
      return result instanceof Response ? result : Response.json(result)
    }
    const body = (await request.json()) as { request: { collection?: string; kind: string } }
    if (body.request.kind === 'ENTITIES')
      return Response.json({
        kind: 'ENTITIES',
        result: sceneCurrentEntityPageSchema.parse({
          collection: body.request.collection,
          next: null,
          page:
            body.request.collection === 'tokens'
              ? [{ doorState: null, ordinal: 0, value: { collection: 'tokens', entity } }]
              : [],
          version: 1
        })
      })
    if (body.request.kind === 'FOG_LAYERS')
      return Response.json({
        kind: 'FOG_LAYERS',
        result: sceneFogLayersPageSchema.parse({
          continueCursor: '',
          isDone: true,
          page: [],
          version: 1
        })
      })
    if (body.request.kind === 'VISION_RUNS')
      return Response.json({
        kind: 'VISION_RUNS',
        result: sceneSessionVisionRunsPageSchema.parse({
          continueCursor: '',
          isDone: true,
          page: []
        })
      })
    throw new Error(`Unexpected hydration request: ${body.request.kind}`)
  })
}

async function ticket(userId: string, role: 'OWNER' | 'PLAYER') {
  const now = Math.floor(Date.now() / 1_000)
  return new SignJWT({
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
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(secret))
}

async function connect(stub: DurableObjectStub, userId: string, role: 'OWNER' | 'PLAYER') {
  const response = await stub.fetch(
    new Request(`https://session.test/live-session/${campaignId}`, {
      headers: {
        upgrade: 'websocket',
        'x-artificer-live-session-ticket': await ticket(userId, role)
      }
    })
  )
  const socket = response.webSocket
  if (!socket) throw new Error('Missing native test WebSocket.')
  sockets.push(socket)
  const messages: LiveSessionWebSocketServerMessageDto[] = []
  socket.addEventListener('message', (event) => {
    messages.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data))))
  })
  socket.accept()
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setExpirationTime(Math.floor(Date.now() / 1_000) + 300)
    .sign(new TextEncoder().encode(secret))
  socket.send(JSON.stringify({ accessToken, type: 'AUTHENTICATE' }))
  await vi.waitFor(() =>
    expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  messages.length = 0
  return { accessToken, messages, socket }
}

function transient(messages: readonly LiveSessionWebSocketServerMessageDto[]) {
  return messages.filter((message) => message.type === 'TRANSIENT')
}

async function noTransient(messages: readonly LiveSessionWebSocketServerMessageDto[]) {
  await new Promise((resolve) => setTimeout(resolve, 75))
  expect(transient(messages)).toEqual([])
}

function captureCount() {
  return backendPaths.filter((path) => path === '/live-sessions/capture').length
}

function tokenPreview(sequence: number, position = { x: 20, y: 10 }) {
  return {
    baselineVersion: 1,
    audience: 'TABLE',
    kind: 'TOKEN_DRAG_PREVIEW' as const,
    position,
    sceneId,
    sequence,
    tokenId
  }
}

function pointerPreview(sequence: number, baselineVersion = 1) {
  return {
    baselineVersion,
    audience: 'TABLE',
    kind: 'POINTER_PREVIEW' as const,
    position: { x: 15, y: 10 },
    sceneId,
    sequence
  }
}

function sendPreview(
  client: Awaited<ReturnType<typeof connect>>,
  envelope: ReturnType<typeof tokenPreview> | ReturnType<typeof pointerPreview>
) {
  client.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope }))
}

/** Synchronizes the room's Scene cache as the tabletop does when it opens the presented Scene. */
async function synchronize(client: Awaited<ReturnType<typeof connect>>) {
  client.messages.length = 0
  client.socket.send(
    JSON.stringify({
      expectedPresentationVersion: 1,
      sceneId,
      type: 'SYNCHRONIZE_SCENE',
      version: 1
    })
  )
  await vi.waitFor(() =>
    expect(
      client.messages.some(
        (message) => message.type === 'STATE_SYNC' && message.state.scene?.id === sceneId
      )
    ).toBe(true)
  )
}

it('fans out token previews from room memory with no backend call or SQLite access per sample', async () => {
  const stub = newRoom()
  await runInDurableObject(stub, () =>
    installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')])
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  const sql = await runInDurableObject(stub, (_instance, state) =>
    vi.spyOn(state.storage.sql, 'exec')
  )
  await synchronize(owner)
  // The synchronization itself reads the journal, so the spy sees the room's storage.
  expect(sql).toHaveBeenCalled()
  sql.mockClear()
  backendPaths.length = 0
  owner.messages.length = 0
  player.messages.length = 0

  for (const sequence of [1, 2, 3])
    sendPreview(player, tokenPreview(sequence, { x: 10 + sequence * 5, y: 10 }))
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(3)
    expect(transient(player.messages)).toHaveLength(3)
  })
  expect(backendPaths).toEqual([])
  expect(sql).not.toHaveBeenCalled()
})

it.each([
  ['controls', true],
  ['does not control', false]
] as const)(
  "leases the bound-token control of a player who %s its actor, off the sample's path (D25)",
  async (_label, controlled) => {
    const advance = controlClock()
    const stub = newRoom()
    const captureModes: LiveSessionTransientCaptureInput['mode'][] = []
    await runInDurableObject(stub, () =>
      installFetch(
        [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')],
        (_call, capture, input) => {
          captureModes.push(input.mode)
          return {
            ...capture,
            sceneEncounterId: '00000000-0000-4000-8000-000000000120',
            originBoundTokenControl:
              capture.origin.role === 'PLAYER' ? [{ tokenId, controlled }] : []
          }
        }
      )
    )
    const [owner, player] = await Promise.all([
      connect(stub, ownerId, 'OWNER'),
      connect(stub, playerId, 'PLAYER')
    ])
    await synchronize(owner)
    captureModes.length = 0
    owner.messages.length = 0
    player.messages.length = 0

    // The first sample finds no lease: it is dropped, and one background capture starts.
    sendPreview(player, tokenPreview(1, { x: 15, y: 10 }))
    await vi.waitFor(() => expect(captureModes).toEqual(['AUTHORITY']))
    await noTransient(owner.messages)
    for (const sequence of [2, 3, 4])
      sendPreview(player, tokenPreview(sequence, { x: 10 + sequence * 5, y: 10 }))
    if (controlled)
      await vi.waitFor(() => {
        expect(transient(owner.messages)).toHaveLength(3)
        expect(transient(player.messages)).toHaveLength(3)
      })
    else {
      await noTransient(owner.messages)
      await noTransient(player.messages)
    }
    expect(captureModes).toEqual(['AUTHORITY'])

    // From half the lease, one background capture renews it while samples keep the current lease.
    advance(15_001)
    sendPreview(player, tokenPreview(5, { x: 35, y: 10 }))
    sendPreview(player, tokenPreview(6, { x: 40, y: 10 }))
    await vi.waitFor(() => expect(captureModes).toEqual(['AUTHORITY', 'AUTHORITY']))
    if (controlled) await vi.waitFor(() => expect(transient(owner.messages)).toHaveLength(5))
  }
)

it.each([
  ['the cached Scene version', 1, true],
  ['a stale Scene version', 2, false]
] as const)(
  'fans out pointer previews for %s without a backend call',
  async (_label, baselineVersion, broadcasts) => {
    const stub = newRoom()
    await runInDurableObject(stub, () =>
      installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')])
    )
    const [owner, player] = await Promise.all([
      connect(stub, ownerId, 'OWNER'),
      connect(stub, playerId, 'PLAYER')
    ])
    await synchronize(owner)
    backendPaths.length = 0
    player.messages.length = 0

    sendPreview(owner, pointerPreview(1, baselineVersion))
    if (broadcasts)
      await vi.waitFor(() =>
        expect(transient(player.messages)).toEqual([
          expect.objectContaining({
            message: expect.objectContaining({
              envelope: expect.objectContaining({ kind: 'POINTER_PREVIEW' }),
              userId: ownerId
            })
          })
        ])
      )
    else await noTransient(player.messages)
    expect(backendPaths).toEqual([])
  }
)

it('stops previews to an evicted member and rebuilds the dropped Scene cache once in the background', async () => {
  const members = [
    member(ownerId, 'OWNER'),
    member(playerId, 'PLAYER'),
    member(otherPlayerId, 'PLAYER')
  ]
  const stub = newRoom()
  await runInDurableObject(stub, () => installFetch(members))
  const [owner, player, other] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER'),
    connect(stub, otherPlayerId, 'PLAYER')
  ])
  await synchronize(owner)
  const evicted = await stub.fetch(
    new Request(`https://session.test${LIVE_SESSION_CONTROL_PATH}`, {
      body: JSON.stringify({
        campaignId,
        operation: {
          type: 'EVICT_USER',
          userId: otherPlayerId,
          membershipEpoch: members[2]!.membershipEpoch
        }
      }),
      method: 'POST'
    })
  )
  expect(await evicted.json()).toEqual({ closed: 1 })
  backendPaths.length = 0
  player.messages.length = 0
  other.messages.length = 0

  // Eviction drops the Scene cache; samples are dropped until one background rebuild finishes.
  let sequence = 0
  await vi.waitFor(() => {
    sequence += 1
    sendPreview(owner, pointerPreview(sequence))
    expect(transient(player.messages).length).toBeGreaterThan(0)
  })
  expect(sequence).toBeGreaterThan(1)
  // One rebuild: its capture and the confirming capture, not one per sample.
  expect(captureCount()).toBe(2)
  expect(transient(other.messages)).toEqual([])
})

it('fans out controlled token previews and per-player fog only to current authorized members', async () => {
  const members = [
    member(ownerId, 'OWNER'),
    member(playerId, 'PLAYER'),
    member(otherPlayerId, 'PLAYER')
  ]
  const stub = newRoom()
  await runInDurableObject(stub, () => installFetch(members))
  const [owner, player, other] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER'),
    connect(stub, otherPlayerId, 'PLAYER')
  ])
  await synchronize(owner)
  backendPaths.length = 0
  owner.messages.length = 0
  player.messages.length = 0
  other.messages.length = 0

  sendPreview(player, tokenPreview(1))
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(1)
    expect(transient(player.messages)).toHaveLength(1)
    expect(transient(other.messages)).toHaveLength(0)
  })

  owner.messages.length = 0
  player.messages.length = 0
  other.messages.length = 0
  sendPreview(owner, tokenPreview(1))
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(1)
    expect(transient(player.messages)).toHaveLength(1)
    expect(transient(other.messages)).toHaveLength(0)
    expect(transient(owner.messages)[0]).toMatchObject({
      message: {
        envelope: { kind: 'TOKEN_DRAG_PREVIEW', tokenId },
        tokenDragResolution: { accepted: true },
        userId: ownerId
      }
    })
    expect(transient(player.messages)[0]?.message.tokenDragResolution).toBeUndefined()
  })

  owner.messages.length = 0
  player.messages.length = 0
  other.messages.length = 0
  owner.socket.send(
    JSON.stringify({
      type: 'TRANSIENT',
      envelope: {
        baselineVersion: 1,
        explored: true,
        audience: 'TABLE',
        kind: 'FOG_AREA_PREVIEW',
        ownerUserId: playerId,
        rectangle: { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } },
        sceneId,
        sequence: 1
      }
    })
  )
  await vi.waitFor(() => {
    expect(transient(player.messages)).toHaveLength(1)
    expect(transient(owner.messages)).toHaveLength(0)
  })
  await noTransient(other.messages)
  expect(backendPaths).toEqual([])
})

it.each([
  ['a GM-audience token preview', 'GM', false, 'TOKEN', false],
  ['a GM-audience pointer', 'GM', false, 'POINTER', false],
  ['a shared token preview', 'TABLE', false, 'TOKEN', true],
  ['a shared preview of a hidden token', 'TABLE', true, 'TOKEN', false]
] as const)(
  'delivers %s to the GM and only to players allowed to see it',
  async (_label, audience, hidden, kind, playerSees) => {
    const stub = newRoom()
    await runInDurableObject(stub, () =>
      installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')], undefined, {
        ...token,
        hidden
      })
    )
    const owner = await connect(stub, ownerId, 'OWNER')
    const ownerElsewhere = await connect(stub, ownerId, 'OWNER')
    const player = await connect(stub, playerId, 'PLAYER')
    await synchronize(owner)
    ownerElsewhere.messages.length = 0
    player.messages.length = 0

    sendPreview(owner, {
      ...(kind === 'TOKEN' ? tokenPreview(1) : pointerPreview(1)),
      audience
    })
    await vi.waitFor(() => expect(transient(ownerElsewhere.messages)).toHaveLength(1))
    if (playerSees) await vi.waitFor(() => expect(transient(player.messages)).toHaveLength(1))
    else await noTransient(player.messages)
  }
)

it.each(['origin', 'recipient'] as const)(
  'drops previews from or to a member whose admission expired (%s)',
  async (expired) => {
    const advance = controlClock()
    const stub = newRoom()
    await runInDurableObject(stub, () =>
      installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')])
    )
    // The owner's access token expires 10 s before the player's.
    const owner = await connect(stub, ownerId, 'OWNER')
    advance(10_000)
    const player = await connect(stub, playerId, 'PLAYER')
    await synchronize(owner)
    owner.messages.length = 0
    player.messages.length = 0
    advance(291_000)

    if (expired === 'origin') {
      sendPreview(owner, tokenPreview(1))
      await vi.waitFor(() =>
        expect(owner.messages).toContainEqual({ type: 'AUTHENTICATION_REQUIRED' })
      )
      await noTransient(owner.messages)
      await noTransient(player.messages)
      const refreshedToken = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(ownerId)
        .setExpirationTime(Math.floor(Date.now() / 1_000) + 300)
        .sign(new TextEncoder().encode(secret))
      owner.socket.send(JSON.stringify({ accessToken: refreshedToken, type: 'AUTHENTICATE' }))
      await vi.waitFor(() =>
        expect(owner.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
      )
      return
    }
    sendPreview(player, tokenPreview(1))
    await vi.waitFor(() => expect(transient(player.messages)).toHaveLength(1))
    await vi.waitFor(() =>
      expect(owner.messages).toContainEqual({ type: 'AUTHENTICATION_REQUIRED' })
    )
    await noTransient(owner.messages)
  }
)

it('keeps preview stream sequences and paths in memory only', async () => {
  const stub = newRoom()
  await runInDurableObject(stub, () => installFetch([member(ownerId, 'OWNER')]))
  const owner = await connect(stub, ownerId, 'OWNER')
  await synchronize(owner)
  owner.messages.length = 0

  sendPreview(owner, tokenPreview(5, { x: 20, y: 20 }))
  sendPreview(owner, tokenPreview(5, { x: 25, y: 20 }))
  sendPreview(owner, tokenPreview(6, { x: 25, y: 20 }))
  await vi.waitFor(() => expect(transient(owner.messages)).toHaveLength(2))
  expect(transient(owner.messages).map((message) => message.message.tokenDragResolution)).toEqual([
    {
      accepted: true,
      path: [
        { x: 10, y: 10 },
        { x: 20, y: 20 }
      ]
    },
    {
      accepted: true,
      // The retained path is extended, then simplified to the unobstructed straight move.
      path: [
        { x: 10, y: 10 },
        { x: 25, y: 20 }
      ]
    }
  ])
  expect(
    await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql
        .exec("SELECT name FROM sqlite_master WHERE name = 'native_socket_transients'")
        .toArray()
    )
  ).toEqual([])

  // Hibernation loses the streams: the next sample starts again from the token's position.
  await evictDurableObject(stub)
  owner.messages.length = 0
  owner.socket.send(JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 }))
  await vi.waitFor(() => expect(owner.messages).toContainEqual({ type: 'AUTHENTICATION_REQUIRED' }))
  owner.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: owner.accessToken }))
  await vi.waitFor(() =>
    expect(owner.messages.some((message) => message.type === 'STATE_SYNC')).toBe(true)
  )
  await synchronize(owner)
  owner.messages.length = 0
  sendPreview(owner, tokenPreview(5, { x: 20, y: 20 }))
  await vi.waitFor(() =>
    expect(transient(owner.messages)[0]?.message.tokenDragResolution).toEqual({
      accepted: true,
      path: [
        { x: 10, y: 10 },
        { x: 20, y: 20 }
      ]
    })
  )
})

it('retries one Scene capture conflict in the background, then serves previews', async () => {
  const stub = newRoom()
  let captureCalls = 0
  await runInDurableObject(stub, () =>
    installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')], (call, capture, input) => {
      captureCalls = call
      if (call === 4) expect(input.observedCharacterRevisions).toEqual([])
      return call === 3 ? new Response(null, { status: 409 }) : capture
    })
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  let sequence = 0
  await vi.waitFor(() => {
    sequence += 1
    sendPreview(owner, tokenPreview(sequence))
    expect(transient(player.messages).length).toBeGreaterThan(0)
  })
  expect(captureCalls).toBe(5)
  expect(owner.messages).not.toContainEqual({ type: 'AUTHENTICATION_REQUIRED' })
})

it('drops previews without a third capture when the fresh capture also conflicts', async () => {
  const stub = newRoom()
  let captureCalls = 0
  await runInDurableObject(stub, () =>
    installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')], (call, capture) => {
      captureCalls = call
      return call === 3 || call === 5 ? new Response(null, { status: 409 }) : capture
    })
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  sendPreview(owner, tokenPreview(1))
  await vi.waitFor(() => expect(captureCalls).toBe(5))
  // Inside the retry window, later samples start no new rebuild.
  sendPreview(owner, tokenPreview(2))
  sendPreview(owner, tokenPreview(3))
  await noTransient(owner.messages)
  await noTransient(player.messages)
  expect(captureCalls).toBe(5)
})

/** A room whose Scene token takes its vision from a bound Character at revision A, then B. */
async function characterVisionRoom() {
  const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
  const characterId = '00000000-0000-4000-8000-000000000112'
  const revisionA = '00000000-0000-4000-8000-000000000113'
  const revisionB = '00000000-0000-4000-8000-000000000114'
  const run = {
    campaignId,
    encounterId: '00000000-0000-4000-8000-000000000115',
    expectedEncounterVersion: 1,
    expectedPresentationVersion: 1,
    expectedSceneVersion: 1,
    freshness: { campaign: null, play: null, system: null },
    sceneId,
    systemId: '00000000-0000-4000-8000-000000000111'
  }
  const binding = {
    ...run,
    actorId: '00000000-0000-4000-8000-000000000116',
    characterId,
    streamVersion: 0,
    tokenId
  }
  const room = {
    revisionA,
    revisionB,
    captures: [] as LiveSessionTransientCaptureInput[],
    visionRequests: [] as string[],
    visionChecks: 0,
    invalidations: 0,
    /** Set to change the Character: the next check or capture observing revision A is refused. */
    revisionChanged: false,
    /** Set to make the revision check fail. */
    visionUnavailable: false
  }
  let visionRevision = revisionA
  const stub = newRoom()
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      if (pathname === '/live-sessions/bootstrap') {
        return Response.json({
          activationFingerprint,
          persistedSequence: 0,
          persistedStateChecksum: activationFingerprint
        })
      }
      if (pathname === '/live-sessions/activate') {
        const body = (await request.json()) as { stateChecksum: string }
        const now = new Date().toISOString()
        return Response.json({
          activationFingerprint,
          campaignId,
          createdAt: now,
          epoch: authorityEpoch,
          persistedSequence: 0,
          persistedStateChecksum: body.stateChecksum,
          phase: 'DO_ACTIVE',
          updatedAt: now
        })
      }
      if (pathname === '/live-sessions/vision-revisions') {
        const body = liveSessionVisionRevisionsInputSchema.parse(await request.json())
        room.visionChecks += 1
        if (room.visionUnavailable) return new Response(null, { status: 503 })
        return Response.json({
          current:
            !room.revisionChanged &&
            body.observedCharacterRevisions.every(
              (revision) => revision.revision === visionRevision
            )
        })
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        room.captures.push(body)
        const origin = members.find((candidate) => candidate.userId === body.expectedUserId)
        if (!origin || origin.role !== body.expectedRole) return new Response(null, { status: 409 })
        if (
          room.revisionChanged &&
          body.observedCharacterRevisions.some((revision) => revision.revision === revisionA)
        ) {
          room.invalidations += 1
          room.revisionChanged = false
          visionRevision = revisionB
          return new Response(null, { status: 409 })
        }
        return Response.json(
          captureFor(
            origin.userId,
            origin.role,
            members.filter((candidate) => candidate.userId !== origin.userId)
          )
        )
      }
      const body = (await request.json()) as { request: { collection?: string; kind: string } }
      if (body.request.kind === 'ENTITIES')
        return Response.json({
          kind: 'ENTITIES',
          result: sceneCurrentEntityPageSchema.parse({
            collection: body.request.collection,
            next: null,
            page:
              body.request.collection === 'tokens'
                ? [
                    {
                      doorState: null,
                      ordinal: 0,
                      value: { collection: 'tokens', entity: { ...token, vision: null } }
                    }
                  ]
                : [],
            version: 1
          })
        })
      if (body.request.kind === 'FOG_LAYERS')
        return Response.json({
          kind: 'FOG_LAYERS',
          result: sceneFogLayersPageSchema.parse({
            continueCursor: '',
            isDone: true,
            page: [],
            version: 1
          })
        })
      if (body.request.kind === 'VISION_RUNS')
        return Response.json({
          kind: 'VISION_RUNS',
          result: sceneSessionVisionRunsPageSchema.parse({
            continueCursor: '',
            isDone: true,
            page: [run]
          })
        })
      if (body.request.kind === 'VISION_BINDINGS')
        return Response.json({
          kind: 'VISION_BINDINGS',
          result: sceneSessionVisionBindingsPageSchema.parse({
            continueCursor: '',
            isDone: true,
            page: [binding]
          })
        })
      if (body.request.kind === 'VISION_CHARACTER') {
        room.visionRequests.push(visionRevision)
        return Response.json({
          kind: 'VISION_CHARACTER',
          result: sceneSessionCharacterVisionResultSchema.parse({
            binding: {
              actorId: binding.actorId,
              characterId,
              encounterId: binding.encounterId,
              tokenId
            },
            characterRevision: visionRevision,
            characterVision: {
              characterId,
              dimRange: visionRevision === revisionA ? { amount: 10, unit: 'FEET' } : null
            },
            snapshotChecksum: '0000000000000000000000000000000000000000000000000000000000000000'
          })
        })
      }
      throw new Error(`Unexpected hydration request: ${body.request.kind}`)
    })
  })
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  await synchronize(owner)
  expect(room.visionRequests).toEqual([revisionA])
  owner.messages.length = 0
  player.messages.length = 0
  return { room, owner, player }
}

it('rechecks Character vision once in the background from half the lease and rehydrates a change (D33)', async () => {
  const advance = controlClock()
  const { room, owner, player } = await characterVisionRoom()
  const capturesAfterSync = room.captures.length

  // Within half the lease, GM and player previews reuse the checked revisions with no read.
  sendPreview(owner, tokenPreview(1))
  sendPreview(player, tokenPreview(1))
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(2)
    expect(transient(player.messages)).toHaveLength(2)
  })
  expect(transient(player.messages)).toContainEqual(
    expect.objectContaining({
      message: expect.objectContaining({
        userId: playerId,
        visionLayers: [expect.anything()]
      })
    })
  )
  expect(room.visionChecks).toBe(0)
  expect(room.captures).toHaveLength(capturesAfterSync)

  // The Character changes. From half the lease one background read finds it, while samples keep
  // the lease; the rebuild rehydrates the new vision.
  room.revisionChanged = true
  advance(15_001)
  player.messages.length = 0
  sendPreview(player, tokenPreview(2, { x: 25, y: 10 }))
  sendPreview(player, tokenPreview(3, { x: 30, y: 10 }))
  await vi.waitFor(() => expect(room.visionRequests).toEqual([room.revisionA, room.revisionB]))
  expect(room.visionChecks).toBe(1)
  expect(room.invalidations).toBe(1)
  let sequence = 3
  await vi.waitFor(() => {
    sequence += 1
    sendPreview(player, tokenPreview(sequence, { x: 30 + sequence, y: 10 }))
    expect(transient(player.messages).at(-1)).toMatchObject({ message: { visionLayers: [] } })
  })
  expect(room.visionChecks).toBe(1)
})

it('drops Character-vision previews once the lease passes without a confirmed check (D33)', async () => {
  const advance = controlClock()
  const { room, owner, player } = await characterVisionRoom()
  room.visionUnavailable = true
  advance(30_001)

  sendPreview(player, tokenPreview(1))
  await vi.waitFor(() => expect(room.visionChecks).toBe(1))
  await noTransient(player.messages)
  await noTransient(owner.messages)

  // Pointers carry no vision, so they still flow.
  sendPreview(player, pointerPreview(1))
  await vi.waitFor(() => expect(transient(owner.messages)).toHaveLength(1))
})

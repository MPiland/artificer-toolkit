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
import { liveRoomInputsInputSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  liveSessionTransientCaptureInputSchema,
  type LiveSessionTransientCapture,
  type LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  canonicalizeSceneFogLayer,
  createSceneFogAreaPatch,
  VTT_SCENE_LIMITS,
  type SceneFogLayer
} from '@artificer-toolkit/shared/vtt'

import { ROOM_LIMITS } from '../src/roomLimits.js'
import { characterSheetInputsFixture, darkvisionDefinition } from './characterSheetInputsFixture.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import {
  ROOM_INPUTS_PATH,
  rawSceneDefinitionInputs,
  rawSceneInputs,
  roomInputsResponse,
  type RoomSceneFixture
} from './roomInputsFixture.js'

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

function header(fogLayerCount = 0) {
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
    fogLayerCount,
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
    originBoundTokenControl: [],
    sceneHeader: header(),
    visionFreshness: { campaign: null, play: null, system: null }
  }
}

/** The presented Scene at version 1, without entities or fog. */
function emptyScene(): RoomSceneFixture['scene'] {
  return {
    ambientIllumination: 'DIM',
    annotations: [],
    barriers: [],
    darknessZones: [],
    doorStates: {},
    fogLayers: [],
    fogMode: 'PER_PLAYER',
    id: sceneId,
    lights: [],
    measurements: [],
    tokens: [],
    version: 1,
    visionRevealMode: 'ON_DRAG'
  }
}

/** Convex's room authorization beyond membership; tests change it to model assignments and grants. */
type RoomAuthorizationState = {
  assignments?: LiveSessionRoomAuthorization['campaign']['assignments']
  characterRevisions?: LiveSessionRoomAuthorization['revisions']['characters']
  play?: LiveSessionRoomAuthorization['play']
}

function installFetch(
  members: readonly ReturnType<typeof member>[],
  mutate?: (
    call: number,
    capture: LiveSessionTransientCapture,
    input: LiveSessionTransientCaptureInput
  ) => LiveSessionTransientCapture | Response | Promise<LiveSessionTransientCapture | Response>,
  entity: typeof token = token,
  fogLayers: readonly SceneFogLayer[] = [],
  authorization: RoomAuthorizationState = {}
) {
  let captures = 0
  const sceneFixture: RoomSceneFixture = {
    header: header(fogLayers.length),
    presentationVersion: 1,
    scene: { ...emptyScene(), fogLayers: [...fogLayers], tokens: [entity] }
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const pathname = new URL(request.url).pathname
    backendPaths.push(pathname)
    if (pathname === ROOM_AUTHORIZATION_PATH)
      return Response.json(roomAuthorizationResponse({ members, ...authorization }))
    if (pathname === ROOM_INPUTS_PATH) {
      const inputs = liveRoomInputsInputSchema.parse(await request.json())
      expect(inputs).toMatchObject({ campaignId, epoch: authorityEpoch })
      if (inputs.scope.kind === 'SCENE') return Response.json(rawSceneInputs(sceneFixture))
      if (inputs.scope.kind === 'SCENE_DEFINITION')
        return Response.json(rawSceneDefinitionInputs(sceneFixture))
      return Response.json(
        roomInputsResponse(inputs.scope, {
          campaignId,
          systemId: '00000000-0000-4000-8000-000000000111',
          ownerUserId: ownerId,
          members,
          assignments: authorization.assignments
        })
      )
    }
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
      const capture = {
        ...captureFor(
          origin.userId,
          origin.role,
          members.filter((candidate) => candidate.userId !== origin.userId)
        ),
        sceneHeader: header(fogLayers.length)
      }
      const result = (await mutate?.(++captures, capture, body)) ?? capture
      return result instanceof Response ? result : Response.json(result)
    }
    throw new Error(`Unexpected backend request: ${pathname}`)
  })
}

async function ticket(userId: string, role: 'OWNER' | 'PLAYER') {
  const now = Math.floor(Date.now() / 1_000)
  return new SignJWT({
    authSubject: `auth-${userId}`,
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

function ping(
  sequence: number,
  options: {
    audience?: 'GM' | 'TABLE'
    baselineVersion?: number
    position?: { x: number; y: number }
  } = {}
) {
  return {
    baselineVersion: options.baselineVersion ?? 1,
    audience: options.audience ?? 'TABLE',
    kind: 'PING' as const,
    position: options.position ?? { x: 15, y: 10 },
    sceneId,
    sequence
  }
}

function sendPreview(
  client: Awaited<ReturnType<typeof connect>>,
  envelope: ReturnType<typeof tokenPreview> | ReturnType<typeof ping>
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

const encounterId = '00000000-0000-4000-8000-000000000120'
const characterId = '00000000-0000-4000-8000-000000000121'
const actorId = '00000000-0000-4000-8000-000000000122'

/** The presented Scene's bound Encounter, with `tokenId` bound to one Character actor. */
function boundEncounter(controllerUserIds: string[] = []): LiveSessionRoomAuthorization['play'] {
  return {
    encounter: {
      encounterId,
      sceneId,
      healthDisplayDefault: 'HIDDEN',
      actors: [
        {
          id: actorId,
          kind: 'CHARACTER',
          sourceId: characterId,
          controllerUserIds,
          healthDisplay: null
        }
      ],
      tokens: [{ tokenId, actorId }]
    }
  }
}

/** A room whose presented Scene is bound to `boundEncounter`, answered from `authorization`. */
async function boundRoom(
  members: readonly ReturnType<typeof member>[],
  authorization: RoomAuthorizationState,
  entity: typeof token = token
) {
  const stub = newRoom()
  await runInDurableObject(stub, () =>
    installFetch(
      members,
      (_call, capture) => ({ ...capture, sceneEncounterId: encounterId }),
      entity,
      [],
      authorization
    )
  )
  const clients = await Promise.all(members.map((value) => connect(stub, value.userId, value.role)))
  await synchronize(clients[0]!)
  for (const client of clients) client.messages.length = 0
  backendPaths.length = 0
  return { clients, stub }
}

function invalidate(stub: DurableObjectStub, scopes: ('CAMPAIGN' | 'CHARACTER')[]) {
  return stub.fetch(
    new Request(`https://session.test${LIVE_SESSION_CONTROL_PATH}`, {
      body: JSON.stringify({ campaignId, operation: { type: 'INVALIDATE_INPUTS', scopes } }),
      method: 'POST'
    })
  )
}

it.each([
  ['is assigned', true],
  ['is not assigned', false]
] as const)(
  "answers bound-token previews of a player who %s the actor's Character from the authorization cache (D25)",
  async (_label, controlled) => {
    const advance = controlClock()
    const {
      clients: [owner, player]
    } = await boundRoom([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')], {
      assignments: [{ characterId, userId: controlled ? playerId : otherPlayerId }],
      play: boundEncounter()
    })

    for (const sequence of [1, 2, 3])
      sendPreview(player!, tokenPreview(sequence, { x: 10 + sequence * 5, y: 10 }))
    if (controlled)
      await vi.waitFor(() => {
        expect(transient(owner!.messages)).toHaveLength(3)
        expect(transient(player!.messages)).toHaveLength(3)
      })
    else {
      await noTransient(owner!.messages)
      await noTransient(player!.messages)
    }
    // No Convex call per sample, including long past the old 30 s preview lease.
    advance(60_000)
    sendPreview(player!, tokenPreview(4, { x: 35, y: 10 }))
    if (controlled) await vi.waitFor(() => expect(transient(owner!.messages)).toHaveLength(4))
    else await noTransient(owner!.messages)
    expect(backendPaths).toEqual([])

    // Past the authorization lease the sample is refused and one read renews the cache.
    advance(ROOM_LIMITS.authorizationLeaseMs - 60_000)
    sendPreview(player!, tokenPreview(5, { x: 40, y: 10 }))
    await vi.waitFor(() => expect(backendPaths).toEqual([ROOM_AUTHORIZATION_PATH]))
    if (!controlled) return
    await vi.waitFor(() => {
      sendPreview(player!, tokenPreview(6, { x: 45, y: 10 }))
      expect(transient(owner!.messages)).toHaveLength(5)
    })
    expect(backendPaths).toEqual([ROOM_AUTHORIZATION_PATH])
  }
)

it('moves bound-token control to the new assignee on a Campaign Character assignment change', async () => {
  const authorization: RoomAuthorizationState = {
    assignments: [{ characterId, userId: playerId }],
    play: boundEncounter()
  }
  const {
    clients: [owner, player, other],
    stub
  } = await boundRoom(
    [member(ownerId, 'OWNER'), member(playerId, 'PLAYER'), member(otherPlayerId, 'PLAYER')],
    authorization,
    // Both players see the token through its vision; the bound actor alone decides who drags it.
    { ...token, controlledByUserIds: [playerId, otherPlayerId] }
  )
  sendPreview(player!, tokenPreview(1))
  await vi.waitFor(() => expect(transient(owner!.messages)).toHaveLength(1))

  authorization.assignments = [{ characterId, userId: otherPlayerId }]
  expect(await (await invalidate(stub, ['CAMPAIGN'])).json()).toEqual({ invalidated: true })
  await vi.waitFor(() => expect(backendPaths).toEqual([ROOM_AUTHORIZATION_PATH]))
  owner!.messages.length = 0
  let sequence = 0
  await vi.waitFor(() => {
    sequence += 1
    sendPreview(other!, tokenPreview(sequence, { x: 10 + sequence, y: 10 }))
    expect(transient(owner!.messages).length).toBeGreaterThan(0)
  })
  sendPreview(player!, tokenPreview(2, { x: 30, y: 10 }))
  await new Promise((resolve) => setTimeout(resolve, 75))
  expect(
    transient(owner!.messages).filter((message) => message.message.userId === playerId)
  ).toEqual([])
  expect(backendPaths).toEqual([ROOM_AUTHORIZATION_PATH])
})

it("keeps a hidden bound token's drag preview from every player", async () => {
  const {
    clients: [owner, player, other]
  } = await boundRoom(
    [member(ownerId, 'OWNER'), member(playerId, 'PLAYER'), member(otherPlayerId, 'PLAYER')],
    { assignments: [{ characterId, userId: playerId }], play: boundEncounter() },
    { ...token, hidden: true }
  )
  sendPreview(owner!, tokenPreview(1))
  sendPreview(player!, tokenPreview(1))
  await noTransient(player!.messages)
  await noTransient(other!.messages)
  expect(backendPaths).toEqual([])
})
it.each([
  ['the cached Scene version', 1, true],
  ['a stale Scene version', 2, false]
] as const)(
  'fans out pings for %s without a backend call',
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

    sendPreview(owner, ping(1, { baselineVersion }))
    if (broadcasts)
      await vi.waitFor(() =>
        expect(transient(player.messages)).toEqual([
          expect.objectContaining({
            message: expect.objectContaining({
              envelope: expect.objectContaining({ kind: 'PING' }),
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
    sendPreview(owner, ping(sequence))
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
  ['a GM-audience ping', 'GM', false, 'PING', false],
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
      ...(kind === 'TOKEN' ? tokenPreview(1) : ping(1)),
      audience
    })
    await vi.waitFor(() => expect(transient(ownerElsewhere.messages)).toHaveLength(1))
    if (playerSees) await vi.waitFor(() => expect(transient(player.messages)).toHaveLength(1))
    else await noTransient(player.messages)
  }
)

/** Per-player fog in which only `otherPlayerId` has explored the map's top-left quarter. */
function otherPlayerFog(): SceneFogLayer {
  const { grid, map } = header(1)
  const patch = createSceneFogAreaPatch(
    { barriers: [], doorStates: {}, fogLayers: [], fogMode: 'PER_PLAYER', grid, map, tokens: [] },
    {
      explored: true,
      ownerUserId: otherPlayerId,
      rectangle: { a: { x: 0, y: 0 }, b: { x: 50, y: 50 } }
    }
  )
  if (!patch) throw new Error('Missing fog fixture.')
  return canonicalizeSceneFogLayer(patch)
}

async function pingRoom(members: readonly ReturnType<typeof member>[]) {
  const stub = newRoom()
  await runInDurableObject(stub, () => installFetch(members, undefined, token, [otherPlayerFog()]))
  const clients = await Promise.all(members.map((value) => connect(stub, value.userId, value.role)))
  await synchronize(clients[0]!)
  for (const client of clients) client.messages.length = 0
  backendPaths.length = 0
  return { clients, stub }
}

it.each([
  ['an explored point', { x: 20, y: 20 }, true],
  ['an unexplored point', { x: 80, y: 80 }, false]
] as const)(
  "delivers a player's ping at %s to the GM, and to another player only where their fog shows it",
  async (_label, position, otherSees) => {
    const {
      clients: [owner, player, other]
    } = await pingRoom([
      member(ownerId, 'OWNER'),
      member(playerId, 'PLAYER'),
      member(otherPlayerId, 'PLAYER')
    ])

    sendPreview(player!, ping(1, { position }))
    await vi.waitFor(() =>
      expect(transient(owner!.messages)).toEqual([
        { message: { envelope: ping(1, { position }), userId: playerId }, type: 'TRANSIENT' }
      ])
    )
    if (otherSees) await vi.waitFor(() => expect(transient(other!.messages)).toHaveLength(1))
    else await noTransient(other!.messages)
    // The pinging socket draws its own ring locally and gets no echo.
    await noTransient(player!.messages)
    expect(backendPaths).toEqual([])
  }
)

it.each([
  ['a private', 'GM', false],
  ['a shared', 'TABLE', true]
] as const)(
  'delivers %s GM ping to the GM elsewhere, and to players only when shared, whatever their fog',
  async (_label, audience, playersSee) => {
    const {
      clients: [owner, ownerElsewhere, player, other]
    } = await pingRoom([
      member(ownerId, 'OWNER'),
      member(ownerId, 'OWNER'),
      member(playerId, 'PLAYER'),
      member(otherPlayerId, 'PLAYER')
    ])

    sendPreview(owner!, ping(1, { audience, position: { x: 80, y: 80 } }))
    await vi.waitFor(() => expect(transient(ownerElsewhere!.messages)).toHaveLength(1))
    if (playersSee)
      await vi.waitFor(() => {
        expect(transient(player!.messages)).toHaveLength(1)
        expect(transient(other!.messages)).toHaveLength(1)
      })
    else {
      await noTransient(player!.messages)
      await noTransient(other!.messages)
    }
  }
)

it('drops a ping outside the map', async () => {
  const {
    clients: [owner, player]
  } = await pingRoom([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')])

  sendPreview(owner!, ping(1, { position: { x: 150, y: 10 } }))
  await noTransient(player!.messages)
})

it('rate-limits a ping flood per socket from room memory, with no backend call or storage write', async () => {
  const advance = controlClock()
  const {
    clients: [owner, player],
    stub
  } = await pingRoom([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')])
  const sql = await runInDurableObject(stub, (_instance, state) =>
    vi.spyOn(state.storage.sql, 'exec')
  )

  for (let sequence = 1; sequence <= 20; sequence += 1) sendPreview(player!, ping(sequence))
  await vi.waitFor(() => expect(transient(owner!.messages)).toHaveLength(1))
  await new Promise((resolve) => setTimeout(resolve, 75))
  expect(transient(owner!.messages).map((message) => message.message.envelope.sequence)).toEqual([
    1
  ])

  // The next interval admits one more ping, and the flood never closed the socket.
  advance(VTT_SCENE_LIMITS.pingIntervalMs)
  sendPreview(player!, ping(21))
  await vi.waitFor(() =>
    expect(transient(owner!.messages).map((message) => message.message.envelope.sequence)).toEqual([
      1, 21
    ])
  )
  expect(backendPaths).toEqual([])
  expect(sql).not.toHaveBeenCalled()
})

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
    // Past the authorization lease too: the first sample renews it, then samples flow.
    let sequence = 0
    await vi.waitFor(() => {
      sequence += 1
      sendPreview(player, tokenPreview(sequence, { x: 10 + sequence, y: 10 }))
      expect(transient(player.messages).length).toBeGreaterThan(0)
    })
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

/**
 * A room whose Scene token takes its vision from a bound Character at revision A (60 ft
 * Darkvision), then B (no Senses), composed from the room's own store.
 */
async function characterVisionRoom() {
  const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
  const characterId = '00000000-0000-4000-8000-000000000112'
  const bound = { campaignId, characterId, ownerUserId: playerId, scene: { sceneId, tokenId } }
  const revisionA = await characterSheetInputsFixture({ ...bound, darkvision: true })
  const revisionB = await characterSheetInputsFixture(bound)
  const { systemId, encounterId, actorId } = revisionA
  const room = {
    revisionA: revisionA.characterRevision,
    revisionB: revisionB.characterRevision,
    /** The Character's current CHARACTER revision in Convex. */
    revision: revisionA.characterRevision,
    captures: [] as LiveSessionTransientCaptureInput[],
    /** The CHARACTER revision of each Character page the room read. */
    characterReads: [] as string[],
    authorizationReads: 0,
    /** Captures refused because they observed a superseded Character revision. */
    staleCaptures: 0,
    /** Set to make the authorization read fail. */
    authorizationUnavailable: false
  }
  const sceneFixture: RoomSceneFixture = {
    header: header(),
    presentationVersion: 1,
    scene: { ...emptyScene(), tokens: [{ ...token, vision: null }] }
  }
  const stub = newRoom()
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      if (pathname === ROOM_INPUTS_PATH) {
        const inputs = liveRoomInputsInputSchema.parse(await request.json())
        expect(inputs).toMatchObject({ campaignId, epoch: authorityEpoch })
        if (inputs.scope.kind === 'SCENE') return Response.json(rawSceneInputs(sceneFixture))
        if (inputs.scope.kind === 'SCENE_DEFINITION')
          return Response.json(rawSceneDefinitionInputs(sceneFixture))
        if (inputs.scope.kind === 'CHARACTERS') room.characterReads.push(room.revision)
        const current = room.revision === room.revisionA ? revisionA : revisionB
        return Response.json(
          roomInputsResponse(inputs.scope, {
            campaignId,
            systemId,
            ownerUserId: ownerId,
            members,
            assignments: [{ characterId, userId: playerId }],
            characterInputs: { ...revisionA.characterInputs, parts: current.characterInputs.parts },
            definitions: [darkvisionDefinition]
          })
        )
      }
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
      if (pathname === ROOM_AUTHORIZATION_PATH) {
        room.authorizationReads += 1
        if (room.authorizationUnavailable) return new Response(null, { status: 503 })
        return Response.json(
          roomAuthorizationResponse({
            members,
            assignments: [{ characterId, userId: playerId }],
            characterRevisions: [{ characterId, revision: room.revision }],
            play: {
              encounter: {
                encounterId,
                sceneId,
                healthDisplayDefault: 'HIDDEN',
                actors: [
                  {
                    id: actorId,
                    kind: 'CHARACTER',
                    sourceId: characterId,
                    controllerUserIds: [],
                    healthDisplay: null
                  }
                ],
                tokens: [{ tokenId, actorId }]
              }
            }
          })
        )
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        room.captures.push(body)
        const origin = members.find((candidate) => candidate.userId === body.expectedUserId)
        if (!origin || origin.role !== body.expectedRole) return new Response(null, { status: 409 })
        if (
          body.observedCharacterRevisions.some((observed) => observed.revision !== room.revision)
        ) {
          room.staleCaptures += 1
          return new Response(null, { status: 409 })
        }
        return Response.json({
          ...captureFor(
            origin.userId,
            origin.role,
            members.filter((candidate) => candidate.userId !== origin.userId)
          ),
          systemId,
          sceneEncounterId: encounterId
        })
      }
      throw new Error(`Unexpected backend request: ${pathname}`)
    })
  })
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  await synchronize(owner)
  expect(room.characterReads).toEqual([room.revisionA])
  owner.messages.length = 0
  player.messages.length = 0
  return { room, owner, player, stub }
}

it('rehydrates Character vision after a CHARACTER notice, with no read per sample (D33)', async () => {
  const advance = controlClock()
  const { room, owner, player, stub } = await characterVisionRoom()
  const capturesAfterSync = room.captures.length
  const readsAfterSync = room.authorizationReads

  // GM and player previews use the cached revisions with no read, even past the old 30 s lease.
  advance(60_000)
  sendPreview(owner, tokenPreview(1))
  sendPreview(player, tokenPreview(1))
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(2)
    expect(transient(player.messages)).toHaveLength(2)
  })
  expect(transient(player.messages)).toContainEqual(
    expect.objectContaining({
      message: expect.objectContaining({ userId: playerId, visionLayers: [expect.anything()] })
    })
  )
  expect(room.authorizationReads).toBe(readsAfterSync)
  expect(room.captures).toHaveLength(capturesAfterSync)

  // The Character changes and Convex notifies the room: the cache reloads, then the Scene's vision.
  room.revision = room.revisionB
  await invalidate(stub, ['CHARACTER'])
  player.messages.length = 0
  let sequence = 1
  await vi.waitFor(() => {
    sequence += 1
    sendPreview(player, tokenPreview(sequence, { x: 20 + sequence, y: 10 }))
    expect(transient(player.messages).at(-1)).toMatchObject({ message: { visionLayers: [] } })
  })
  expect(room.characterReads).toEqual([room.revisionA, room.revisionB])
  expect(room.staleCaptures).toBe(1)
  const readsAfterRebuild = room.authorizationReads
  sendPreview(player, tokenPreview(sequence + 1, { x: 40, y: 10 }))
  await vi.waitFor(() =>
    expect(transient(player.messages).at(-1)?.message.envelope.sequence).toBe(sequence + 1)
  )
  expect(room.authorizationReads).toBe(readsAfterRebuild)
})

it('refuses previews and pings while the authorization cache cannot be renewed', async () => {
  const advance = controlClock()
  const { room, owner, player } = await characterVisionRoom()
  room.authorizationUnavailable = true
  advance(ROOM_LIMITS.authorizationLeaseMs)

  sendPreview(player, tokenPreview(1))
  sendPreview(player, ping(1))
  await vi.waitFor(() => expect(room.authorizationReads).toBeGreaterThan(2))
  await noTransient(player.messages)
  await noTransient(owner.messages)

  // After the retry window one read renews the cache, and broadcasts resume.
  room.authorizationUnavailable = false
  advance(ROOM_LIMITS.previewRetryMs)
  await vi.waitFor(() => {
    sendPreview(player, ping(2))
    expect(transient(owner.messages)).toHaveLength(1)
  })
})

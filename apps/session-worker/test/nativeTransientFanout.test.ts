import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
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
import { liveSessionCheckpointRequestSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { liveRoomInputsInputSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  liveSessionRoomSceneCaptureInputSchema,
  liveSessionTransientCaptureInputSchema,
  type LiveSessionRoomSceneCapture,
  type LiveSessionRoomSceneCaptureInput,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  canonicalizeSceneFogLayer,
  createSceneFogAreaPatch,
  VTT_SCENE_LIMITS,
  type SceneFogLayer
} from '@artificer-toolkit/shared/vtt'

import { ROOM_LIMITS } from '../src/roomLimits.js'
import { NO_CHECKPOINT_IO } from './checkpointIoFixture.js'
import { characterSheetInputsFixture } from './characterSheetInputsFixture.js'
import { darkvisionDefinition } from './srdSenseInputsFixture.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import {
  ROOM_INPUTS_PATH,
  rawSceneDefinitionInputs,
  rawSceneInputs,
  roomInputsResponse,
  type RoomSceneFixture
} from './roomInputsFixture.js'
import { roomStub } from './roomTeardown.js'

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
/** The `Authorization` header of each room Scene capture, which must carry no user token. */
const sceneCaptureAuthorizations: (string | null)[] = []
const realNow = Date.now

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
  backendPaths.length = 0
  sceneCaptureAuthorizations.length = 0
  vi.restoreAllMocks()
})

/** Lets a test move the room's clock forward while real time keeps running. */
/** Moves the room's clock forward on demand; a `frozenAt` clock also stands still between advances. */
function controlClock(frozenAt?: number) {
  let offset = 0
  vi.spyOn(Date, 'now').mockImplementation(() => (frozenAt ?? realNow()) + offset)
  return (milliseconds: number) => {
    offset += milliseconds
  }
}

function newRoom() {
  return roomStub(`${campaignId}:${crypto.randomUUID()}`)
}

function member(userId: string, role: 'OWNER' | 'PLAYER', epoch = '2026-09-12T00:00:00.000Z') {
  return { membershipEpoch: epoch, role, userId }
}

function header(fogLayerCount = 0, visionRevealMode: 'ON_DRAG' | 'ON_DROP' = 'ON_DRAG') {
  return sceneLiveStateHeaderSchema.parse({
    ambientIllumination: 'DIM',
    daylight: false,
    campaignId,
    counts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 1
    },
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
    visionRevealMode
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
  senses: [],
  vision: {
    angleDegrees: 360,
    brightRange: 0,
    dimRange: 10,
    directionDegrees: 0,
    enabled: true
  },
  width: 5
}

function memberCapture(origin: ReturnType<typeof member>): LiveSessionTransientCapture {
  return {
    campaignId,
    origin,
    presentation: { campaignId, sceneId, version: 1 },
    sceneEncounterId: null,
    sceneHeader: header()
  }
}

function roomSceneCapture(
  observedCharacterRevisions: LiveSessionRoomSceneCapture['observedCharacterRevisions']
): LiveSessionRoomSceneCapture {
  return {
    campaignId,
    systemId: '00000000-0000-4000-8000-000000000111',
    observedCharacterRevisions,
    presentation: { campaignId, sceneId, version: 1 },
    sceneEncounterId: null,
    sceneHeader: header(),
    visionFreshness: { campaign: null, play: null, system: null }
  }
}

/** The presented Scene at version 1, without entities or fog. */
function emptyScene(): RoomSceneFixture['scene'] {
  return {
    ambientIllumination: 'DIM',
    daylight: false,
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
  /** Answers the room's Scene captures, numbered from 1; cold admission captures are not counted. */
  mutate?: (
    call: number,
    capture: LiveSessionRoomSceneCapture,
    input: LiveSessionRoomSceneCaptureInput
  ) => LiveSessionRoomSceneCapture | Response | Promise<LiveSessionRoomSceneCapture | Response>,
  entity: typeof token = token,
  fogLayers: readonly SceneFogLayer[] = [],
  authorization: RoomAuthorizationState = {},
  visionRevealMode: 'ON_DRAG' | 'ON_DROP' = 'ON_DRAG'
) {
  let captures = 0
  const sceneFixture: RoomSceneFixture = {
    header: header(fogLayers.length, visionRevealMode),
    presentationVersion: 1,
    scene: { ...emptyScene(), fogLayers: [...fogLayers], tokens: [entity], visionRevealMode }
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
      return Response.json(memberCapture(origin))
    }
    if (pathname === '/live-sessions/room-scene-capture') {
      const body = liveSessionRoomSceneCaptureInputSchema.parse(await request.json())
      sceneCaptureAuthorizations.push(request.headers.get('authorization'))
      const capture = {
        ...roomSceneCapture(body.observedCharacterRevisions),
        sceneHeader: header(fogLayers.length, visionRevealMode)
      }
      const result = (await mutate?.(++captures, capture, body)) ?? capture
      return result instanceof Response ? result : Response.json(result)
    }
    // A bound Scene's first composition stages the Run's initial inputs, which the room then saves.
    if (pathname === '/live-sessions/checkpoint') return committedCheckpoint(request)
    throw new Error(`Unexpected backend request: ${pathname}`)
  })
}

async function committedCheckpoint(request: Request) {
  const body = liveSessionCheckpointRequestSchema.parse(await request.json())
  const now = new Date().toISOString()
  return Response.json({
    status: 'COMMITTED',
    authority: {
      activationFingerprint,
      campaignId,
      createdAt: now,
      epoch: body.epoch,
      persistedSequence: body.sequence,
      persistedStateChecksum: body.checksum,
      phase: 'DO_ACTIVE',
      updatedAt: now
    },
    adopted: { characters: [] },
    io: NO_CHECKPOINT_IO
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
  return backendPaths.filter((path) => path === '/live-sessions/room-scene-capture').length
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

/** Asks the room for its state, which carries the Scene the room built on admission. */
async function synchronize(client: Awaited<ReturnType<typeof connect>>) {
  client.messages.length = 0
  client.socket.send(JSON.stringify({ lastAppliedSequence: 0, type: 'RESUME' }))
  await vi.waitFor(() =>
    expect(
      client.messages.some(
        (message) => message.type === 'STATE_SYNC' && message.state.scene?.id === sceneId
      )
    ).toBe(true)
  )
}

/** The Senses `client` is shown on the bound token in a fresh `STATE_SYNC`. */
async function syncedTokenSenses(client: Awaited<ReturnType<typeof connect>>) {
  await synchronize(client)
  const sync = client.messages.find(
    (message): message is Extract<LiveSessionWebSocketServerMessageDto, { type: 'STATE_SYNC' }> =>
      message.type === 'STATE_SYNC'
  )
  return sync?.state.scene?.tokens.find(({ id }) => id === tokenId)?.senses
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
  // The state request itself reads the journal, so the spy sees the room's storage.
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

it('keeps fanning previews out after a hibernated room wakes within its lease, with no backend call', async () => {
  const stub = newRoom()
  await runInDurableObject(stub, () =>
    installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')])
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  await synchronize(owner)
  await evictDurableObject(stub)
  backendPaths.length = 0
  owner.messages.length = 0
  player.messages.length = 0

  // The first sample after the wake is not dropped, and no socket is challenged.
  sendPreview(player, tokenPreview(1, { x: 15, y: 10 }))
  await vi.waitFor(() => expect(transient(owner.messages)).toHaveLength(1))
  expect(owner.messages).not.toContainEqual({
    type: 'AUTHENTICATION_REQUIRED'
  })
  expect(player.messages).not.toContainEqual({
    type: 'AUTHENTICATION_REQUIRED'
  })
  expect(backendPaths).toEqual([])
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
      body: JSON.stringify({
        campaignId,
        operation: { type: 'INVALIDATE_INPUTS', scopes }
      }),
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
    // No Convex call per sample within the authorization lease.
    advance(ROOM_LIMITS.authorizationLeaseMs / 4)
    sendPreview(player!, tokenPreview(4, { x: 35, y: 10 }))
    if (controlled) await vi.waitFor(() => expect(transient(owner!.messages)).toHaveLength(4))
    else await noTransient(owner!.messages)
    expect(backendPaths).toEqual([])

    // Past the authorization lease the sample is refused and one read renews the cache.
    advance((ROOM_LIMITS.authorizationLeaseMs * 3) / 4)
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
  expect(await (await invalidate(stub, ['CAMPAIGN'])).json()).toEqual({
    invalidated: true
  })
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
    {
      assignments: [{ characterId, userId: playerId }],
      play: boundEncounter()
    },
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
  sceneCaptureAuthorizations.length = 0
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
  expect(sceneCaptureAuthorizations).toEqual([null, null])
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
    {
      barriers: [],
      doorStates: {},
      fogLayers: [],
      fogMode: 'PER_PLAYER',
      grid,
      map,
      tokens: []
    },
    {
      explored: true,
      ownerUserId: otherPlayerId,
      rectangle: { a: { x: 0, y: 0 }, b: { x: 50, y: 50 } }
    }
  )
  if (!patch) throw new Error('Missing fog fixture.')
  return canonicalizeSceneFogLayer(patch)
}

it.each([
  ['ON_DRAG', { origin: [playerId], recipients: { owner: [playerId], other: [] } }],
  ['ON_DROP', { origin: [], recipients: { owner: [], other: [] } }]
] as const)(
  "limits the dragging controller's vision layers to the origin and the GM, never another player, in a %s Scene",
  async (visionRevealMode, expected) => {
    const members = [
      member(ownerId, 'OWNER'),
      member(playerId, 'PLAYER'),
      member(otherPlayerId, 'PLAYER')
    ]
    const stub = newRoom()
    // `other` has explored the token's destination but does not control the token.
    await runInDurableObject(stub, () =>
      installFetch(members, undefined, token, [otherPlayerFog()], {}, visionRevealMode)
    )
    const [owner, player, other] = await Promise.all([
      connect(stub, ownerId, 'OWNER'),
      connect(stub, playerId, 'PLAYER'),
      connect(stub, otherPlayerId, 'PLAYER')
    ])
    await synchronize(owner)
    for (const client of [owner, player, other]) client.messages.length = 0

    sendPreview(player, tokenPreview(1))
    await vi.waitFor(() => {
      expect(transient(player.messages)).toHaveLength(1)
      expect(transient(owner.messages)).toHaveLength(1)
      expect(transient(other.messages)).toHaveLength(1)
    })
    const layerOwners = (client: typeof owner) =>
      transient(client.messages)[0]?.message.visionLayers?.map(({ ownerUserId }) => ownerUserId)
    expect(transient(player.messages)[0]?.message.tokenDragResolution).toMatchObject({
      accepted: true
    })
    expect(layerOwners(player)).toEqual(expected.origin)
    expect(layerOwners(owner)).toEqual(expected.recipients.owner)
    expect(layerOwners(other)).toEqual(expected.recipients.other)
  }
)

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
        {
          message: { envelope: ping(1, { position }), userId: playerId },
          type: 'TRANSIENT'
        }
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
  // A frozen clock refills the ping budget only when the test advances it, however slow the run.
  const advance = controlClock(Date.now())
  const {
    clients: [owner, player],
    stub
  } = await pingRoom([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')])
  const sql = await runInDurableObject(stub, (_instance, state) =>
    vi.spyOn(state.storage.sql, 'exec')
  )
  // The barrier below is a RESUME, which reads the session authority; pings add no statement to it.
  await synchronize(player!)
  const resumeStatements = sql.mock.calls.slice()
  sql.mockClear()

  for (let sequence = 1; sequence <= 20; sequence += 1) sendPreview(player!, ping(sequence))
  // The room answers the player's RESUME only after every ping that socket sent before it.
  await synchronize(player!)
  await vi.waitFor(() => expect(transient(owner!.messages)).toHaveLength(1))
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
  expect(sql.mock.calls).toEqual(resumeStatements)
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
        expect(owner.messages).toContainEqual({
          type: 'AUTHENTICATION_REQUIRED'
        })
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
      expect(owner.messages).toContainEqual({
        type: 'AUTHENTICATION_REQUIRED'
      })
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
      if (call === 2) expect(input.observedCharacterRevisions).toEqual([])
      return call === 1 ? new Response(null, { status: 409 }) : capture
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
  expect(captureCalls).toBe(3)
  expect(owner.messages).not.toContainEqual({
    type: 'AUTHENTICATION_REQUIRED'
  })
})

/** Wakes the room with admitted sockets but no Scene cache, as after a failed restore. */
async function dropSavedSceneCache(stub: DurableObjectStub) {
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec('DELETE FROM room_scene_cache')
  })
  await evictDurableObject(stub)
}

it('drops previews without a third capture when the fresh capture also conflicts', async () => {
  const stub = newRoom()
  let captureCalls = 0
  let admittedCalls: number | null = null
  await runInDurableObject(stub, () =>
    installFetch([member(ownerId, 'OWNER'), member(playerId, 'PLAYER')], (call, capture) => {
      captureCalls = call
      if (admittedCalls === null) return capture
      const sincePreview = call - admittedCalls
      return sincePreview === 1 || sincePreview === 3
        ? new Response(null, { status: 409 })
        : capture
    })
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  // Admission builds the Scene cache; the conflicts start with the rebuild of a woken room that kept none.
  await dropSavedSceneCache(stub)
  const admitted = captureCalls
  admittedCalls = admitted
  sendPreview(owner, tokenPreview(1))
  await vi.waitFor(() => expect(captureCalls).toBe(admitted + 3))
  // Inside the retry window, later samples start no new rebuild.
  sendPreview(owner, tokenPreview(2))
  sendPreview(owner, tokenPreview(3))
  await noTransient(owner.messages)
  await noTransient(player.messages)
  expect(captureCalls).toBe(admitted + 3)
})

/**
 * A room whose Scene token takes its vision from a bound Character at revision A (60 ft
 * Darkvision), then B (no Senses), composed from the room's own store.
 */
async function characterVisionRoom() {
  const members = [
    member(ownerId, 'OWNER'),
    member(playerId, 'PLAYER'),
    member(otherPlayerId, 'PLAYER')
  ]
  const characterId = '00000000-0000-4000-8000-000000000112'
  const bound = {
    campaignId,
    characterId,
    ownerUserId: playerId,
    scene: { sceneId, tokenId }
  }
  const revisionA = await characterSheetInputsFixture({
    ...bound,
    darkvision: true
  })
  const revisionB = await characterSheetInputsFixture(bound)
  const { systemId, encounterId, actorId } = revisionA
  const room = {
    encounterId,
    actorId,
    encounterVersion: revisionA.characterInputs.run.encounterVersion,
    revisionA: revisionA.characterRevision,
    revisionB: revisionB.characterRevision,
    /** The Character's current CHARACTER revision in Convex. */
    revision: revisionA.characterRevision,
    captures: [] as LiveSessionRoomSceneCaptureInput[],
    /** The player Convex reports as assigned the Character, who therefore controls its token. */
    assigneeUserId: playerId as string,
    /** The CHARACTER revision of each Character page the room read. */
    characterReads: [] as string[],
    authorizationReads: 0,
    /** Captures refused because they observed a superseded Character revision. */
    staleCaptures: 0,
    /** Set to make the authorization read fail. */
    authorizationUnavailable: false,
    /** The Encounter Convex reports as bound to the presented Scene. */
    sceneEncounterId: encounterId as string | null,
    /** Whether the Run is still open: a COMPLETEd Run is gone from Convex's Scene authorization. */
    runOpen: true
  }
  const sceneFixture: RoomSceneFixture = {
    header: header(),
    presentationVersion: 1,
    // The Scene lists both players; only the assigned one controls the bound actor.
    scene: {
      ...emptyScene(),
      tokens: [{ ...token, controlledByUserIds: [playerId, otherPlayerId], vision: null }]
    }
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
            assignments: [{ characterId, userId: room.assigneeUserId }],
            characterInputs: {
              ...revisionA.characterInputs,
              parts: current.characterInputs.parts
            },
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
            assignments: [{ characterId, userId: room.assigneeUserId }],
            characterRevisions: [{ characterId, revision: room.revision }],
            play: {
              encounter: room.runOpen
                ? {
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
                : null
            }
          })
        )
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        const origin = members.find((candidate) => candidate.userId === body.expectedUserId)
        if (!origin || origin.role !== body.expectedRole) return new Response(null, { status: 409 })
        return Response.json(memberCapture(origin))
      }
      if (pathname === '/live-sessions/room-scene-capture') {
        const body = liveSessionRoomSceneCaptureInputSchema.parse(await request.json())
        room.captures.push(body)
        if (
          body.observedCharacterRevisions.some((observed) => observed.revision !== room.revision)
        ) {
          room.staleCaptures += 1
          return new Response(null, { status: 409 })
        }
        return Response.json({
          ...roomSceneCapture(body.observedCharacterRevisions),
          systemId,
          sceneEncounterId: room.sceneEncounterId
        })
      }
      if (pathname === '/live-sessions/checkpoint') return committedCheckpoint(request)
      throw new Error(`Unexpected backend request: ${pathname}`)
    })
  })
  const [owner, player, other] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER'),
    connect(stub, otherPlayerId, 'PLAYER')
  ])
  const admittedSenses = await syncedTokenSenses(owner)
  expect(room.characterReads).toEqual([room.revisionA])
  owner.messages.length = 0
  player.messages.length = 0
  return { admittedSenses, room, owner, player, other, stub }
}

/** Revision A's 60 ft Darkvision, as the bound token's Senses carry it. */
const darkvisionSenses = [
  expect.objectContaining({
    channel: 'VISUAL',
    illuminationAccess: 'ORDINARY_DARKNESS',
    label: 'Darkvision',
    range: { rangeKind: 'DISTANCE', amount: 60 }
  })
]

it('rehydrates Character vision after a CHARACTER notice, with no read per sample (D33)', async () => {
  const advance = controlClock()
  const { admittedSenses, room, owner, player, stub } = await characterVisionRoom()
  const capturesAfterSync = room.captures.length
  const readsAfterSync = room.authorizationReads

  // GM and player previews use the cached revisions with no read within the authorization lease.
  advance(ROOM_LIMITS.authorizationLeaseMs / 4)
  sendPreview(owner, tokenPreview(1))
  sendPreview(player, tokenPreview(1))
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(2)
    expect(transient(player.messages)).toHaveLength(2)
  })
  // Vision is authored only; the bound Character's Darkvision reaches the token as Senses.
  expect(admittedSenses).toEqual(darkvisionSenses)
  expect(room.authorizationReads).toBe(readsAfterSync)
  expect(room.captures).toHaveLength(capturesAfterSync)

  // The Character changes and Convex notifies the room: the cache reloads, then the Scene's Senses.
  room.revision = room.revisionB
  await invalidate(stub, ['CHARACTER'])
  player.messages.length = 0
  let sequence = 1
  await vi.waitFor(async () => {
    sequence += 1
    sendPreview(player, tokenPreview(sequence, { x: 20 + sequence, y: 10 }))
    expect(await syncedTokenSenses(owner)).toEqual([])
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

it('composes Scene vision without a Run that COMPLETEd, so the next Scene command still commits', async () => {
  const { admittedSenses, room, owner, player } = await characterVisionRoom()
  sendPreview(player, tokenPreview(1))
  await vi.waitFor(() => expect(transient(player.messages)).toHaveLength(1))
  expect(admittedSenses).toEqual(darkvisionSenses)

  const encounterCommand = async (
    expectedSessionSequence: number,
    command: Record<string, unknown>
  ) => {
    const commandId = crypto.randomUUID()
    owner.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence,
        command: {
          scope: 'ENCOUNTER',
          command: { ...command, encounterId: room.encounterId, commandId }
        }
      })
    )
    await vi.waitFor(() =>
      expect(owner.messages).toContainEqual(
        expect.objectContaining({ type: 'COMMAND_COMMITTED', commandId })
      )
    )
  }
  await encounterCommand(0, {
    type: 'SET_CURRENT_ACTOR',
    expectedVersion: room.encounterVersion,
    actorId: room.actorId
  })
  await encounterCommand(1, {
    type: 'COMPLETE',
    expectedVersion: room.encounterVersion + 1
  })
  // COMPLETE deleted the Run's rows and Scene binding; Convex's Scene authorization agrees.
  room.runOpen = false
  room.sceneEncounterId = null

  const moveId = crypto.randomUUID()
  owner.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 2,
      command: {
        scope: 'SCENE',
        command: {
          type: 'MOVE_SCENE_TOKEN',
          commandId: moveId,
          correlationId: null,
          expectedEncounterVersion: null,
          expectedSceneVersion: 1,
          movementKind: 'VOLUNTARY',
          path: [token.position, { x: 20, y: 10 }],
          sceneId,
          tokenId
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(owner.messages).toContainEqual(
      expect.objectContaining({ type: 'COMMAND_COMMITTED', commandId: moveId })
    )
  )
  // The finished Run no longer lends the token Character Senses.
  player.messages.length = 0
  sendPreview(player, {
    ...tokenPreview(2, { x: 25, y: 10 }),
    baselineVersion: 2
  })
  await vi.waitFor(() => expect(transient(player.messages)).toHaveLength(1))
  expect(await syncedTokenSenses(owner)).toEqual([])
})

it('withholds a bound token senses from a player the Scene lists who does not control the bound actor (ADR 0034)', async () => {
  const { admittedSenses, room, owner, other } = await characterVisionRoom()
  // The GM's projection carries the Sense the Character's Darkvision composes onto the token.
  expect(admittedSenses).toEqual(darkvisionSenses)

  const commandId = crypto.randomUUID()
  other.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'SCENE',
        command: {
          type: 'MOVE_SCENE_TOKEN',
          commandId,
          correlationId: null,
          expectedEncounterVersion: room.encounterVersion,
          expectedSceneVersion: 1,
          movementKind: 'VOLUNTARY',
          path: [token.position, { x: 20, y: 10 }],
          sceneId,
          tokenId
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(other.messages).toContainEqual(
      expect.objectContaining({ type: 'COMMAND_REJECTED', commandId })
    )
  )
  const rejected = other.messages.find(
    (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandId
  )
  if (rejected?.type !== 'COMMAND_REJECTED' || rejected.correction?.scope !== 'SCENE')
    throw new Error('Missing the private Scene correction.')
  expect(rejected.correction.state.tokens.find(({ id }) => id === tokenId)?.senses).toEqual([])
  expect(await syncedTokenSenses(owner)).toEqual(darkvisionSenses)
})

it('withholds a bound token senses from a player once the Character is reassigned away from them (ADR 0034)', async () => {
  const { admittedSenses, room, owner, player, other, stub } = await characterVisionRoom()
  expect(admittedSenses).toEqual(darkvisionSenses)
  // The assigned player controls the bound token, so they see the Sense composed onto it.
  expect(await syncedTokenSenses(player)).toEqual(darkvisionSenses)
  expect(await syncedTokenSenses(other)).toEqual([])

  // An assigned Character actor's control follows the assignment, not its controller list, so
  // reassigning the Character is what ends this player's control.
  room.assigneeUserId = otherPlayerId
  expect(await (await invalidate(stub, ['CAMPAIGN'])).json()).toEqual({ invalidated: true })
  await vi.waitFor(async () => {
    expect(await syncedTokenSenses(player)).toEqual([])
  })
  expect(await syncedTokenSenses(owner)).toEqual(darkvisionSenses)
  expect(await syncedTokenSenses(other)).toEqual(darkvisionSenses)
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

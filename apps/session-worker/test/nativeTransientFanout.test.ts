import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
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
  type LiveSessionTransientCapture,
  type LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { NativeSocketTransientState } from '../src/nativeSocketTransientState.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const campaignId = '00000000-0000-4000-8000-000000000101'
const authorityEpoch = '00000000-0000-4000-8000-000000000112'
const activationFingerprint = 'a'.repeat(64)
const sessionId = '00000000-0000-4000-8000-000000000102'
const sceneId = '00000000-0000-4000-8000-000000000103'
const ownerId = '00000000-0000-4000-8000-000000000104'
const playerId = '00000000-0000-4000-8000-000000000105'
const otherPlayerId = '00000000-0000-4000-8000-000000000106'
const tokenId = '00000000-0000-4000-8000-000000000107'
const sockets: WebSocket[] = []

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
  vi.restoreAllMocks()
})

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
    presentation: { sceneId, sessionId, version: 1 },
    recipients: [...recipients],
    sceneEncounterBound: false,
    sceneHeader: header(),
    session: { id: sessionId, version: 1 },
    visionFreshness: { campaign: null, session: null, system: null }
  }
}

function installFetch(
  members: readonly ReturnType<typeof member>[],
  mutate?: (
    call: number,
    capture: LiveSessionTransientCapture,
    input: LiveSessionTransientCaptureInput
  ) => LiveSessionTransientCapture | Response | Promise<LiveSessionTransientCapture | Response>
) {
  let captures = 0
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
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
        sessionId,
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
              ? [{ doorState: null, ordinal: 0, value: { collection: 'tokens', entity: token } }]
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
    sessionId,
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
    new Request(`https://session.test/live-session/${sessionId}`, {
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

function tokenPreview(sequence: number, position = { x: 20, y: 10 }) {
  return {
    baselineVersion: 1,
    kind: 'TOKEN_DRAG_PREVIEW' as const,
    position,
    sceneId,
    sequence,
    tokenId
  }
}

it('fans out synchronized token previews from room memory without per-sample backend reads', async () => {
  const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(campaignId + ':' + crypto.randomUUID())
  )
  let captureCalls = 0
  await runInDurableObject(stub, () =>
    installFetch(members, (call, capture) => {
      captureCalls = call
      return capture
    })
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])

  owner.socket.send(
    JSON.stringify({
      expectedPresentationVersion: 1,
      expectedSessionVersion: 1,
      sceneId,
      type: 'SYNCHRONIZE_SCENE',
      version: 1
    })
  )
  await vi.waitFor(() => expect(captureCalls).toBe(4))
  owner.messages.length = 0
  player.messages.length = 0

  player.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
  player.socket.send(
    JSON.stringify({
      type: 'TRANSIENT',
      envelope: tokenPreview(2, { x: 30, y: 10 })
    })
  )
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(2)
    expect(transient(player.messages)).toHaveLength(2)
  })
  expect(captureCalls).toBe(4)
})
it.each([
  ['current authority', 'current', true],
  ['a stale Scene version', 'scene', false],
  ['a changed origin membership', 'origin', false],
  ['a missing current recipient', 'recipient', false]
] as const)('fans out pointer previews once for %s', async (_label, state, broadcasts) => {
  const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
  let captureCalls = 0
  let pointerCaptureMode: LiveSessionTransientCaptureInput['mode']
  await runInDurableObject(stub, () =>
    installFetch(members, (call, capture, input) => {
      captureCalls = call
      if (call === 3) pointerCaptureMode = input.mode
      if (call !== 3) return capture
      if (state === 'scene')
        return { ...capture, sceneHeader: { ...capture.sceneHeader!, version: 2 } }
      if (state === 'origin')
        return {
          ...capture,
          origin: { ...capture.origin, membershipEpoch: '2026-09-12T01:00:00.000Z' }
        }
      if (state === 'recipient') return { ...capture, recipients: [] }
      return capture
    })
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  const requestsBefore = await runInDurableObject(
    stub,
    () => vi.mocked(globalThis.fetch).mock.calls.length
  )

  owner.socket.send(
    JSON.stringify({
      type: 'TRANSIENT',
      envelope: {
        baselineVersion: 1,
        kind: 'POINTER_PREVIEW',
        position: { x: 15, y: 10 },
        sceneId,
        sequence: 1
      }
    })
  )
  await vi.waitFor(() => expect(captureCalls).toBe(3))
  const requestPaths = await runInDurableObject(stub, () =>
    vi
      .mocked(globalThis.fetch)
      .mock.calls.slice(requestsBefore)
      .map(([input, init]) => new URL(new Request(input, init).url).pathname)
  )

  expect(requestPaths).toEqual(['/live-sessions/capture'])
  expect(pointerCaptureMode).toBe('AUTHORITY')
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
})
it('fans out controlled token previews and per-player fog only to current authorized members', async () => {
  const members = [
    member(ownerId, 'OWNER'),
    member(playerId, 'PLAYER'),
    member(otherPlayerId, 'PLAYER')
  ]
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${sessionId}`)
  )
  const captureModes: LiveSessionTransientCaptureInput['mode'][] = []
  await runInDurableObject(stub, () =>
    installFetch(members, (_call, capture, input) => {
      captureModes.push(input.mode)
      return capture
    })
  )
  const [owner, player, other] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER'),
    connect(stub, otherPlayerId, 'PLAYER')
  ])
  captureModes.length = 0

  player.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
  await vi.waitFor(() => {
    expect(transient(owner.messages)).toHaveLength(1)
    expect(transient(player.messages)).toHaveLength(1)
    expect(transient(other.messages)).toHaveLength(0)
  })

  owner.messages.length = 0
  player.messages.length = 0
  other.messages.length = 0
  owner.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
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
  expect(captureModes.length).toBeGreaterThan(0)
  expect(new Set(captureModes)).toEqual(new Set(['FULL']))
})

it.each(['origin', 'recipient'] as const)(
  'sends nothing when capture changes the current %s membership epoch',
  async (changed) => {
    const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
    const stub = env.LIVE_SESSION_ROOMS.get(
      env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
    )
    let captureCalls = 0
    await runInDurableObject(stub, () =>
      installFetch(members, (call, capture) => {
        captureCalls = call
        if (call < 4) return capture
        if (changed === 'origin')
          return {
            ...capture,
            origin: { ...capture.origin, membershipEpoch: '2026-09-12T01:00:00.000Z' }
          }
        return {
          ...capture,
          recipients: [{ ...capture.recipients[0]!, membershipEpoch: '2026-09-12T01:00:00.000Z' }]
        }
      })
    )
    const owner = await connect(stub, ownerId, 'OWNER')
    const player = await connect(stub, playerId, 'PLAYER')
    owner.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
    await vi.waitFor(() => expect(captureCalls).toBeGreaterThanOrEqual(4))
    await noTransient(owner.messages)
    await noTransient(player.messages)
  }
)

it.each(['origin', 'recipient'] as const)(
  'checks the %s admission deadline at the final transient send boundary',
  async (expired) => {
    const initialNow = Date.now()
    let now = initialNow
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
    const stub = env.LIVE_SESSION_ROOMS.get(
      env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
    )
    let captureCalls = 0
    await runInDurableObject(stub, () =>
      installFetch(members, (call, capture) => {
        captureCalls = call
        if (call === 4) now = initialNow + 301_000
        return capture
      })
    )
    const [firstUserId, firstRole, secondUserId, secondRole] =
      expired === 'origin'
        ? ([ownerId, 'OWNER', playerId, 'PLAYER'] as const)
        : ([playerId, 'PLAYER', ownerId, 'OWNER'] as const)
    const first = await connect(stub, firstUserId, firstRole)
    now = initialNow + 10_000
    const second = await connect(stub, secondUserId, secondRole)
    const owner = expired === 'origin' ? first : second
    const player = expired === 'origin' ? second : first

    owner.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
    await vi.waitFor(() => expect(captureCalls).toBe(4))
    if (expired === 'origin') await noTransient(owner.messages)
    else await vi.waitFor(() => expect(transient(owner.messages)).toHaveLength(1))
    await noTransient(player.messages)
  }
)

it('drops queued token work after access-token expiry and accepts a fresh token', async () => {
  const initialNow = Date.now()
  let now = initialNow
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const members = [member(ownerId, 'OWNER')]
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
  let captureCalls = 0
  let releaseDelayedCapture = () => {}
  const delayedCapture = new Promise<void>((resolve) => {
    releaseDelayedCapture = resolve
  })
  await runInDurableObject(stub, () =>
    installFetch(members, async (call, capture) => {
      captureCalls = call
      if (call === 2) await delayedCapture
      return capture
    })
  )
  const owner = await connect(stub, ownerId, 'OWNER')

  now = initialNow + 298_000
  owner.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
  await vi.waitFor(() => expect(captureCalls).toBe(2))

  now = initialNow + 301_000
  releaseDelayedCapture()
  await vi.waitFor(() =>
    expect(owner.messages.some((message) => message.type === 'AUTHENTICATION_REQUIRED')).toBe(true)
  )
  await noTransient(owner.messages)

  const refreshedToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ownerId)
    .setExpirationTime(Math.floor(now / 1_000) + 300)
    .sign(new TextEncoder().encode(secret))
  owner.socket.send(JSON.stringify({ accessToken: refreshedToken, type: 'AUTHENTICATE' }))
  await vi.waitFor(() =>
    expect(owner.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
})

it('does not block ordered token previews behind a pointer capture', async () => {
  const members = [member(ownerId, 'OWNER')]
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
  let captureCalls = 0
  let releasePointerCapture = () => {}
  const delayedPointerCapture = new Promise<void>((resolve) => {
    releasePointerCapture = resolve
  })
  await runInDurableObject(stub, () =>
    installFetch(members, async (call, capture) => {
      captureCalls = call
      if (call === 2) await delayedPointerCapture
      return capture
    })
  )
  const owner = await connect(stub, ownerId, 'OWNER')

  owner.socket.send(
    JSON.stringify({
      type: 'TRANSIENT',
      envelope: {
        baselineVersion: 1,
        kind: 'POINTER_PREVIEW',
        position: { x: 15, y: 10 },
        sceneId,
        sequence: 1
      }
    })
  )
  await vi.waitFor(() => expect(captureCalls).toBe(2))

  try {
    owner.socket.send(
      JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1, { x: 20, y: 20 }) })
    )
    await vi.waitFor(() =>
      expect(transient(owner.messages)).toContainEqual(
        expect.objectContaining({
          message: expect.objectContaining({
            tokenDragResolution: expect.objectContaining({ accepted: true })
          })
        })
      )
    )
  } finally {
    releasePointerCapture()
  }
  await vi.waitFor(() => expect(captureCalls).toBe(4))
  const retained = await runInDurableObject(stub, (_instance, state) => {
    const attachment = state.getWebSockets()[0]!.deserializeAttachment() as { socketId: string }
    const transients = new NativeSocketTransientState(state.storage)
    return {
      attachment,
      pointer: transients.read(attachment.socketId, 'POINTER_PREVIEW'),
      token: transients.read(attachment.socketId, `TOKEN_DRAG_PREVIEW:${tokenId}`, sceneId, 1)
    }
  })
  expect(retained.attachment).not.toHaveProperty('transientSequences')
  expect(retained.attachment).not.toHaveProperty('transientTokenPaths')
  expect(retained.pointer?.sequence).toBe(1)
  expect(retained.token).toMatchObject({
    sequence: 1,
    sceneId,
    baselineVersion: 1,
    path: [
      { x: 10, y: 10 },
      { x: 20, y: 20 }
    ]
  })

  owner.messages.length = 0
  owner.socket.send(
    JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1, { x: 20, y: 20 }) })
  )
  await vi.waitFor(() => expect(captureCalls).toBe(5))
  await noTransient(owner.messages)
})

it('migrates legacy paths and retains per-token sequences through hibernation', async () => {
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
  await runInDurableObject(stub, () => installFetch([member(ownerId, 'OWNER')]))
  const owner = await connect(stub, ownerId, 'OWNER')
  const siblingTokenId = crypto.randomUUID()
  const siblingPath = [{ x: 4, y: 4 }]
  await runInDurableObject(stub, (_instance, state) => {
    const socket = state.getWebSockets()[0]!
    const existing = socket.deserializeAttachment() as Record<string, unknown>
    socket.serializeAttachment({
      ...existing,
      transientSequences: {
        [`TOKEN_DRAG_PREVIEW:${tokenId}`]: 4,
        [`TOKEN_DRAG_PREVIEW:${siblingTokenId}`]: 2,
        POINTER_PREVIEW: 7
      },
      transientTokenPaths: {
        ...Object.fromEntries(
          Array.from({ length: 110 }, (_, index) => [
            `${sceneId}:${index + 2}:${tokenId}`,
            [
              { x: 10, y: 10 },
              { x: 15, y: 10 }
            ]
          ])
        ),
        [`${sceneId}:1:${siblingTokenId}`]: siblingPath
      }
    })
  })

  await evictDurableObject(stub)
  owner.messages.length = 0
  owner.socket.send(JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 }))
  await vi.waitFor(() =>
    expect(owner.messages.some((message) => message.type === 'AUTHENTICATION_REQUIRED')).toBe(true)
  )
  owner.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: owner.accessToken }))
  await vi.waitFor(() =>
    expect(owner.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  owner.messages.length = 0
  const migrated = await runInDurableObject(stub, (_instance, state) => {
    const attachment = state.getWebSockets()[0]!.deserializeAttachment() as { socketId: string }
    const transients = new NativeSocketTransientState(state.storage)
    return {
      attachment,
      pointer: transients.read(attachment.socketId, 'POINTER_PREVIEW'),
      sibling: transients.read(
        attachment.socketId,
        `TOKEN_DRAG_PREVIEW:${siblingTokenId}`,
        sceneId,
        1
      ),
      historical: transients.read(attachment.socketId, `TOKEN_DRAG_PREVIEW:${tokenId}`, sceneId, 2)
    }
  })
  expect(migrated.attachment).not.toHaveProperty('transientSequences')
  expect(migrated.attachment).not.toHaveProperty('transientTokenPaths')
  expect(migrated.pointer?.sequence).toBe(7)
  expect(migrated.sibling).toMatchObject({ sequence: 2, path: siblingPath })
  expect(migrated.historical).toMatchObject({ sequence: 4, baselineVersion: 2 })

  owner.socket.send(
    JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(5, { x: 20, y: 20 }) })
  )
  await vi.waitFor(() =>
    expect(transient(owner.messages)[0]?.message.tokenDragResolution).toMatchObject({
      accepted: true
    })
  )
  const retained = await runInDurableObject(stub, (_instance, state) => {
    const attachment = state.getWebSockets()[0]!.deserializeAttachment() as { socketId: string }
    const transients = new NativeSocketTransientState(state.storage)
    return {
      attachment,
      pointer: transients.read(attachment.socketId, 'POINTER_PREVIEW'),
      sibling: transients.read(
        attachment.socketId,
        `TOKEN_DRAG_PREVIEW:${siblingTokenId}`,
        sceneId,
        1
      ),
      token: transients.read(attachment.socketId, `TOKEN_DRAG_PREVIEW:${tokenId}`, sceneId, 1)
    }
  })
  expect(retained.attachment).not.toHaveProperty('transientSequences')
  expect(retained.attachment).not.toHaveProperty('transientTokenPaths')
  expect(retained.pointer?.sequence).toBe(7)
  expect(retained.sibling).toMatchObject({ sequence: 2, path: siblingPath })
  expect(retained.token).toMatchObject({
    sequence: 5,
    sceneId,
    baselineVersion: 1,
    path: [
      { x: 10, y: 10 },
      { x: 20, y: 20 }
    ]
  })

  await evictDurableObject(stub)
  owner.messages.length = 0
  owner.socket.send(JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 }))
  await vi.waitFor(() =>
    expect(owner.messages.some((message) => message.type === 'AUTHENTICATION_REQUIRED')).toBe(true)
  )
  owner.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: owner.accessToken }))
  await vi.waitFor(() =>
    expect(owner.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  owner.messages.length = 0
  owner.socket.send(
    JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(5, { x: 20, y: 20 }) })
  )
  await noTransient(owner.messages)
  owner.socket.send(
    JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(6, { x: 25, y: 20 }) })
  )
  await vi.waitFor(() =>
    expect(transient(owner.messages)[0]?.message.tokenDragResolution).toMatchObject({
      accepted: true
    })
  )
  const resumed = await runInDurableObject(stub, (_instance, state) => {
    const attachment = state.getWebSockets()[0]!.deserializeAttachment() as { socketId: string }
    const transients = new NativeSocketTransientState(state.storage)
    return {
      attachment,
      pointer: transients.read(attachment.socketId, 'POINTER_PREVIEW'),
      sibling: transients.read(
        attachment.socketId,
        `TOKEN_DRAG_PREVIEW:${siblingTokenId}`,
        sceneId,
        1
      ),
      token: transients.read(attachment.socketId, `TOKEN_DRAG_PREVIEW:${tokenId}`, sceneId, 1)
    }
  })
  expect(resumed.attachment).not.toHaveProperty('transientSequences')
  expect(resumed.attachment).not.toHaveProperty('transientTokenPaths')
  expect(resumed.pointer?.sequence).toBe(7)
  expect(resumed.sibling).toMatchObject({ sequence: 2, path: siblingPath })
  expect(resumed.token).toMatchObject({
    sequence: 6,
    sceneId,
    baselineVersion: 1,
    path: [
      { x: 10, y: 10 },
      { x: 25, y: 20 }
    ]
  })
})

it('retries one transient capture conflict and fans out after the fresh capture', async () => {
  const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
  let captureCalls = 0
  await runInDurableObject(stub, () =>
    installFetch(members, (call, capture, input) => {
      captureCalls = call
      if (call === 4) expect(input.observedCharacterRevisions).toEqual([])
      return call === 3 ? new Response(null, { status: 409 }) : capture
    })
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  owner.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
  await vi.waitFor(() => {
    expect(captureCalls).toBe(5)
    expect(transient(owner.messages)).toHaveLength(1)
    expect(transient(player.messages)).toHaveLength(1)
  })
})

it('fails closed when the fresh capture also conflicts without a third attempt', async () => {
  const members = [member(ownerId, 'OWNER'), member(playerId, 'PLAYER')]
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
  let captureCalls = 0
  await runInDurableObject(stub, () =>
    installFetch(members, (call, capture, input) => {
      captureCalls = call
      if (call === 4) expect(input.observedCharacterRevisions).toEqual([])
      return call === 3 || call === 5 ? new Response(null, { status: 409 }) : capture
    })
  )
  const [owner, player] = await Promise.all([
    connect(stub, ownerId, 'OWNER'),
    connect(stub, playerId, 'PLAYER')
  ])
  owner.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
  await vi.waitFor(() => expect(owner.messages).toContainEqual({ type: 'AUTHENTICATION_REQUIRED' }))
  expect(captureCalls).toBe(5)
  await noTransient(owner.messages)
  await noTransient(player.messages)
})

it('rehydrates bound Character vision after its revision invalidates the cached scene', async () => {
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
    expectedSessionVersion: 1,
    freshness: { campaign: null, session: null, system: null },
    sceneId,
    sessionId,
    systemId: '00000000-0000-4000-8000-000000000111'
  }
  const binding = {
    ...run,
    actorId: '00000000-0000-4000-8000-000000000116',
    characterId,
    streamVersion: 0,
    tokenId
  }
  const captures: LiveSessionTransientCaptureInput[] = []
  const visionRequests: string[] = []
  let invalidations = 0
  let visionRevision = revisionA
  let revisionChanged = false
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`${campaignId}:${crypto.randomUUID()}`)
  )
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
          sessionId,
          updatedAt: now
        })
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        captures.push(body)
        const origin = members.find((candidate) => candidate.userId === body.expectedUserId)
        if (!origin || origin.role !== body.expectedRole) return new Response(null, { status: 409 })
        if (
          revisionChanged &&
          body.observedCharacterRevisions.some((revision) => revision.revision === revisionA)
        ) {
          invalidations += 1
          revisionChanged = false
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
        visionRequests.push(visionRevision)
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

  player.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(1) }))
  await vi.waitFor(() =>
    expect(transient(player.messages)[0]).toMatchObject({
      message: { visionLayers: [expect.anything()] }
    })
  )
  expect(
    captures.some((capture) =>
      capture.observedCharacterRevisions.some((revision) => revision.revision === revisionA)
    )
  ).toBe(true)

  owner.messages.length = 0
  player.messages.length = 0
  revisionChanged = true
  player.socket.send(JSON.stringify({ type: 'TRANSIENT', envelope: tokenPreview(2) }))
  await vi.waitFor(() =>
    expect(transient(player.messages)[0]).toMatchObject({ message: { visionLayers: [] } })
  )
  expect(visionRequests).toEqual([revisionA, revisionB])
  expect(invalidations).toBe(1)
  expect(
    captures.some((capture) =>
      capture.observedCharacterRevisions.some((revision) => revision.revision === revisionB)
    )
  ).toBe(true)
  expect(transient(owner.messages)).toHaveLength(1)
})

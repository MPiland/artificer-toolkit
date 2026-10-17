import { runInDurableObject, SELF } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_TICKET_VERSION,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  liveSessionRoomSceneCaptureInputSchema,
  liveSessionTransientCaptureInputSchema,
  type LiveSessionRoomSceneCapture,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { liveRoomInputsInputSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'

import { DurableCommandJournal } from '../src/durableCommandJournal.js'
import { ROOM_LIMITS } from '../src/roomLimits.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import { ROOM_INPUTS_PATH, roomInputsResponse } from './roomInputsFixture.js'
import { trackRoom } from './roomTeardown.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const allowedOrigin = 'https://app.test'
const sockets: WebSocket[] = []

type Role = 'OWNER' | 'PLAYER'
type Member = { membershipEpoch: string; role: Role }

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
  vi.restoreAllMocks()
})

function signTicket(
  input: { authorityEpoch: string; campaignId: string; role: string; subject: string },
  overrides: {
    audience?: string
    claims?: Record<string, unknown>
    expiresIn?: number
    issuer?: string
    jti?: boolean
    signingSecret?: string
  } = {}
) {
  const issuedAt = Math.floor(Date.now() / 1_000)
  const jwt = new SignJWT({
    authSubject: `auth-${input.subject}`,
    authorityEpoch: input.authorityEpoch,
    campaignId: input.campaignId,
    role: input.role,
    v: LIVE_SESSION_TICKET_VERSION,
    ...overrides.claims
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(overrides.issuer ?? LIVE_SESSION_TICKET_ISSUER)
    .setAudience(overrides.audience ?? LIVE_SESSION_TICKET_AUDIENCE)
    .setSubject(input.subject)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + (overrides.expiresIn ?? 60))
  if (overrides.jti !== false) jwt.setJti(crypto.randomUUID())
  return jwt.sign(new TextEncoder().encode(overrides.signingSecret ?? secret))
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

/**
 * A Campaign room whose Convex routes answer from `members`: capture reports each member's current
 * role and membership epoch and refuses anyone else, and activation waits for `activationGate`.
 */
async function room() {
  const campaignId = crypto.randomUUID()
  const authorityEpoch = crypto.randomUUID()
  const systemId = crypto.randomUUID()
  const activationFingerprint = 'a'.repeat(64)
  const members = new Map<string, Member>()
  const routes: string[] = []
  let openActivation: () => void = () => undefined
  let activationGate: Promise<void> = Promise.resolve()
  const stub = env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(campaignId))
  // The fetch and clock spies are isolate-wide, so a room left running would answer from, and count
  // its reads on, a later test's mock.
  trackRoom(stub)
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      routes.push(pathname)
      const current = [...members].map(([userId, member]) => ({ ...member, userId }))
      if (pathname === ROOM_AUTHORIZATION_PATH)
        return Response.json(roomAuthorizationResponse({ members: current }))
      // Activation hydrates the room store; no Scene is presented, so no Scene read follows.
      if (pathname === ROOM_INPUTS_PATH) {
        const { scope } = liveRoomInputsInputSchema.parse(await request.json())
        return Response.json(roomInputsResponse(scope, { campaignId, systemId, members: current }))
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        const member = members.get(body.expectedUserId)
        if (!member) return new Response('membership changed', { status: 409 })
        return Response.json({
          campaignId,
          origin: { ...member, userId: body.expectedUserId },
          presentation: null,
          sceneEncounterId: null,
          sceneHeader: null
        } satisfies LiveSessionTransientCapture)
      }
      if (pathname === '/live-sessions/room-scene-capture') {
        const body = liveSessionRoomSceneCaptureInputSchema.parse(await request.json())
        return Response.json({
          campaignId,
          systemId,
          observedCharacterRevisions: body.observedCharacterRevisions,
          presentation: null,
          sceneEncounterId: null,
          sceneHeader: null,
          visionFreshness: null
        } satisfies LiveSessionRoomSceneCapture)
      }
      if (pathname === '/live-sessions/bootstrap')
        return Response.json({
          activationFingerprint,
          persistedSequence: 0,
          persistedStateChecksum: activationFingerprint
        })
      if (pathname === '/live-sessions/activate') {
        const body = (await request.json()) as { stateChecksum: string }
        await activationGate
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
      throw new Error(`Unexpected native request: ${pathname}`)
    })
  })

  async function connect(role: Role, userId = crypto.randomUUID()) {
    const membershipEpoch = new Date().toISOString()
    members.set(userId, { membershipEpoch, role })
    const ticket = await signTicket({ authorityEpoch, campaignId, role, subject: userId })
    const response = await stub.fetch(
      new Request(`https://session.test/live-session/${campaignId}`, {
        headers: { upgrade: 'websocket', 'x-artificer-live-session-ticket': ticket }
      })
    )
    expect(response.status).toBe(101)
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
    const accessToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setExpirationTime(Math.floor(Date.now() / 1_000) + 3_600)
      .sign(new TextEncoder().encode(secret))
    return {
      userId,
      membershipEpoch,
      messages,
      socket,
      authenticate: () => socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken })),
      ready: () => messages.some((message) => message.type === 'TRANSIENT_READY')
    }
  }

  return {
    authorityEpoch,
    campaignId,
    connect,
    members,
    routes,
    stub,
    count: (pathname: string) => routes.filter((route) => route === pathname).length,
    holdActivation: () => {
      activationGate = new Promise((resolve) => {
        openActivation = resolve
      })
    },
    releaseActivation: () => openActivation(),
    journal: () =>
      runInDurableObject(stub, (_instance, state) =>
        new DurableCommandJournal(state.storage).readCurrent()
      )
  }
}

async function admitted(member: Awaited<ReturnType<Awaited<ReturnType<typeof room>>['connect']>>) {
  member.authenticate()
  await vi.waitFor(() => expect(member.ready()).toBe(true))
}

const baseClaims = {
  authorityEpoch: '00000000-0000-4000-8000-000000000301',
  campaignId: '00000000-0000-4000-8000-000000000302',
  role: 'PLAYER',
  subject: '00000000-0000-4000-8000-000000000303'
}

it.each([
  ['a signature from another secret', { signingSecret: `${secret}-other` }],
  ['another issuer', { issuer: 'someone-else' }],
  ['another audience', { audience: 'another-service' }],
  ['a retired ticket version', { claims: { v: LIVE_SESSION_TICKET_VERSION - 1 } }],
  ['an unknown role', { claims: { role: 'ADMIN' } }],
  ['an expired ticket', { expiresIn: -1 }],
  ['no ticket id', { jti: false }]
] as const)(
  'refuses a ticket with %s before the room accepts a socket',
  async (_case, overrides) => {
    const ticket = await signTicket(baseClaims, overrides)
    const response = await SELF.fetch(
      `https://session.test/live-session/${baseClaims.campaignId}`,
      {
        headers: {
          upgrade: 'websocket',
          origin: allowedOrigin,
          'sec-websocket-protocol': `${LIVE_SESSION_WEBSOCKET_PROTOCOL}, ${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`
        }
      }
    )
    expect(response.status).toBe(401)
    expect(response.webSocket).toBeNull()
  }
)

it('re-verifies the forwarded ticket inside the room and refuses a forged signature', async () => {
  const campaignId = crypto.randomUUID()
  const stub = env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(campaignId))
  const forged = await signTicket(
    { ...baseClaims, campaignId },
    { signingSecret: `${secret}-other` }
  )
  const response = await stub.fetch(
    new Request(`https://session.test/live-session/${campaignId}`, {
      headers: { upgrade: 'websocket', 'x-artificer-live-session-ticket': forged }
    })
  )
  expect(response.status).toBe(401)
  expect(response.webSocket).toBeNull()
})

it('renews current authority once under the activation lock before any socket is READY', async () => {
  const base = await room()
  const owner = await base.connect('OWNER')
  const player = await base.connect('PLAYER')
  base.holdActivation()
  owner.authenticate()
  player.authenticate()
  // Both members' current authority is captured, but nobody is READY while activation holds.
  await vi.waitFor(() => {
    expect(base.count('/live-sessions/activate')).toBe(1)
    expect(base.count('/live-sessions/capture')).toBe(2)
  })
  expect(
    owner.messages
      .concat(player.messages)
      .filter((message) => message.type === 'TRANSIENT_READY' || message.type === 'STATE_SYNC')
  ).toEqual([])
  base.releaseActivation()
  await vi.waitFor(() => {
    expect(owner.ready()).toBe(true)
    expect(player.ready()).toBe(true)
  })
  expect(base.count('/live-sessions/bootstrap')).toBe(1)
  expect(base.count('/live-sessions/activate')).toBe(1)
  await expect(base.journal()).resolves.toMatchObject({
    authorityEpoch: base.authorityEpoch,
    status: 'ACTIVE'
  })
})

it('closes a socket whose role went stale on renewal and keeps the other members admitted', async () => {
  const base = await room()
  const owner = await base.connect('OWNER')
  const player = await base.connect('PLAYER')
  await admitted(owner)
  await admitted(player)
  base.members.set(owner.userId, { membershipEpoch: owner.membershipEpoch, role: 'PLAYER' })
  const closed = waitForClose(owner.socket)
  owner.authenticate()
  await expect(closed).resolves.toMatchObject({
    code: 1008,
    reason: 'Live-session membership changed.'
  })
  expect(player.socket.readyState).toBe(WebSocket.OPEN)
  player.messages.length = 0
  player.socket.send(JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 }))
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual({
      authorityEpoch: base.authorityEpoch,
      sequence: 0,
      state: { recipientRole: 'PLAYER', presentationVersion: null, scene: null },
      type: 'STATE_SYNC'
    })
  )
})

it('closes a first admission whose ticket role no longer matches the membership', async () => {
  const base = await room()
  const stale = await base.connect('OWNER')
  base.members.set(stale.userId, { membershipEpoch: stale.membershipEpoch, role: 'PLAYER' })
  const closed = waitForClose(stale.socket)
  stale.authenticate()
  await expect(closed).resolves.toMatchObject({
    code: 1008,
    reason: 'Live-session membership changed.'
  })
  expect(base.count('/live-sessions/bootstrap')).toBe(0)
})

it('keeps room authority after the activating member leaves and admits another current member under it', async () => {
  const base = await room()
  const owner = await base.connect('OWNER')
  const player = await base.connect('PLAYER')
  await admitted(owner)
  await admitted(player)
  base.members.delete(owner.userId)
  const closed = waitForClose(owner.socket)
  const evicted = await SELF.fetch(`https://session.test${LIVE_SESSION_CONTROL_PATH}`, {
    body: JSON.stringify({
      campaignId: base.campaignId,
      operation: {
        membershipEpoch: owner.membershipEpoch,
        type: 'EVICT_USER',
        userId: owner.userId
      }
    }),
    headers: { 'content-type': 'application/json', [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret },
    method: 'POST'
  })
  expect(await evicted.json()).toEqual({ closed: 1 })
  await expect(closed).resolves.toMatchObject({ code: 1008 })
  const next = await base.connect('PLAYER')
  await admitted(next)
  await vi.waitFor(() =>
    expect(next.messages).toContainEqual(
      expect.objectContaining({
        authorityEpoch: base.authorityEpoch,
        type: 'STATE_SYNC'
      })
    )
  )
  expect(player.socket.readyState).toBe(WebSocket.OPEN)
  expect(base.count('/live-sessions/bootstrap')).toBe(1)
  expect(base.count('/live-sessions/activate')).toBe(1)
  await expect(base.journal()).resolves.toMatchObject({
    authorityEpoch: base.authorityEpoch,
    status: 'ACTIVE'
  })
})

const halfLease = ROOM_LIMITS.authorizationLeaseMs / 2
const resume = JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 })

it('renews the authorization lease with one read per half-lease while a member is connected, and not before', async () => {
  const base = await room()
  const player = await base.connect('PLAYER')
  await admitted(player)
  const syncs = () => player.messages.filter(({ type }) => type === 'STATE_SYNC').length
  // Admission sends the first STATE_SYNC.
  await vi.waitFor(() => expect(syncs()).toBe(1))
  const reads = base.count(ROOM_AUTHORIZATION_PATH)
  player.socket.send(resume)
  player.socket.send(resume)
  await vi.waitFor(() => expect(syncs()).toBe(3))
  expect(base.count(ROOM_AUTHORIZATION_PATH)).toBe(reads)

  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + halfLease + 1_000)
  player.socket.send(resume)
  await vi.waitFor(() => expect(base.count(ROOM_AUTHORIZATION_PATH)).toBe(reads + 1))
  player.socket.send(resume)
  player.socket.send(resume)
  await vi.waitFor(() => expect(syncs()).toBe(6))
  expect(base.count(ROOM_AUTHORIZATION_PATH)).toBe(reads + 1)
  clock.mockRestore()
})

it('does not renew the lease from an alarm while no socket is connected', async () => {
  const base = await room()
  const player = await base.connect('PLAYER')
  await admitted(player)
  player.socket.close(1000, 'Done.')
  await vi.waitFor(async () =>
    expect(
      await runInDurableObject(
        base.stub,
        (_instance, state) =>
          state.getWebSockets().filter((socket) => socket.readyState === WebSocket.OPEN).length
      )
    ).toBe(0)
  )
  const reads = base.count(ROOM_AUTHORIZATION_PATH)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + halfLease + 1_000)
  await runInDurableObject(base.stub, (instance) => instance.alarm())
  clock.mockRestore()
  expect(base.count(ROOM_AUTHORIZATION_PATH)).toBe(reads)
})

it('closes a socket whose eviction notice was lost once the half-lease renewal reads', async () => {
  const base = await room()
  const owner = await base.connect('OWNER')
  const player = await base.connect('PLAYER')
  await admitted(owner)
  await admitted(player)
  base.members.delete(player.userId)
  const closed = waitForClose(player.socket)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + halfLease + 1_000)
  owner.socket.send(resume)
  await expect(closed).resolves.toMatchObject({ code: 1008, reason: 'Campaign access ended.' })
  clock.mockRestore()
  expect(owner.socket.readyState).toBe(WebSocket.OPEN)
})

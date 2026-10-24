import { runInDurableObject } from 'cloudflare:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { expect, vi } from 'vitest'
import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  liveSessionActivationInputSchema,
  liveSessionBootstrapInputSchema,
  liveSessionDrainReleaseInputSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import { liveSessionCheckpointRequestSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { liveRoomInputsInputSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  liveSessionRoomSceneCaptureInputSchema,
  liveSessionTransientCaptureInputSchema,
  type LiveSessionRoomSceneCapture,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'

import { NO_CHECKPOINT_IO } from './checkpointIoFixture.js'
import { roomStub } from './roomTeardown.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import {
  ROOM_INPUTS_PATH,
  rawSceneDefinitionInputs,
  rawSceneInputs,
  roomInputsResponse
} from './roomInputsFixture.js'

export const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
export const JWKS_PATH = '/api/auth/convex/jwks'
const ACCESS_KEY_ID = 'native-access-key'
const sockets: WebSocket[] = []
export const accessKeys = await generateKeyPair('RS256')
export const accessJwks = {
  keys: [
    { ...(await exportJWK(accessKeys.publicKey)), alg: 'RS256', kid: ACCESS_KEY_ID, use: 'sig' }
  ]
}
/** The Better Auth subject Convex puts in a user's ticket and access token, distinct from the app user id. */
export const authSubjectOf = (userId: string) => `auth-${userId}`

/** Remembers a client socket so `closeTrackedSockets` closes it after the test. */
export function trackSocket(socket: WebSocket) {
  sockets.push(socket)
}

export function closeTrackedSockets() {
  for (const socket of sockets.splice(0)) socket.close()
}

/** A Convex-issued access token (RS256, the site as issuer, audience `convex`) the room verifies locally. */
export function signVerifiedAccessToken(input: {
  expirationTime: number
  key?: CryptoKey
  kid?: string
  subject: string
}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: input.kid ?? ACCESS_KEY_ID })
    .setIssuer('https://native.test')
    .setAudience('convex')
    .setSubject(input.subject)
    .setExpirationTime(input.expirationTime)
    .sign(input.key ?? accessKeys.privateKey)
}

export function checkpointResponse(
  body: ReturnType<typeof liveSessionCheckpointRequestSchema.parse>
) {
  const now = new Date().toISOString()
  return {
    status: 'COMMITTED',
    authority: {
      activationFingerprint: 'a'.repeat(64),
      campaignId: body.campaignId,
      createdAt: now,
      epoch: body.epoch,
      persistedSequence: body.sequence,
      persistedStateChecksum: body.checksum,
      phase: 'DO_ACTIVE',
      updatedAt: now
    },
    adopted: { characters: [] },
    io: NO_CHECKPOINT_IO
  }
}

export function doorScene(campaignId: string) {
  const doorId = crypto.randomUUID()
  return {
    doorId,
    scene: {
      annotations: [],
      ambientIllumination: 'BRIGHT' as const,
      daylight: false,
      barriers: [
        {
          a: { x: 0, y: 0 },
          b: { x: 0, y: 10 },
          blocksLightWhenClosed: true,
          blocksMovementWhenClosed: true,
          id: doorId,
          initialState: 'CLOSED' as const,
          kind: 'DOOR' as const,
          openAngleDegrees: 90
        }
      ],
      campaignId,
      darknessZones: [],
      definitionId: crypto.randomUUID(),
      definitionVersion: 1,
      doorStates: { [doorId]: 'CLOSED' as const },
      fogLayers: [],
      fogMode: 'SHARED_PARTY' as const,
      grid: {
        cellSize: 50,
        diagonalPolicy: 'EQUAL' as const,
        distancePerCell: 5,
        kind: 'SQUARE' as const,
        origin: { x: 0, y: 0 },
        unit: 'FEET' as const
      },
      id: crypto.randomUUID(),
      lights: [],
      map: {
        assetId: crypto.randomUUID(),
        height: 100,
        tileManifestAssetId: null,
        width: 100
      },
      measurements: [],
      name: 'Door scene',
      tokens: [],
      version: 0,
      visionRevealMode: 'ON_DRAG' as const
    }
  }
}

export function movementScene(campaignId: string): {
  scene: CampaignSceneStateDto
  tokenId: string
} {
  const tokenId = crypto.randomUUID()
  return {
    tokenId,
    scene: {
      ...doorScene(campaignId).scene,
      barriers: [],
      doorStates: {},
      name: 'Movement scene',
      tokens: [
        {
          assetId: null,
          controlledByUserIds: [],
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
            dimRange: 0,
            directionDegrees: 0,
            enabled: false
          },
          width: 5
        }
      ]
    }
  }
}

export function signTicket(input: {
  authorityEpoch: string
  campaignId: string
  issuedAt: number
  role: 'OWNER' | 'PLAYER'
  subject: string
}) {
  return new SignJWT({
    authSubject: authSubjectOf(input.subject),
    authorityEpoch: input.authorityEpoch,
    campaignId: input.campaignId,
    role: input.role,
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setSubject(input.subject)
    .setJti(crypto.randomUUID())
    .setIssuedAt(input.issuedAt)
    .setExpirationTime(input.issuedAt + 60)
    .sign(new TextEncoder().encode(secret))
}

export async function fixture(
  scene: CampaignSceneStateDto | null = null,
  accessTokenSeconds = 3_600
) {
  const campaignId = scene?.campaignId ?? crypto.randomUUID()
  const authorityEpoch = crypto.randomUUID()
  const activationFingerprint = 'a'.repeat(64)
  const userId = crypto.randomUUID()
  const playerId = crypto.randomUUID()
  /** A second player, who joins the room's members only where a test adds them. */
  const otherPlayerId = crypto.randomUUID()
  const issuedAt = Math.floor(Date.now() / 1_000)
  const ticket = await signTicket({
    authorityEpoch,
    campaignId,
    issuedAt,
    role: 'OWNER',
    subject: userId
  })
  const issueAccessTokenFor = (subject: string, expirationTime: number) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setExpirationTime(expirationTime)
      .sign(new TextEncoder().encode(secret))
  const issueAccessToken = (expirationTime: number) => issueAccessTokenFor(userId, expirationTime)
  const accessToken = await issueAccessToken(issuedAt + accessTokenSeconds)
  const playerAccessToken = await issueAccessTokenFor(playerId, issuedAt + 3_600)
  const otherPlayerAccessToken = await issueAccessTokenFor(otherPlayerId, issuedAt + 3_600)
  const capture: LiveSessionTransientCapture = {
    campaignId,
    origin: { membershipEpoch: new Date().toISOString(), role: 'OWNER', userId },
    presentation: scene ? { campaignId, sceneId: scene.id, version: 1 } : null,
    sceneEncounterId: null,
    sceneHeader: scene
      ? {
          ambientIllumination: scene.ambientIllumination,
          daylight: scene.daylight,
          campaignId,
          counts: {
            annotations: scene.annotations.length,
            barriers: scene.barriers.length,
            darknessZones: scene.darknessZones.length,
            lights: scene.lights.length,
            tokens: scene.tokens.length
          },
          currentCounts: {
            annotations: scene.annotations.length,
            barriers: scene.barriers.length,
            darknessZones: scene.darknessZones.length,
            lights: scene.lights.length,
            measurements: scene.measurements.length,
            tokens: scene.tokens.length
          },
          definitionId: scene.definitionId,
          definitionSaveId: crypto.randomUUID(),
          definitionVersion: scene.definitionVersion,
          fogLayerCount: scene.fogLayers.length,
          fogMode: scene.fogMode,
          grid: scene.grid,
          id: scene.id,
          map: scene.map,
          name: scene.name,
          version: scene.version,
          visionRevealMode: scene.visionRevealMode
        }
      : null
  }
  /** What the room Scene capture reports besides the presented Scene in `capture`. */
  const room = { systemId: crypto.randomUUID() }
  /** The Scene Convex serves through the SCENE room-inputs scopes. */
  const rawScene = { current: scene }
  const stub = roomStub(campaignId)
  const authorityLifecycleCalls: string[] = []
  let currentAuthorityEpoch = authorityEpoch
  /** The last Checkpoint Convex persisted; a re-bootstrapped room must agree with it. */
  let persisted = { sequence: 0, checksum: activationFingerprint }
  /** Convex's authorization state for the room; tests change it to model departures. */
  const authorization = {
    members: [
      { membershipEpoch: capture.origin.membershipEpoch, role: 'OWNER' as const, userId },
      { membershipEpoch: capture.origin.membershipEpoch, role: 'PLAYER' as const, userId: playerId }
    ],
    /** Members whose stored preference rolls dice automatically. */
    autoRollUserIds: [] as string[],
    /** Campaign Character assignments with their GM control grants (D162). */
    assignments: [] as { characterId: string; controllerUserIds?: string[]; userId: string }[],
    reads: 0
  }
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      if (pathname === JWKS_PATH) return Response.json(accessJwks)
      expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
      if (pathname === ROOM_INPUTS_PATH) {
        expect(request.headers.get('authorization')).toBeNull()
        const inputs = liveRoomInputsInputSchema.parse(await request.json())
        expect(inputs).toMatchObject({ campaignId, epoch: currentAuthorityEpoch })
        if (inputs.scope.kind === 'SCENE' || inputs.scope.kind === 'SCENE_DEFINITION') {
          const served = rawScene.current
          if (!capture.sceneHeader || !served) throw new Error('Missing raw Scene fixture.')
          const sceneFixture = {
            scene: served,
            header: capture.sceneHeader,
            presentationVersion: capture.presentation?.version ?? 0
          }
          return Response.json(
            inputs.scope.kind === 'SCENE'
              ? rawSceneInputs(sceneFixture)
              : rawSceneDefinitionInputs(sceneFixture)
          )
        }
        return Response.json(
          roomInputsResponse(inputs.scope, {
            campaignId,
            systemId: room.systemId,
            ownerUserId: userId,
            members: authorization.members,
            assignments: authorization.assignments
          })
        )
      }
      if (pathname === '/live-sessions/checkpoint') {
        const body = liveSessionCheckpointRequestSchema.parse(await request.json())
        expect(body).toMatchObject({ campaignId })
        persisted = { sequence: body.sequence, checksum: body.checksum }
        return Response.json(checkpointResponse(body))
      }
      if (pathname === ROOM_AUTHORIZATION_PATH) {
        expect(request.headers.get('authorization')).toBeNull()
        expect(await request.json()).toMatchObject({ campaignId })
        authorization.reads += 1
        return Response.json(
          roomAuthorizationResponse({
            members: authorization.members,
            assignments: authorization.assignments,
            autoRollUserIds: authorization.autoRollUserIds
          })
        )
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        const expectedAccessToken =
          body.expectedUserId === userId
            ? accessToken
            : body.expectedUserId === playerId
              ? playerAccessToken
              : body.expectedUserId === otherPlayerId
                ? otherPlayerAccessToken
                : null
        expect(request.headers.get('authorization')).toBe(`Bearer ${expectedAccessToken}`)
        expect(body).toMatchObject({ campaignId })
        return Response.json({
          ...capture,
          origin: {
            membershipEpoch: capture.origin.membershipEpoch,
            role: body.expectedRole,
            userId: body.expectedUserId
          }
        })
      }
      if (pathname === '/live-sessions/room-scene-capture') {
        expect(request.headers.get('authorization')).toBeNull()
        const body = liveSessionRoomSceneCaptureInputSchema.parse(await request.json())
        expect(body).toMatchObject({ campaignId, epoch: currentAuthorityEpoch })
        return Response.json({
          campaignId,
          systemId: room.systemId,
          observedCharacterRevisions: body.observedCharacterRevisions,
          presentation: capture.presentation,
          sceneEncounterId: capture.sceneEncounterId,
          sceneHeader: capture.sceneHeader,
          visionFreshness: capture.sceneHeader ? { campaign: null, play: null, system: null } : null
        } satisfies LiveSessionRoomSceneCapture)
      }
      if (pathname === '/live-sessions/bootstrap') {
        expect(request.headers.get('authorization')).toBe(`Bearer ${accessToken}`)
        const body = liveSessionBootstrapInputSchema.parse(await request.json())
        expect(body).toMatchObject({ campaignId, expectedUserId: userId })
        currentAuthorityEpoch = body.authorityEpoch
        return Response.json({
          activationFingerprint,
          persistedSequence: persisted.sequence,
          persistedStateChecksum: persisted.checksum
        })
      }
      if (pathname === '/live-sessions/activate') {
        expect(request.headers.get('authorization')).toBeNull()
        const body = liveSessionActivationInputSchema.parse(await request.json())
        expect(body).toMatchObject({ campaignId, epoch: currentAuthorityEpoch })
        const now = new Date().toISOString()
        return Response.json({
          activationFingerprint,
          campaignId,
          createdAt: now,
          epoch: currentAuthorityEpoch,
          persistedSequence: 0,
          persistedStateChecksum: body.stateChecksum,
          phase: 'DO_ACTIVE',
          updatedAt: now
        })
      }
      if (pathname === '/live-sessions/begin-drain') {
        const body = liveSessionDrainReleaseInputSchema.parse(await request.json())
        expect(body).toMatchObject({ campaignId, epoch: currentAuthorityEpoch })
        authorityLifecycleCalls.push(pathname)
        const now = new Date().toISOString()
        return Response.json({
          activationFingerprint,
          campaignId,
          createdAt: now,
          epoch: currentAuthorityEpoch,
          finalSequence: body.finalSequence,
          finalStateChecksum: body.finalStateChecksum,
          persistedSequence: body.finalSequence,
          persistedStateChecksum: body.finalStateChecksum,
          phase: 'DRAINING',
          updatedAt: now
        })
      }
      if (pathname === '/live-sessions/release') {
        const body = liveSessionDrainReleaseInputSchema.parse(await request.json())
        expect(body).toMatchObject({ campaignId, epoch: currentAuthorityEpoch })
        authorityLifecycleCalls.push(pathname)
        return Response.json(null)
      }
      throw new Error(`Unexpected native request: ${pathname}`)
    })
  })
  const request = (ticketValue = ticket) =>
    new Request(`https://session.test/live-session/${campaignId}`, {
      headers: { upgrade: 'websocket', 'x-artificer-live-session-ticket': ticketValue }
    })
  const response = await stub.fetch(request())
  expect(response.status).toBe(101)
  const socket = response.webSocket
  if (!socket) throw new Error('Missing native test WebSocket.')
  trackSocket(socket)
  const messages: LiveSessionWebSocketServerMessageDto[] = []
  socket.addEventListener('message', (event) => {
    messages.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data))))
  })
  socket.accept()
  return {
    accessToken,
    authorityEpoch,
    authorityLifecycleCalls,
    authorization,
    capture,
    room,
    rawScene,
    issueAccessToken,
    issuedAt,
    messages,
    otherPlayerAccessToken,
    otherPlayerId,
    playerAccessToken,
    playerId,
    request,
    socket,
    stub,
    userId
  }
}

export type LiveRoomFixture = Awaited<ReturnType<typeof fixture>>

/**
 * How long a fixture waits for the room to answer a frame. The room builds its inputs and Scene inside
 * the Durable Object, which a loaded runner takes well over `vi.waitFor`'s 1 s default to do; the
 * wait is bounded by the test timeout, so a room that never answers still fails the test.
 */
export const ROOM_REPLY_WAIT = { timeout: 20_000 } as const

/** A socket for the room's player, or for its second player where a test added them as a member. */
export async function connectPlayer(
  base: LiveRoomFixture,
  who: 'PLAYER' | 'OTHER_PLAYER' = 'PLAYER'
) {
  const subject = who === 'PLAYER' ? base.playerId : base.otherPlayerId
  const ticket = await signTicket({
    authorityEpoch: base.authorityEpoch,
    campaignId: base.capture.campaignId,
    issuedAt: base.issuedAt,
    role: 'PLAYER',
    subject
  })
  const response = await base.stub.fetch(base.request(ticket))
  const socket = response.webSocket
  if (!socket) throw new Error('Missing player native test WebSocket.')
  trackSocket(socket)
  const messages: LiveSessionWebSocketServerMessageDto[] = []
  socket.addEventListener('message', (event) => {
    messages.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data))))
  })
  socket.accept()
  socket.send(
    JSON.stringify({
      type: 'AUTHENTICATE',
      accessToken: who === 'PLAYER' ? base.playerAccessToken : base.otherPlayerAccessToken
    })
  )
  await vi.waitFor(
    () => expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true),
    ROOM_REPLY_WAIT
  )
  return { messages, socket }
}

/** Admits the owner socket; the room builds the presented Scene before it sends the first STATE_SYNC. */
export async function synchronizeScene(base: LiveRoomFixture, scene: CampaignSceneStateDto) {
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(
    () =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          state: expect.objectContaining({ scene: expect.objectContaining({ id: scene.id }) }),
          type: 'STATE_SYNC'
        })
      ),
    ROOM_REPLY_WAIT
  )
}

/** Answers the Convex routes `handle` claims and leaves the rest to the room fixture's own routes. */
export async function routeEncounterRequests(
  base: LiveRoomFixture,
  handle: (
    pathname: string,
    request: Request
  ) => Promise<Response | undefined> | Response | undefined
) {
  await runInDurableObject(base.stub, () => {
    const previous = vi.mocked(globalThis.fetch).getMockImplementation()
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const handled = await handle(new URL(request.url).pathname, request.clone())
      if (handled) return handled
      if (!previous) throw new Error('Missing base native fetch mock.')
      return previous(input, init)
    })
  })
}

export function memberSocket(context: DurableObjectState, userId: string) {
  const socket = context
    .getWebSockets()
    .find(
      (candidate) => (candidate.deserializeAttachment() as { userId: string }).userId === userId
    )
  if (!socket) throw new Error('Missing member native socket.')
  return socket
}

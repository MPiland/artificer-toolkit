import { evictDurableObject, runInDurableObject, SELF } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionPresentationCommitInputSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionControlInput,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  liveSessionBootstrapInputSchema,
  liveSessionActivationInputSchema,
  liveSessionDrainReleaseInputSchema,
  liveSessionStorageRecoveryInputSchema,
  liveSessionAuthorityDtoSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import { liveSessionCheckpointInputSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  liveSessionTransientCaptureInputSchema,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createUniformSceneFogLayer, projectSceneForViewer } from '@artificer-toolkit/shared/vtt'

import { DurableCommandJournal } from '../src/durableCommandJournal.js'
import { planLiveSceneCommand } from '../src/nativeRoomSceneCommand.js'
import {
  createNativeLiveSessionState,
  hydrateNativeLiveSessionState,
  projectNativeLiveSessionState
} from '../src/nativeLiveSessionState.js'
import { ACCOUNT_BUCKETS, ROOM_LIMITS } from '../src/roomLimits.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import {
  liveRoomInputsInputSchema,
  type LiveRoomInputsResponse
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  ROOM_INPUTS_PATH,
  rawSceneDefinitionInputs,
  rawSceneInputs,
  roomInputsResponse
} from './roomInputsFixture.js'
import {
  sceneStoredLiveCommandSchema,
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import {
  sceneStoredFogLayerSchema,
  sceneStoredFogSaveSchema,
  sceneStoredFogChunkSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import {
  parseGeometryCommand,
  parseGeometrySave
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRunSchema,
  encounterStoredReplayReceiptSchema,
  encounterSceneBindingSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterCommandInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { insertPendingMovementDecision } from './pendingMovementFixture.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const sockets: WebSocket[] = []

function checkpointResponse(
  body: ReturnType<typeof liveSessionCheckpointInputSchema.parse>,
  members: Parameters<typeof roomAuthorizationResponse>[0]['members']
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
    authorization: roomAuthorizationResponse({ members })
  }
}

function fireCheckpointAlarm(stub: Awaited<ReturnType<typeof fixture>>['stub']) {
  return runInDurableObject(stub, async (instance) => {
    const clock = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + ROOM_LIMITS.checkpointDeadlineMs + 1)
    try {
      await instance.alarm()
    } finally {
      clock.mockRestore()
    }
  })
}

function checkpointReceipt(
  checkpoint: ReturnType<typeof liveSessionCheckpointInputSchema.parse>,
  commandId: string
) {
  const change = checkpoint.records.scenes
    .flatMap((scene) => scene.changes)
    .find((entry) => entry.table === 'sceneLiveCommands' && entry.key[1] === commandId)
  if (!change?.delta || !('set' in change.delta)) throw new Error('Missing checkpoint receipt.')
  return sceneStoredLiveCommandSchema.parse(change.delta.set)
}

function doorScene(campaignId: string) {
  const doorId = crypto.randomUUID()
  return {
    doorId,
    scene: {
      annotations: [],
      ambientIllumination: 'BRIGHT' as const,
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
function movementScene(campaignId: string): { scene: CampaignSceneStateDto; tokenId: string } {
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
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
  vi.restoreAllMocks()
})

/** Every fixture entity comes from the Scene definition, in order. */
/** A stored Scene receipt as the room sends it again for an exact retry: it reports the replay. */
function asReplay(message: LiveSessionWebSocketServerMessageDto | undefined) {
  if (message?.type !== 'COMMAND_COMMITTED' || message.delta?.scope !== 'SCENE')
    throw new Error('Expected a committed Scene command.')
  return {
    ...message,
    delta: { ...message.delta, result: { ...message.delta.result, replayed: true } }
  }
}

function baseOrdinals(scene: CampaignSceneStateDto) {
  return {
    tokens: scene.tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal })),
    barriers: scene.barriers.map((barrier, baseOrdinal) => ({
      barrierId: barrier.id,
      baseOrdinal
    }))
  }
}

function control(input: LiveSessionControlInput, workerSecret = secret) {
  return SELF.fetch(`https://session.test${LIVE_SESSION_CONTROL_PATH}`, {
    body: JSON.stringify(input),
    headers: {
      'content-type': 'application/json',
      [LIVE_SESSION_CONTROL_SECRET_HEADER]: workerSecret
    },
    method: 'POST'
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

function signTicket(input: {
  authorityEpoch: string
  campaignId: string
  issuedAt: number
  role: 'OWNER' | 'PLAYER'
  subject: string
}) {
  return new SignJWT({
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

async function fixture(scene: CampaignSceneStateDto | null = null) {
  const campaignId = scene?.campaignId ?? crypto.randomUUID()
  const authorityEpoch = crypto.randomUUID()
  const activationFingerprint = 'a'.repeat(64)
  const userId = crypto.randomUUID()
  const playerId = crypto.randomUUID()
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
  const accessToken = await issueAccessToken(issuedAt + 3_600)
  const playerAccessToken = await issueAccessTokenFor(playerId, issuedAt + 3_600)
  const capture: LiveSessionTransientCapture = {
    campaignId,
    systemId: crypto.randomUUID(),
    observedCharacterRevisions: [],
    origin: { membershipEpoch: new Date().toISOString(), role: 'OWNER', userId },
    presentation: scene ? { campaignId, sceneId: scene.id, version: 1 } : null,
    recipients: scene
      ? [{ membershipEpoch: new Date().toISOString(), role: 'PLAYER', userId: playerId }]
      : [],
    sceneEncounterId: null,
    originBoundTokenControl: [],
    sceneHeader: scene
      ? {
          ambientIllumination: scene.ambientIllumination,
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
      : null,
    sceneSnapshot: scene ? { scene, baseOrdinals: baseOrdinals(scene) } : null,
    visionFreshness: scene ? { campaign: null, play: null, system: null } : null
  }
  const stub = env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(campaignId))
  const captureModes: Array<'AUTHORITY' | 'FULL' | undefined> = []
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
    reads: 0
  }
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
      if (pathname === ROOM_INPUTS_PATH) {
        expect(request.headers.get('authorization')).toBeNull()
        const inputs = liveRoomInputsInputSchema.parse(await request.json())
        expect(inputs).toMatchObject({ campaignId, epoch: currentAuthorityEpoch })
        if (inputs.scope.kind === 'SCENE' || inputs.scope.kind === 'SCENE_DEFINITION') {
          const scene = capture.sceneSnapshot?.scene
          if (!capture.sceneHeader || !scene) throw new Error('Missing raw Scene fixture.')
          const sceneFixture = {
            scene,
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
            systemId: capture.systemId,
            ownerUserId: userId,
            members: authorization.members
          })
        )
      }
      if (pathname === '/live-sessions/checkpoint') {
        const body = liveSessionCheckpointInputSchema.parse(await request.json())
        persisted = { sequence: body.sequence, checksum: body.checksum }
        return Response.json(checkpointResponse(body, authorization.members))
      }
      if (pathname === ROOM_AUTHORIZATION_PATH) {
        expect(request.headers.get('authorization')).toBeNull()
        expect(await request.json()).toMatchObject({ campaignId })
        authorization.reads += 1
        return Response.json(roomAuthorizationResponse({ members: authorization.members }))
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        const expectedAccessToken =
          body.expectedUserId === userId
            ? accessToken
            : body.expectedUserId === playerId
              ? playerAccessToken
              : null
        expect(request.headers.get('authorization')).toBe(`Bearer ${expectedAccessToken}`)
        captureModes.push(body.mode)
        expect(body).toMatchObject({ campaignId })
        return Response.json({
          ...capture,
          origin: {
            membershipEpoch: capture.origin.membershipEpoch,
            role: body.expectedRole,
            userId: body.expectedUserId
          },
          recipients: scene
            ? [
                body.expectedUserId === userId
                  ? { ...capture.origin, role: 'PLAYER', userId: playerId }
                  : { ...capture.origin, role: 'OWNER', userId }
              ]
            : []
        })
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
  sockets.push(socket)
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
    captureModes,
    issueAccessToken,
    issuedAt,
    messages,
    playerAccessToken,
    playerId,
    request,
    socket,
    stub,
    userId
  }
}

async function connectPlayer(base: Awaited<ReturnType<typeof fixture>>) {
  const ticket = await signTicket({
    authorityEpoch: base.authorityEpoch,
    campaignId: base.capture.campaignId,
    issuedAt: base.issuedAt,
    role: 'PLAYER',
    subject: base.playerId
  })
  const response = await base.stub.fetch(base.request(ticket))
  const socket = response.webSocket
  if (!socket) throw new Error('Missing player native test WebSocket.')
  sockets.push(socket)
  const messages: LiveSessionWebSocketServerMessageDto[] = []
  socket.addEventListener('message', (event) => {
    messages.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data))))
  })
  socket.accept()
  socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.playerAccessToken }))
  await vi.waitFor(() =>
    expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  return { messages, socket }
}

async function synchronizeScene(
  base: Awaited<ReturnType<typeof fixture>>,
  scene: CampaignSceneStateDto
) {
  if (!base.capture.presentation) throw new Error('Missing Scene presentation.')
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  base.socket.send(
    JSON.stringify({
      expectedPresentationVersion: base.capture.presentation.version,
      sceneId: scene.id,
      type: 'SYNCHRONIZE_SCENE',
      version: scene.version
    })
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        state: expect.objectContaining({ scene: expect.objectContaining({ id: scene.id }) }),
        type: 'STATE_SYNC'
      })
    )
  )
}

function doorCommand(
  scene: CampaignSceneStateDto,
  doorId: string,
  commandId: string,
  overrides: {
    expectedSceneVersion?: number
    expectedSessionSequence?: number
    state?: 'OPEN' | 'CLOSED' | 'LOCKED'
  } = {}
) {
  return {
    command: {
      command: {
        barrierId: doorId,
        commandId,
        expectedSceneVersion: overrides.expectedSceneVersion ?? scene.version,
        sceneId: scene.id,
        state: overrides.state ?? 'OPEN',
        type: 'SET_SCENE_DOOR_STATE'
      },
      scope: 'SCENE'
    },
    expectedSessionSequence: overrides.expectedSessionSequence ?? 0,
    type: 'COMMAND'
  } as const
}

function tokenMoveCommand(
  scene: CampaignSceneStateDto,
  tokenId: string,
  commandId: string,
  position: { x: number; y: number },
  expectedSessionSequence = 0
) {
  const token = scene.tokens.find((candidate) => candidate.id === tokenId)
  if (!token) throw new Error('Missing movement test token.')
  return {
    command: {
      command: {
        commandId,
        correlationId: null,
        expectedEncounterVersion: null,
        expectedSceneVersion: scene.version,
        movementKind: 'VOLUNTARY',
        path: [token.position, position],
        sceneId: scene.id,
        tokenId,
        type: 'MOVE_SCENE_TOKEN'
      },
      scope: 'SCENE'
    },
    expectedSessionSequence,
    type: 'COMMAND'
  } as const
}

function undoMoveCommand(
  sceneId: string,
  commandId: string,
  expectedSceneVersion: number,
  expectedSessionSequence: number
) {
  return {
    command: {
      command: { commandId, expectedSceneVersion, sceneId, type: 'UNDO_LAST_SCENE_MOVE' },
      scope: 'SCENE'
    },
    expectedSessionSequence,
    type: 'COMMAND'
  } as const
}
it.each([0, 600])(
  'commits and projects a door with %s annotations before exact publication, then replays',
  async (annotationCount) => {
    const value: { doorId: string; scene: CampaignSceneStateDto } = doorScene(crypto.randomUUID())
    value.scene.annotations = Array.from({ length: annotationCount }, () => ({
      id: crypto.randomUUID(),
      position: { x: 20, y: 20 },
      text: 'é'.repeat(2000),
      visibility: 'GM_ONLY'
    }))
    if (annotationCount > 0)
      expect(new TextEncoder().encode(JSON.stringify(value.scene)).byteLength).toBeGreaterThan(
        2 * 1024 * 1024
      )
    const base = await fixture(value.scene)
    if (!base.capture.presentation) throw new Error('Missing Scene presentation.')
    base.capture.presentation.version = 2
    await synchronizeScene(base, value.scene)
    const player = await connectPlayer(base)
    base.messages.length = 0
    player.messages.length = 0

    const playerCommandId = crypto.randomUUID()
    player.socket.send(
      JSON.stringify(doorCommand(value.scene, value.doorId, playerCommandId, { state: 'OPEN' }))
    )
    await vi.waitFor(() =>
      expect(player.messages).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_COMMAND',
          commandId: playerCommandId,
          type: 'COMMAND_REJECTED'
        })
      )
    )
    player.messages.length = 0

    let publishStarted = false
    let publishFinished = false
    const publications: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
    let heldEvidence: {
      authority: { published_sequence: number; sequence: number }
      pendingWriteCount: number
    } | null = null
    await runInDurableObject(base.stub, (_instance, state) => {
      vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        expect(new URL(request.url).pathname).toBe('/live-sessions/checkpoint')
        const body = liveSessionCheckpointInputSchema.parse(await request.json())
        publications.push(body)
        const chain = state.storage.sql
          .exec<{ chain: string }>(
            'SELECT chain FROM room_writeset_log WHERE sequence = ?',
            body.sequence
          )
          .one()
        const head = state.storage.sql
          .exec<{ state_checksum: string; published_checksum: string }>(
            'SELECT state_checksum, published_checksum FROM durable_session_authority WHERE id = 1'
          )
          .one()
        expect(body.checksum).toBe(chain.chain)
        expect(body.checksum).toBe(head.state_checksum)
        expect(body.fromChecksum).toBe(head.published_checksum)
        heldEvidence = {
          authority: state.storage.sql
            .exec<{ published_sequence: number; sequence: number }>(
              'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
            )
            .one(),
          pendingWriteCount: state.storage.sql
            .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
            .one().count
        }
        publishStarted = true
        await new Promise((resolve) => setTimeout(resolve, 250))
        publishFinished = true
        return Response.json(checkpointResponse(body, base.authorization.members))
      })
    })

    const commandId = crypto.randomUUID()
    const command = doorCommand(value.scene, value.doorId, commandId)
    base.socket.send(JSON.stringify(command))
    await vi.waitFor(() => {
      expect(
        base.messages.some(
          (message) =>
            message.type === 'COMMAND_COMMITTED' &&
            message.commandId === commandId &&
            message.delta?.scope === 'SCENE'
        )
      ).toBe(true)
      expect(player.messages).toContainEqual({
        commandId,
        delta: { scope: 'SCENE_VERSION', sceneId: value.scene.id, version: 1 },
        sequence: 1,
        type: 'COMMAND_COMMITTED'
      })
    })
    expect(publishStarted).toBe(false)
    const pending = await journalEvidence(base)
    expect(pending).toMatchObject({
      authority: { published_sequence: 0, sequence: 1 },
      pendingWriteCount: 1
    })
    await runInDurableObject(base.stub, async (_instance, state) => {
      const receipt = state.storage.sql
        .exec<{ command_id: string; created_at: number }>(
          'SELECT command_id, created_at FROM durable_command_receipts WHERE command_id = ?',
          commandId
        )
        .one()
      expect(receipt.command_id).toBe(commandId)
      expect(await state.storage.getAlarm()).toBe(
        receipt.created_at + ROOM_LIMITS.checkpointDeadlineMs
      )
    })
    const alarm = fireCheckpointAlarm(base.stub)
    await vi.waitFor(() => expect(publishStarted).toBe(true))
    expect(heldEvidence).toEqual({
      authority: { published_sequence: 0, sequence: 1 },
      pendingWriteCount: 1
    })
    expect(publishFinished).toBe(false)

    await alarm
    expect(publishFinished).toBe(true)
    await vi.waitFor(async () => {
      const evidence = await runInDurableObject(base.stub, (_instance, state) => ({
        authority: state.storage.sql
          .exec<{ published_sequence: number; sequence: number }>(
            'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
          )
          .one(),
        pendingWriteCount: state.storage.sql
          .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
          .one().count
      }))
      expect(evidence).toEqual({
        authority: { published_sequence: 1, sequence: 1 },
        pendingWriteCount: 0
      })
    })

    const first = base.messages.find(
      (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
    )
    base.socket.send(JSON.stringify(command))
    await vi.waitFor(() =>
      expect(
        base.messages.filter(
          (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
        )
      ).toHaveLength(2)
    )
    expect(
      base.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )[1]
    ).toEqual(asReplay(first))

    base.socket.send(
      JSON.stringify(doorCommand(value.scene, value.doorId, commandId, { state: 'LOCKED' }))
    )
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({ code: 'INVALID_COMMAND', commandId, type: 'COMMAND_REJECTED' })
      )
    )
    expect(publications).toHaveLength(1)
    const publication = publications[0]
    if (!publication) throw new Error('Missing Scene checkpoint.')
    expect(publication).toMatchObject({ fromSequence: 0, sequence: 1 })
    expect(checkpointReceipt(publication, commandId)).toMatchObject({
      actorUserId: base.userId,
      input: command.command.command,
      result: {
        commandId,
        delta: { barrierId: value.doorId, kind: 'DOOR_STATE_SET', state: 'OPEN' },
        replayed: false,
        sceneId: value.scene.id,
        version: 1
      }
    })
    expect(publication.records.scenes).toContainEqual(
      expect.objectContaining({
        sceneId: value.scene.id,
        fromVersion: 0,
        toVersion: 1,
        changes: expect.arrayContaining([
          expect.objectContaining({ table: 'sceneLiveStates', key: [value.scene.id] }),
          expect.objectContaining({
            table: 'sceneLiveEntities',
            key: [value.scene.id, 'barriers', value.doorId]
          })
        ])
      })
    )
  }
)

it.each([false, true])(
  'serializes a Scene presentation switch behind publication (publication fails: %s)',
  async (publicationFails) => {
    const first = doorScene(crypto.randomUUID())
    const second = doorScene(first.scene.campaignId)
    const storedScenes = new Map<string, CampaignSceneStateDto>([
      [first.scene.id, first.scene],
      [second.scene.id, second.scene]
    ])
    const base = await fixture(first.scene)
    await synchronizeScene(base, first.scene)
    base.messages.length = 0

    const setCapturedScene = (scene: CampaignSceneStateDto) => {
      const header = base.capture.sceneHeader
      if (!header) throw new Error('Missing captured Scene header.')
      base.capture.sceneSnapshot = { scene, baseOrdinals: baseOrdinals(scene) }
      base.capture.sceneHeader = {
        ...header,
        definitionId: scene.definitionId,
        definitionVersion: scene.definitionVersion,
        id: scene.id,
        map: scene.map,
        name: scene.name,
        version: scene.version
      }
    }
    let releasePublication: (() => void) | undefined
    const heldPublication = new Promise<void>((resolve) => {
      releasePublication = resolve
    })
    const publications: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
    const presentations: Array<ReturnType<typeof liveSessionPresentationCommitInputSchema.parse>> =
      []
    await runInDurableObject(base.stub, (_instance, state) => {
      const originalFetch = vi.mocked(globalThis.fetch).getMockImplementation()
      if (!originalFetch) throw new Error('Missing native request fixture.')
      vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        const pathname = new URL(request.url).pathname
        if (pathname === '/live-sessions/checkpoint') {
          const body = liveSessionCheckpointInputSchema.parse(await request.json())
          publications.push(body)
          if (publications.length === 1) await heldPublication
          if (publicationFails) return new Response('Publication unavailable.', { status: 409 })
          expect(body.records.scenes).toHaveLength(1)
          const publishedScene = body.records.scenes[0]!
          expect(base.capture.presentation?.sceneId).toBe(publishedScene.sceneId)
          expect(base.capture.presentation?.version).toBe(publishedScene.presentationVersion)
          const receiptChange = publishedScene.changes.find(
            (change) => change.table === 'sceneLiveCommands'
          )
          if (!receiptChange?.delta || !('set' in receiptChange.delta))
            throw new Error('Missing Scene receipt.')
          const receipt = sceneStoredLiveCommandSchema.parse(receiptChange.delta.set)
          const result = receipt.result
          if (!('delta' in result) || result.delta?.kind !== 'DOOR_STATE_SET')
            throw new Error('Expected Scene door publication.')
          const stored = storedScenes.get(result.sceneId)
          if (!stored) throw new Error('Published Scene is missing.')
          const next = {
            ...stored,
            doorStates: { ...stored.doorStates, [result.delta.barrierId]: result.delta.state },
            version: result.version
          }
          storedScenes.set(result.sceneId, next)
          if (base.capture.presentation?.sceneId === result.sceneId) setCapturedScene(next)
          return Response.json(checkpointResponse(body, base.authorization.members))
        }
        if (pathname === '/live-sessions/present') {
          const body = liveSessionPresentationCommitInputSchema.parse(await request.json())
          const journal = state.storage.sql
            .exec<{
              published_sequence: number
              sequence: number
              state_checksum: string
            }>(
              'SELECT published_sequence, sequence, state_checksum FROM durable_session_authority WHERE id = 1'
            )
            .one()
          expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
          expect(journal.published_sequence).toBe(journal.sequence)
          expect(body).toMatchObject({
            actorUserId: base.userId,
            campaignId: first.scene.campaignId,
            epoch: base.authorityEpoch,
            expectedSequence: journal.sequence,
            expectedStateChecksum: journal.state_checksum
          })
          presentations.push(body)
          const target = body.input.sceneId ? storedScenes.get(body.input.sceneId) : null
          if (!target) throw new Error('Presented Scene is missing.')
          const version = (base.capture.presentation?.version ?? 0) + 1
          base.capture.presentation = {
            sceneId: target.id,
            campaignId: base.capture.campaignId,
            version
          }
          setCapturedScene(target)
          return Response.json({
            commandId: body.input.commandId,
            replayed: false,
            sceneId: target.id,
            campaignId: base.capture.campaignId,
            version
          })
        }
        return originalFetch(input, init)
      })
    })

    const firstCommandId = crypto.randomUUID()
    const firstCommand = doorCommand(first.scene, first.doorId, firstCommandId)
    base.socket.send(JSON.stringify(firstCommand))
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          commandId: firstCommandId,
          sequence: 1,
          type: 'COMMAND_COMMITTED'
        })
      )
    )

    const firstSwitchCommandId = crypto.randomUUID()
    const switchToSecond = control({
      campaignId: first.scene.campaignId,
      operation: {
        actorUserId: base.userId,
        epoch: base.authorityEpoch,
        input: {
          commandId: firstSwitchCommandId,
          expectedPresentationVersion: 1,
          sceneId: second.scene.id,
          campaignId: base.capture.campaignId,
          type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
        },
        type: 'SET_SCENE_PRESENTATION'
      }
    })
    await vi.waitFor(() => expect(publications).toHaveLength(1))
    let switchSettled = false
    void switchToSecond.then(() => {
      switchSettled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(switchSettled).toBe(false)
    expect(presentations).toHaveLength(0)
    releasePublication?.()

    const switched = await switchToSecond
    if (publicationFails) {
      expect(switched.status).toBe(409)
      expect(presentations).toHaveLength(0)
      await runInDurableObject(base.stub, (_instance, state) => {
        expect(
          state.storage.sql
            .exec<{ published_sequence: number; sequence: number }>(
              'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
            )
            .one()
        ).toEqual({ published_sequence: 0, sequence: 1 })
        expect(
          state.storage.sql
            .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
            .one().count
        ).toBe(1)
        expect(
          state.storage.sql
            .exec<{ count: number }>(
              'SELECT COUNT(*) AS count FROM durable_command_receipts WHERE command_id = ?',
              firstCommandId
            )
            .one().count
        ).toBe(1)
      })
      return
    }

    expect(switched.status).toBe(200)
    expect(await switched.json()).toMatchObject({
      commandId: firstSwitchCommandId,
      sceneId: second.scene.id,
      version: 2
    })
    expect(presentations).toHaveLength(1)
    await vi.waitFor(() =>
      expect(base.messages.some((message) => message.type === 'AUTHENTICATION_REQUIRED')).toBe(true)
    )
    base.messages.length = 0
    await synchronizeScene(base, second.scene)
    base.messages.length = 0

    const staleCommandId = crypto.randomUUID()
    base.socket.send(
      JSON.stringify(
        doorCommand(first.scene, first.doorId, staleCommandId, {
          expectedSessionSequence: 1
        })
      )
    )
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          code: 'STALE_STATE',
          commandId: staleCommandId,
          correction: expect.objectContaining({
            scope: 'SCENE',
            state: expect.objectContaining({ id: second.scene.id })
          }),
          type: 'COMMAND_REJECTED'
        })
      )
    )
    base.messages.length = 0

    const secondCommandId = crypto.randomUUID()
    base.socket.send(
      JSON.stringify(
        doorCommand(second.scene, second.doorId, secondCommandId, {
          expectedSessionSequence: 1
        })
      )
    )
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          commandId: secondCommandId,
          sequence: 2,
          type: 'COMMAND_COMMITTED'
        })
      )
    )
    await fireCheckpointAlarm(base.stub)
    await vi.waitFor(async () => {
      const published = await runInDurableObject(base.stub, (_instance, state) =>
        state.storage.sql
          .exec<{ published_sequence: number; sequence: number }>(
            'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
          )
          .one()
      )
      expect(published).toEqual({ published_sequence: 2, sequence: 2 })
    })

    const secondSwitchCommandId = crypto.randomUUID()
    const switchedBack = await control({
      campaignId: first.scene.campaignId,
      operation: {
        actorUserId: base.userId,
        epoch: base.authorityEpoch,
        input: {
          commandId: secondSwitchCommandId,
          expectedPresentationVersion: 2,
          sceneId: first.scene.id,
          campaignId: base.capture.campaignId,
          type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
        },
        type: 'SET_SCENE_PRESENTATION'
      }
    })
    expect(switchedBack.status).toBe(200)
    expect(await switchedBack.json()).toMatchObject({
      commandId: secondSwitchCommandId,
      sceneId: first.scene.id,
      version: 3
    })
    base.messages.length = 0
    const restoredFirst = storedScenes.get(first.scene.id)
    if (!restoredFirst) throw new Error('Original Scene was not retained.')
    await synchronizeScene(base, restoredFirst)
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          sequence: 2,
          state: expect.objectContaining({
            scene: expect.objectContaining({
              doorStates: expect.objectContaining({ [first.doorId]: 'OPEN' }),
              id: first.scene.id,
              version: 1
            })
          }),
          type: 'STATE_SYNC'
        })
      )
    )
    base.messages.length = 0

    const finalCommandId = crypto.randomUUID()
    base.socket.send(
      JSON.stringify(
        doorCommand(restoredFirst, first.doorId, finalCommandId, {
          expectedSessionSequence: 2,
          state: 'CLOSED'
        })
      )
    )
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          commandId: finalCommandId,
          sequence: 3,
          type: 'COMMAND_COMMITTED'
        })
      )
    )
    await fireCheckpointAlarm(base.stub)
    await vi.waitFor(async () => {
      const final = await runInDurableObject(base.stub, (_instance, state) => ({
        authority: state.storage.sql
          .exec<{ published_sequence: number; sequence: number }>(
            'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
          )
          .one(),
        pendingWriteCount: state.storage.sql
          .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
          .one().count
      }))
      expect(final).toEqual({
        authority: { published_sequence: 3, sequence: 3 },
        pendingWriteCount: 0
      })
    })
    expect(presentations.map((entry) => entry.expectedSequence)).toEqual([1, 2])
  }
)

it('keeps the new presentation fence when an older authentication capture finishes late', async () => {
  const { doorId, scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  base.messages.length = 0

  let releaseCapture: (() => void) | undefined
  let markCaptureStarted: (() => void) | undefined
  const captureStarted = new Promise<void>((resolve) => {
    markCaptureStarted = resolve
  })
  const heldCapture = new Promise<void>((resolve) => {
    releaseCapture = resolve
  })
  let holdNextCapture = true
  let delayedAuthentication: Promise<void> | undefined
  const publications: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
  await runInDurableObject(base.stub, (instance, state) => {
    const originalFetch = vi.mocked(globalThis.fetch).getMockImplementation()
    if (!originalFetch) throw new Error('Missing native request fixture.')
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      if (pathname === '/live-sessions/capture' && holdNextCapture) {
        holdNextCapture = false
        const oldCapture = (await originalFetch(input, init)).clone()
        markCaptureStarted?.()
        await heldCapture
        return oldCapture
      }
      if (pathname === '/live-sessions/present') {
        const body = liveSessionPresentationCommitInputSchema.parse(await request.json())
        expect(body.input.sceneId).toBe(scene.id)
        expect(body.input.expectedPresentationVersion).toBe(1)
        base.capture.presentation = {
          sceneId: scene.id,
          campaignId: base.capture.campaignId,
          version: 2
        }
        return Response.json({
          commandId: body.input.commandId,
          replayed: false,
          sceneId: scene.id,
          campaignId: base.capture.campaignId,
          version: 2
        })
      }
      if (pathname === '/live-sessions/checkpoint') {
        const body = liveSessionCheckpointInputSchema.parse(await request.json())
        publications.push(body)
        expect(base.capture.presentation?.version).toBe(2)
        expect(body.records.scenes[0]?.presentationVersion).toBe(2)
        return Response.json(checkpointResponse(body, base.authorization.members))
      }
      return originalFetch(input, init)
    })
    const socket = state.getWebSockets()[0]
    if (!socket) throw new Error('Missing native server socket.')
    delayedAuthentication = instance.webSocketMessage(
      socket,
      JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken })
    )
  })
  await captureStarted

  const switched = await control({
    campaignId: scene.campaignId,
    operation: {
      actorUserId: base.userId,
      epoch: base.authorityEpoch,
      input: {
        commandId: crypto.randomUUID(),
        expectedPresentationVersion: 1,
        sceneId: scene.id,
        campaignId: base.capture.campaignId,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      },
      type: 'SET_SCENE_PRESENTATION'
    }
  })
  expect(switched.status).toBe(200)
  const player = await connectPlayer(base)
  const synchronizePlayer = () =>
    player.socket.send(
      JSON.stringify({
        expectedPresentationVersion: 2,
        sceneId: scene.id,
        type: 'SYNCHRONIZE_SCENE',
        version: scene.version
      })
    )
  synchronizePlayer()
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        state: expect.objectContaining({ scene: expect.objectContaining({ id: scene.id }) }),
        type: 'STATE_SYNC'
      })
    )
  )
  player.messages.length = 0

  releaseCapture?.()
  await delayedAuthentication
  synchronizePlayer()
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        state: expect.objectContaining({ scene: expect.objectContaining({ id: scene.id }) }),
        type: 'STATE_SYNC'
      })
    )
  )
  base.messages.length = 0
  await synchronizeScene(base, scene)
  base.messages.length = 0
  const commandId = crypto.randomUUID()
  base.socket.send(JSON.stringify(doorCommand(scene, doorId, commandId)))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ commandId, sequence: 1, type: 'COMMAND_COMMITTED' })
    )
  )
  expect(publications).toHaveLength(0)
  await fireCheckpointAlarm(base.stub)
  expect(publications).toHaveLength(1)
})

it('commits standalone movement and its Scene-history undo, replays, and rejects an uncontrolled player', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  if (!base.capture.presentation) throw new Error('Missing Scene presentation.')
  base.capture.presentation.version = 2
  await synchronizeScene(base, value.scene)
  const player = await connectPlayer(base)
  base.messages.length = 0
  player.messages.length = 0

  const rejectedCommandId = crypto.randomUUID()
  player.socket.send(
    JSON.stringify(
      tokenMoveCommand(value.scene, value.tokenId, rejectedCommandId, { x: 20, y: 10 })
    )
  )
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        commandId: rejectedCommandId,
        type: 'COMMAND_REJECTED'
      })
    )
  )
  player.messages.length = 0

  const publications: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
  const heldEvidence: Array<{
    authority: { published_sequence: number; sequence: number }
    pendingWriteCount: number
  }> = []
  let publishFinished = 0
  await runInDurableObject(base.stub, (_instance, state) => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      expect(new URL(request.url).pathname).toBe('/live-sessions/checkpoint')
      const body = liveSessionCheckpointInputSchema.parse(await request.json())
      publications.push(body)
      heldEvidence.push({
        authority: state.storage.sql
          .exec<{ published_sequence: number; sequence: number }>(
            'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
          )
          .one(),
        pendingWriteCount: state.storage.sql
          .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
          .one().count
      })
      await new Promise((resolve) => setTimeout(resolve, 250))
      publishFinished += 1
      return Response.json(checkpointResponse(body, base.authorization.members))
    })
  })

  const movedPosition = { x: 20, y: 10 }
  const moveCommandId = crypto.randomUUID()
  const move = tokenMoveCommand(value.scene, value.tokenId, moveCommandId, movedPosition)
  base.socket.send(JSON.stringify(move))
  const moveCommitted = {
    commandId: moveCommandId,
    delta: {
      scope: 'SCENE' as const,
      result: {
        commandId: moveCommandId,
        delta: { kind: 'TOKEN_MOVED' as const, position: movedPosition, tokenId: value.tokenId },
        occurrence: null,
        replayed: false,
        sceneId: value.scene.id,
        version: 1
      }
    },
    sequence: 1,
    type: 'COMMAND_COMMITTED' as const
  }
  await vi.waitFor(() => {
    expect(base.messages).toContainEqual(moveCommitted)
    expect(player.messages).toContainEqual({
      commandId: moveCommandId,
      delta: { scope: 'SCENE_VERSION', sceneId: value.scene.id, version: 1 },
      sequence: 1,
      type: 'COMMAND_COMMITTED'
    })
  })
  expect(publications).toHaveLength(0)
  expect(await journalEvidence(base)).toMatchObject({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
  const moveAlarm = fireCheckpointAlarm(base.stub)
  await vi.waitFor(() => expect(publications).toHaveLength(1))
  expect(heldEvidence[0]).toEqual({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
  expect(publishFinished).toBe(0)

  await moveAlarm
  expect(publishFinished).toBe(1)
  await vi.waitFor(async () => {
    const state = await runInDurableObject(base.stub, (_instance, durableState) =>
      durableState.storage.sql
        .exec<{ published_sequence: number; sequence: number }>(
          'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
        )
        .one()
    )
    expect(state).toEqual({ published_sequence: 1, sequence: 1 })
  })

  base.socket.send(JSON.stringify(move))
  await vi.waitFor(() =>
    expect(
      base.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === moveCommandId
      )
    ).toHaveLength(2)
  )
  expect(
    base.messages.filter(
      (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === moveCommandId
    )[1]
  ).toEqual(asReplay(moveCommitted))
  expect(publications).toHaveLength(1)

  base.messages.length = 0
  player.messages.length = 0
  const undoCommandId = crypto.randomUUID()
  const undo = undoMoveCommand(value.scene.id, undoCommandId, 1, 1)
  base.socket.send(JSON.stringify(undo))
  const undoCommitted = {
    commandId: undoCommandId,
    delta: {
      scope: 'SCENE' as const,
      result: {
        commandId: undoCommandId,
        delta: {
          kind: 'TOKEN_MOVE_UNDONE' as const,
          position: { x: 10, y: 10 },
          tokenId: value.tokenId,
          undoneCommandId: moveCommandId
        },
        occurrence: null,
        replayed: false,
        sceneId: value.scene.id,
        version: 2
      }
    },
    sequence: 2,
    type: 'COMMAND_COMMITTED' as const
  }
  await vi.waitFor(() => {
    expect(base.messages).toContainEqual(undoCommitted)
    expect(player.messages).toContainEqual({
      commandId: undoCommandId,
      delta: { scope: 'SCENE_VERSION', sceneId: value.scene.id, version: 2 },
      sequence: 2,
      type: 'COMMAND_COMMITTED'
    })
  })
  expect(publications).toHaveLength(1)
  const undoAlarm = fireCheckpointAlarm(base.stub)
  await vi.waitFor(() => expect(publications).toHaveLength(2))
  expect(heldEvidence[1]).toEqual({
    authority: { published_sequence: 1, sequence: 2 },
    pendingWriteCount: 1
  })
  expect(publishFinished).toBe(1)

  await undoAlarm
  expect(publishFinished).toBe(2)
  base.socket.send(JSON.stringify(undo))
  await vi.waitFor(() =>
    expect(
      base.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === undoCommandId
      )
    ).toHaveLength(2)
  )
  expect(
    base.messages.filter(
      (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === undoCommandId
    )[1]
  ).toEqual(asReplay(undoCommitted))
  expect(publications).toHaveLength(2)

  const exhaustedUndoId = crypto.randomUUID()
  base.socket.send(JSON.stringify(undoMoveCommand(value.scene.id, exhaustedUndoId, 2, 2)))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_COMMAND',
        commandId: exhaustedUndoId,
        type: 'COMMAND_REJECTED'
      })
    )
  )
  expect(publications).toHaveLength(2)

  const movePublication = publications[0]!
  const undoPublication = publications[1]!
  expect(movePublication).toMatchObject({
    campaignId: base.capture.campaignId,
    epoch: base.authorityEpoch,
    fromSequence: 0,
    sequence: 1,
    checksum: expect.any(String)
  })
  expect(checkpointReceipt(movePublication, moveCommandId)).toMatchObject({
    actorUserId: base.userId,
    input: move.command.command,
    result: moveCommitted.delta.result
  })
  expect(undoPublication).toMatchObject({
    campaignId: base.capture.campaignId,
    epoch: base.authorityEpoch,
    fromSequence: 1,
    fromChecksum: movePublication.checksum,
    sequence: 2
  })
  expect(checkpointReceipt(undoPublication, undoCommandId)).toMatchObject({
    actorUserId: base.userId,
    input: undo.command.command,
    result: undoCommitted.delta.result
  })

  await vi.waitFor(async () => {
    const current = await runInDurableObject(base.stub, (_instance, state) =>
      state.storage.sql
        .exec<{
          published_sequence: number
          sequence: number
          state_checksum: string
          state_json: string
        }>(
          `SELECT published_sequence, sequence, state_checksum, state_json
           FROM durable_session_authority WHERE id = 1`
        )
        .one()
    )
    const restored = hydrateNativeLiveSessionState(current.state_json)
    expect(current).toMatchObject({ published_sequence: 2, sequence: 2 })
    expect(restored.scene?.tokens[0]?.position).toEqual({ x: 10, y: 10 })
  })
})

async function journalEvidence(base: Awaited<ReturnType<typeof fixture>>) {
  return runInDurableObject(base.stub, (_instance, state) => ({
    authority: state.storage.sql
      .exec<{ published_sequence: number; sequence: number }>(
        'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
      )
      .one(),
    pendingWriteCount: state.storage.sql
      .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
      .one().count
  }))
}

it('commits an unbound token move on an Encounter-bound Scene in SQLite before acknowledgement (D27)', async () => {
  const { base, player, state, scene, tokenId } = await localEncounterFixture([], {
    unboundSceneToken: true
  })
  base.messages.length = 0
  player.messages.length = 0
  const commandId = crypto.randomUUID()
  const command = tokenMoveCommand(scene, tokenId, commandId, { x: 20, y: 10 })
  const committed = await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const originalSend = socket.send.bind(socket)
    let checkedBeforeAck = false
    const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
        expect(message).toMatchObject({
          sequence: 1,
          delta: {
            scope: 'SCENE',
            result: {
              sceneId: scene.id,
              version: 1,
              occurrence: null,
              delta: { kind: 'TOKEN_MOVED', tokenId, position: { x: 20, y: 10 } }
            }
          }
        })
        const evidence = localEncounterEvidence(context.storage)
        expect(evidence.state).toEqual(state)
        expect(evidence.bindings).toEqual([])
        expect(evidence.commands).toEqual([])
        expect(evidence.sequence).toBe(1)
        expect(evidence.writes).toHaveLength(1)
        expect(evidence.receipts).toHaveLength(1)
        expect(evidence.receipts[0]).toMatchObject({
          command_id: commandId,
          sequence: 1,
          state_checksum: evidence.checksum
        })
        const storedReceipt = evidence.receipts[0]?.receipt_json
        if (typeof storedReceipt !== 'string') throw new Error('Missing durable Scene receipt.')
        expect(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(storedReceipt))).toEqual(
          message
        )
        expect(evidence.authority).toEqual({
          sequence: 1,
          state_checksum: evidence.checksum,
          published_sequence: 0
        })
        const room = new RoomEncounterStore(context.storage)
        expect(room.documents('encounterSceneBindings')).toHaveLength(1)
        expect(room.documents('encounterSceneBindings')[0]).toMatchObject({
          encounterId: state.id,
          sceneId: scene.id,
          campaignId: scene.campaignId
        })
        const rows = room.records('SCENE_CHECKPOINT_ROW')
        const headRow = rows.find(
          ({ key }) => key === JSON.stringify(['sceneLiveStates', scene.id])
        )
        const entityRow = rows.find(
          ({ key }) => key === JSON.stringify(['sceneLiveEntities', scene.id, 'tokens', tokenId])
        )
        const receiptRow = rows.find(
          ({ key }) => key === JSON.stringify(['sceneLiveCommands', scene.id, commandId])
        )
        const saveRow = rows.find(({ key }) => JSON.parse(key)[0] === 'sceneGeometrySaves')
        const sourceRow = room
          .records('SCENE_CHECKPOINT_SOURCE')
          .find(({ key }) => key === scene.id)
        if (!headRow || !entityRow || !receiptRow || !saveRow || !sourceRow)
          throw new Error('Missing committed native Scene evidence.')
        const head = sceneStoredLiveStateSchema.parse(JSON.parse(headRow.json))
        expect(head).toMatchObject({
          sceneId: scene.id,
          version: 1,
          counts: { tokens: 1 },
          nextOrdinals: { tokens: 1 },
          fogLayerCount: 0,
          nextFogOrdinal: 0
        })
        const entity = sceneStoredLiveEntitySchema.parse(JSON.parse(entityRow.json))
        const { checksum, ...fields } = entity
        expect(checksum).toBe(checksumCanonicalJson(fields))
        expect(entity).toMatchObject({
          sceneId: scene.id,
          collection: 'tokens',
          entityId: tokenId,
          ordinal: 0,
          version: 1,
          value: { collection: 'tokens', entity: { id: tokenId, position: { x: 20, y: 10 } } }
        })
        const receipt = parseGeometryCommand(JSON.parse(receiptRow.json), head.version)
        expect(receipt).toMatchObject({
          sceneId: scene.id,
          commandId,
          actorUserId: base.userId,
          encoding: 'GEOMETRY',
          input: { type: 'MOVE_SCENE_TOKEN', expectedEncounterVersion: null, tokenId },
          result: { version: 1, replayed: false, occurrence: null, fogPatches: [] }
        })
        const save = parseGeometrySave(JSON.parse(saveRow.json))
        expect(save).toMatchObject({
          sceneId: scene.id,
          commandId,
          actorUserId: base.userId,
          status: 'PUBLISHED',
          snapshotVersion: 0,
          fogSaves: [],
          input: receipt.input
        })
        expect(rows.some(({ key }) => JSON.parse(key)[0] === 'sceneFogSaves')).toBe(false)
        expect(liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(sourceRow.json))).toEqual({
          sceneId: scene.id,
          definitionSaveId: base.capture.sceneHeader!.definitionSaveId,
          definitionVersion: base.capture.sceneHeader!.definitionVersion,
          presentationVersion: base.capture.presentation!.version
        })
        const writeSet = evidence.writes[0]
        if (typeof writeSet?.json !== 'string') throw new Error('Missing native Scene write set.')
        expect(JSON.parse(writeSet.json)).toEqual(
          expect.arrayContaining(
            [headRow, entityRow, receiptRow, saveRow].map((record) => ({
              op: 'RECORD_SET',
              record
            }))
          )
        )
        expect(writeSet.chain).toBe(evidence.checksum)
        checkedBeforeAck = true
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(socket, JSON.stringify(command))
      expect(checkedBeforeAck).toBe(true)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      return localEncounterEvidence(context.storage)
    } finally {
      sent.mockRestore()
    }
  })
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        type: 'COMMAND_COMMITTED',
        commandId,
        sequence: 1,
        delta: {
          scope: 'SCENE',
          result: expect.objectContaining({
            occurrence: null,
            delta: { kind: 'TOKEN_MOVED', tokenId, position: { x: 20, y: 10 } }
          })
        }
      })
    )
  )
  expect(JSON.stringify(player.messages)).not.toContain('Private notes')
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
  const first = base.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  base.socket.send(JSON.stringify(command))
  await vi.waitFor(() =>
    expect(
      base.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toEqual([first, asReplay(first)])
  )
  const moved = {
    ...scene,
    tokens: scene.tokens.map((token) => ({ ...token, position: { x: 20, y: 10 } })),
    version: 1
  }
  base.socket.send(JSON.stringify(tokenMoveCommand(moved, tokenId, commandId, { x: 30, y: 10 }, 1)))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_COMMAND',
        commandId,
        type: 'COMMAND_REJECTED'
      })
    )
  )
  await runInDurableObject(base.stub, (_instance, context) => {
    expect(localEncounterEvidence(context.storage)).toEqual(committed)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
})

it('rolls back native bound-Scene geometry and journal writes when SQLite receipt insertion fails', async () => {
  const { base, scene, tokenId } = await localEncounterFixture([], { unboundSceneToken: true })
  const commandId = crypto.randomUUID()
  const command = tokenMoveCommand(scene, tokenId, commandId, { x: 20, y: 10 })
  await runInDurableObject(base.stub, async (instance, context) => {
    const before = localEncounterEvidence(context.storage)
    const room = new RoomEncounterStore(context.storage)
    const beforeRows = room.records('SCENE_CHECKPOINT_ROW')
    const beforeSources = room.records('SCENE_CHECKPOINT_SOURCE')
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    // The receipt is inserted after the complete Scene write set in the same SQLite transaction.
    context.storage.sql.exec(
      "CREATE TRIGGER abort_scene_receipt AFTER INSERT ON durable_command_receipts WHEN EXISTS (SELECT 1 FROM room_writeset_log WHERE sequence = NEW.sequence AND json LIKE '%sceneLiveCommands%' AND json LIKE '%sceneGeometrySaves%' AND json LIKE '%sceneLiveEntities%' AND json LIKE '%sceneLiveStates%') BEGIN SELECT RAISE(ABORT, 'Injected Scene SQLite failure'); END"
    )
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    let triggerInstalled = true
    try {
      await instance.webSocketMessage(socket, JSON.stringify(command))
      const messages = sent.mock.calls.map(([data]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      )
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId
        })
      )
      expect(messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
      expect(localEncounterEvidence(context.storage)).toEqual(before)
      const recovered = new RoomEncounterStore(context.storage)
      expect(recovered.records('SCENE_CHECKPOINT_ROW')).toEqual(beforeRows)
      expect(recovered.records('SCENE_CHECKPOINT_SOURCE')).toEqual(beforeSources)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      context.storage.sql.exec('DROP TRIGGER abort_scene_receipt')
      triggerInstalled = false
      await instance.webSocketMessage(socket, JSON.stringify(command))
      const retry = localEncounterEvidence(context.storage)
      expect(retry.sequence).toBe(1)
      expect(retry.writes).toHaveLength(1)
      expect(retry.receipts).toHaveLength(1)
      const receiptRow = new RoomEncounterStore(context.storage)
        .records('SCENE_CHECKPOINT_ROW')
        .find(({ key }) => key === JSON.stringify(['sceneLiveCommands', scene.id, commandId]))
      if (!receiptRow) throw new Error('Missing retried native Scene receipt.')
      expect(parseGeometryCommand(JSON.parse(receiptRow.json), 1).result).toMatchObject({
        version: 1,
        replayed: false,
        occurrence: null
      })
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      if (triggerInstalled) context.storage.sql.exec('DROP TRIGGER abort_scene_receipt')
      sent.mockRestore()
    }
  })
})

it('commits each fog owner with native geometry before acknowledgement and resynchronizes the table (D52)', async () => {
  const value = movementScene(crypto.randomUUID())
  value.scene.fogMode = 'PER_PLAYER'
  value.scene.tokens[0]!.vision = { ...value.scene.tokens[0]!.vision!, dimRange: 30, enabled: true }
  const base = await fixture(value.scene)
  const owners = [base.userId, base.playerId].sort()
  value.scene.tokens[0]!.controlledByUserIds = owners
  await synchronizeScene(base, value.scene)
  const player = await connectPlayer(base)
  base.messages.length = 0
  const commandId = crypto.randomUUID()
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing native fog owner socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const originalSend = socket.send.bind(socket)
    let checkedBeforeAck = false
    const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
        const room = new RoomEncounterStore(context.storage)
        const rows = room.records('SCENE_CHECKPOINT_ROW')
        const layers = rows
          .filter(({ key }) => JSON.parse(key)[0] === 'sceneFogLayers')
          .map(({ json }) => sceneStoredFogLayerSchema.parse(JSON.parse(json)))
        const saves = rows
          .filter(({ key }) => JSON.parse(key)[0] === 'sceneFogSaves')
          .map(({ json }) => sceneStoredFogSaveSchema.parse(JSON.parse(json)))
        const chunks = rows
          .filter(({ key }) => JSON.parse(key)[0] === 'sceneFogChunks')
          .map(({ json }) => sceneStoredFogChunkSchema.parse(JSON.parse(json)))
        expect(layers.map(({ ownerUserId }) => ownerUserId).sort()).toEqual(owners)
        expect(saves.map(({ input }) => input.layer.ownerUserId).sort()).toEqual(owners)
        expect(
          saves.every(
            ({ status, geometrySaveId }) => status === 'PUBLISHED' && geometrySaveId !== undefined
          )
        ).toBe(true)
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks.every(({ saveId }) => saves.some(({ id }) => id === saveId))).toBe(true)
        const head = rows.find(
          ({ key }) => key === JSON.stringify(['sceneLiveStates', value.scene.id])
        )
        if (!head) throw new Error('Missing native fog Scene head.')
        expect(sceneStoredLiveStateSchema.parse(JSON.parse(head.json))).toMatchObject({
          version: 1,
          fogLayerCount: 2
        })
        expect(
          context.storage.sql
            .exec('SELECT command_id, sequence FROM durable_command_receipts')
            .toArray()
        ).toEqual([{ command_id: commandId, sequence: 1 }])
        expect(
          context.storage.sql.exec('SELECT sequence FROM room_writeset_log').toArray()
        ).toEqual([{ sequence: 1 }])
        expect(globalThis.fetch).not.toHaveBeenCalled()
        checkedBeforeAck = true
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(
        socket,
        JSON.stringify(tokenMoveCommand(value.scene, value.tokenId, commandId, { x: 20, y: 10 }))
      )
      expect(checkedBeforeAck).toBe(true)
    } finally {
      sent.mockRestore()
    }
  })
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        sequence: 1,
        state: expect.objectContaining({
          scene: expect.objectContaining({
            fogLayers: expect.arrayContaining(
              owners.map((ownerUserId) => expect.objectContaining({ ownerUserId }))
            )
          })
        }),
        type: 'STATE_SYNC'
      })
    )
  )
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        sequence: 1,
        state: expect.objectContaining({
          scene: expect.objectContaining({
            fogLayers: [expect.objectContaining({ ownerUserId: base.playerId })]
          })
        }),
        type: 'STATE_SYNC'
      })
    )
  )
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
})

it('recovers a native Scene commit whose acknowledgement was lost and retries without a duplicate write (D27)', async () => {
  const { base, scene, tokenId } = await localEncounterFixture([], { unboundSceneToken: true })
  const commandId = crypto.randomUUID()
  const command = tokenMoveCommand(scene, tokenId, commandId, { x: 20, y: 10 })
  base.messages.length = 0
  const durable = await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing native lost-ack socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const originalSend = socket.send.bind(socket)
    let lostAck = false
    const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
        lostAck = true
        return
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(socket, JSON.stringify(command))
      expect(lostAck).toBe(true)
      const evidence = localEncounterEvidence(context.storage)
      expect(evidence.sequence).toBe(1)
      expect(evidence.receipts).toHaveLength(1)
      expect(evidence.writes).toHaveLength(1)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      return {
        evidence,
        sceneRows: new RoomEncounterStore(context.storage).records('SCENE_CHECKPOINT_ROW')
      }
    } finally {
      sent.mockRestore()
    }
  })
  expect(
    base.messages.some(
      (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
    )
  ).toBe(false)
  await evictDurableObject(base.stub)
  const moved: CampaignSceneStateDto = {
    ...scene,
    version: 1,
    tokens: scene.tokens.map((token) => ({ ...token, position: { x: 20, y: 10 } }))
  }
  await runInDurableObject(base.stub, (_instance, context) => {
    expect(localEncounterEvidence(context.storage)).toEqual(durable.evidence)
    expect(new RoomEncounterStore(context.storage).records('SCENE_CHECKPOINT_ROW')).toEqual(
      durable.sceneRows
    )
  })
  let publishedSequence = 0
  let publishedChecksum = 'a'.repeat(64)
  const checkpoints: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === '/live-sessions/checkpoint') {
      const checkpoint = liveSessionCheckpointInputSchema.parse(await request.json())
      expect(checkpoint.sequence).toBe(1)
      expect(checkpoint.checksum).toBe(durable.evidence.checksum)
      checkpoints.push(checkpoint)
      publishedSequence = checkpoint.sequence
      publishedChecksum = checkpoint.checksum
      base.capture.sceneSnapshot = { scene: moved, baseOrdinals: baseOrdinals(moved) }
      if (!base.capture.sceneHeader) throw new Error('Missing published recovery Scene header.')
      base.capture.sceneHeader = { ...base.capture.sceneHeader, version: moved.version }
      return Response.json(checkpointResponse(checkpoint, base.authorization.members))
    }
    if (pathname === '/live-sessions/bootstrap')
      return Response.json({
        activationFingerprint: 'a'.repeat(64),
        persistedSequence: publishedSequence,
        persistedStateChecksum: publishedChecksum
      })
    return undefined
  })
  base.messages.length = 0
  await synchronizeScene(base, moved)
  expect(checkpoints).toHaveLength(1)
  await runInDurableObject(base.stub, async (instance, context) => {
    const recovered = localEncounterEvidence(context.storage)
    expect(recovered).toEqual({
      ...durable.evidence,
      writes: [],
      authority: { ...durable.evidence.authority, published_sequence: 1 }
    })
    expect(new RoomEncounterStore(context.storage).records('SCENE_CHECKPOINT_ROW')).toEqual(
      durable.sceneRows
    )
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing recovered native Scene socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    try {
      await instance.webSocketMessage(socket, JSON.stringify(command))
      const messages = sent.mock.calls.map(([data]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      )
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'COMMAND_COMMITTED',
          commandId,
          sequence: 1,
          delta: expect.objectContaining({
            scope: 'SCENE',
            result: expect.objectContaining({ replayed: true, version: 1 })
          })
        })
      )
      expect(localEncounterEvidence(context.storage)).toEqual(recovered)
      expect(new RoomEncounterStore(context.storage).records('SCENE_CHECKPOINT_ROW')).toEqual(
        durable.sceneRows
      )
      const staleId = crypto.randomUUID()
      await instance.webSocketMessage(
        socket,
        JSON.stringify(
          tokenMoveCommand({ ...moved, version: 0 }, tokenId, staleId, { x: 30, y: 10 })
        )
      )
      expect(
        sent.mock.calls.map(([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        )
      ).toContainEqual(
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId: staleId,
          code: 'STALE_STATE',
          correction: expect.objectContaining({
            scope: 'SCENE',
            state: expect.objectContaining({ version: 1 })
          })
        })
      )
      expect(localEncounterEvidence(context.storage)).toEqual(recovered)
      const nextId = crypto.randomUUID()
      await instance.webSocketMessage(
        socket,
        JSON.stringify(tokenMoveCommand(moved, tokenId, nextId, { x: 30, y: 10 }, 1))
      )
      const next = localEncounterEvidence(context.storage)
      expect(next.sequence).toBe(2)
      expect(next.receipts).toHaveLength(2)
      expect(next.writes).toHaveLength(1)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      sent.mockRestore()
    }
  })
})

it.each(['VERSION', 'SCENE_SOURCE'] as const)(
  'refuses native Scene %s changes with the current correction and no SQLite effect',
  async (failure) => {
    const { base, scene, tokenId } = await localEncounterFixture([], { unboundSceneToken: true })
    const commandId = crypto.randomUUID()
    const command = tokenMoveCommand(scene, tokenId, commandId, { x: 20, y: 10 })
    await runInDurableObject(base.stub, async (instance, context) => {
      const before = localEncounterEvidence(context.storage)
      const beforeRows = new RoomEncounterStore(context.storage).records('SCENE_CHECKPOINT_ROW')
      const socket = context
        .getWebSockets()
        .find(
          (candidate) =>
            (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
        )
      if (!socket) throw new Error('Missing native stale Scene socket.')
      vi.mocked(globalThis.fetch).mockClear()
      const sent = vi.spyOn(socket, 'send')
      try {
        await instance.webSocketMessage(
          socket,
          JSON.stringify({
            ...command,
            command: {
              ...command.command,
              command: {
                ...command.command.command,
                ...(failure === 'VERSION'
                  ? { expectedSceneVersion: 1 }
                  : { sceneId: crypto.randomUUID() })
              }
            }
          })
        )
        expect(
          sent.mock.calls.map(([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
          )
        ).toContainEqual(
          expect.objectContaining({
            code: 'STALE_STATE',
            commandId,
            currentSequence: 0,
            correction: { scope: 'SCENE', state: scene },
            type: 'COMMAND_REJECTED'
          })
        )
        expect(localEncounterEvidence(context.storage)).toEqual(before)
        expect(new RoomEncounterStore(context.storage).records('SCENE_CHECKPOINT_ROW')).toEqual(
          beforeRows
        )
        expect(globalThis.fetch).not.toHaveBeenCalled()
      } finally {
        sent.mockRestore()
      }
    })
  }
)
function bindCommand(encounterId: string, commandId: string) {
  return {
    command: {
      command: { commandId, encounterId, type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE' },
      scope: 'ENCOUNTER_BINDING'
    },
    expectedSessionSequence: 0,
    type: 'COMMAND'
  } as const
}

it('binds an Encounter to the presented Scene in SQLite before acknowledgement, GM only (D47)', async () => {
  const { base, player, state, actors, scene, tokenId } = await localEncounterFixture([], {
    unboundEncounterScene: true
  })
  base.messages.length = 0
  player.messages.length = 0
  const commandId = crypto.randomUUID()
  const command = bindCommand(state.id, commandId)
  const committed = {
    commandId,
    delta: {
      scope: 'ENCOUNTER_BINDING',
      result: { commandId, encounterId: state.id, replayed: false, sceneId: scene.id }
    },
    sequence: 1,
    type: 'COMMAND_COMMITTED'
  }
  const evidence = await runInDurableObject(base.stub, async (instance, context) => {
    const socketFor = (userId: string) =>
      context
        .getWebSockets()
        .find(
          (candidate) => (candidate.deserializeAttachment() as { userId: string }).userId === userId
        )
    const ownerSocket = socketFor(base.userId)
    const playerSocket = socketFor(base.playerId)
    if (!ownerSocket || !playerSocket) throw new Error('Missing native binding sockets.')
    const before = localEncounterEvidence(context.storage)
    expect(new RoomEncounterStore(context.storage).documents('encounterSceneBindings')).toEqual([])
    expect(before.bindings).toMatchObject([{ actorId: actors[0]!.id, tokenId, sceneId: scene.id }])
    const refusedId = crypto.randomUUID()
    const playerSent = vi.spyOn(playerSocket, 'send')
    vi.mocked(globalThis.fetch).mockClear()
    const originalSend = ownerSocket.send.bind(ownerSocket)
    let checkedBeforeAck = false
    const ownerSent = vi.spyOn(ownerSocket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
        expect(message).toEqual(committed)
        const room = new RoomEncounterStore(context.storage)
        const bindings = room.documents('encounterSceneBindings')
        expect(bindings).toHaveLength(1)
        const { _id, _creationTime, ...binding } = bindings[0]!
        expect(encounterSceneBindingSchema.parse(binding)).toEqual({
          encounterId: state.id,
          campaignId: scene.campaignId,
          sceneId: scene.id,
          commandId,
          commandFingerprint: checksumCanonicalJson(command.command.command),
          createdAt: expect.any(String)
        })
        const durable = localEncounterEvidence(context.storage)
        expect(durable.state).toEqual(state)
        expect(durable.actors).toEqual(before.actors)
        expect(durable.bindings).toEqual(before.bindings)
        expect(durable.sequence).toBe(1)
        expect(durable.writes).toHaveLength(1)
        expect(JSON.parse(String(durable.writes[0]!.json))).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ op: 'INSERT', table: 'encounterSceneBindings' })
          ])
        )
        expect(durable.receipts).toHaveLength(1)
        expect(durable.receipts[0]).toMatchObject({
          command_id: commandId,
          sequence: 1,
          state_checksum: durable.checksum
        })
        expect(JSON.parse(String(durable.receipts[0]!.receipt_json))).toEqual(message)
        expect(durable.authority).toEqual({
          sequence: 1,
          state_checksum: durable.checksum,
          published_sequence: 0
        })
        expect(globalThis.fetch).not.toHaveBeenCalled()
        checkedBeforeAck = true
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(
        playerSocket,
        JSON.stringify(bindCommand(state.id, refusedId))
      )
      expect(
        playerSent.mock.calls.map(([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        )
      ).toContainEqual(
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId: refusedId,
          code: 'DOMAIN_REJECTED',
          reason: 'GM_ONLY'
        })
      )
      expect(localEncounterEvidence(context.storage)).toEqual(before)
      await instance.webSocketMessage(ownerSocket, JSON.stringify(command))
      expect(checkedBeforeAck).toBe(true)
      expect(
        playerSent.mock.calls.map(([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        )
      ).toContainEqual(committed)
      const durable = localEncounterEvidence(context.storage)
      // The fixture has no cached token grants; binding rebuilds them from the actual actor.
      ownerSent.mockRestore()
      const previewSent = vi.spyOn(ownerSocket, 'send')
      try {
        await instance.webSocketMessage(
          playerSocket,
          JSON.stringify({
            type: 'TRANSIENT',
            envelope: {
              baselineVersion: scene.version,
              audience: 'TABLE',
              kind: 'TOKEN_DRAG_PREVIEW',
              sceneId: scene.id,
              tokenId,
              sequence: 1,
              position: { x: 15, y: 15 }
            }
          })
        )
        expect(
          previewSent.mock.calls.map(([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
          )
        ).toContainEqual(expect.objectContaining({ type: 'TRANSIENT' }))
        await instance.webSocketMessage(ownerSocket, JSON.stringify(command))
        expect(
          previewSent.mock.calls.map(([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
          )
        ).toContainEqual({
          ...committed,
          delta: { ...committed.delta, result: { ...committed.delta.result, replayed: true } }
        })
        expect(localEncounterEvidence(context.storage)).toEqual(durable)
        expect(
          new RoomEncounterStore(context.storage).documents('encounterSceneBindings')
        ).toHaveLength(1)
        expect(globalThis.fetch).not.toHaveBeenCalled()
      } finally {
        previewSent.mockRestore()
      }
      return durable
    } finally {
      ownerSent.mockRestore()
      playerSent.mockRestore()
    }
  })
  await vi.waitFor(() => {
    expect(base.messages).toContainEqual(committed)
    expect(player.messages).toContainEqual(committed)
  })
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
  await evictDurableObject(base.stub)
  await runInDurableObject(base.stub, (_instance, context) => {
    expect(localEncounterEvidence(context.storage)).toEqual(evidence)
    expect(
      new RoomEncounterStore(context.storage).documents('encounterSceneBindings')
    ).toHaveLength(1)
  })
})

it('rolls back native Encounter binding and controls when late SQLite receipt insertion fails', async () => {
  const { base, state, scene, tokenId } = await localEncounterFixture([], {
    unboundEncounterScene: true
  })
  const commandId = crypto.randomUUID()
  const command = bindCommand(state.id, commandId)
  await runInDurableObject(base.stub, async (instance, context) => {
    const socketFor = (userId: string) =>
      context
        .getWebSockets()
        .find(
          (candidate) => (candidate.deserializeAttachment() as { userId: string }).userId === userId
        )
    const ownerSocket = socketFor(base.userId)
    const playerSocket = socketFor(base.playerId)
    if (!ownerSocket || !playerSocket) throw new Error('Missing native binding rollback sockets.')
    const evidence = () => {
      const room = new RoomEncounterStore(context.storage)
      return {
        ...localEncounterEvidence(context.storage),
        sceneBindings: room.documents('encounterSceneBindings'),
        sceneRows: room.records('SCENE_CHECKPOINT_ROW'),
        sceneSources: room.records('SCENE_CHECKPOINT_SOURCE'),
        inputs: room.records('ROOM_INPUT'),
        authorityState: context.storage.sql
          .exec('SELECT state_json FROM durable_session_authority WHERE id = 1')
          .one(),
        outbox: context.storage.sql.exec('SELECT sequence FROM durable_command_outbox').toArray()
      }
    }
    const before = evidence()
    context.storage.sql.exec(
      "CREATE TRIGGER abort_binding_receipt AFTER INSERT ON durable_command_receipts WHEN EXISTS (SELECT 1 FROM room_writeset_log WHERE sequence = NEW.sequence AND json LIKE '%encounterSceneBindings%') BEGIN SELECT RAISE(ABORT, 'Injected binding SQLite failure'); END"
    )
    let triggerInstalled = true
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(ownerSocket, 'send')
    try {
      await instance.webSocketMessage(ownerSocket, JSON.stringify(command))
      const messages = sent.mock.calls.map(([data]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      )
      expect(messages).toContainEqual(
        expect.objectContaining({ type: 'COMMAND_REJECTED', commandId })
      )
      expect(messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
      expect(evidence()).toEqual(before)
      // Rolled-back binding must not grant the player control of the unbound Scene token.
      sent.mockClear()
      await instance.webSocketMessage(
        playerSocket,
        JSON.stringify({
          type: 'TRANSIENT',
          envelope: {
            baselineVersion: scene.version,
            audience: 'TABLE',
            kind: 'TOKEN_DRAG_PREVIEW',
            sceneId: scene.id,
            tokenId,
            sequence: 1,
            position: { x: 15, y: 15 }
          }
        })
      )
      expect(
        sent.mock.calls
          .map(([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
          )
          .some((message) => message.type === 'TRANSIENT')
      ).toBe(false)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      context.storage.sql.exec('DROP TRIGGER abort_binding_receipt')
      triggerInstalled = false
      await instance.webSocketMessage(ownerSocket, JSON.stringify(command))
      const retry = evidence()
      expect(retry.sceneBindings).toMatchObject([
        { encounterId: state.id, sceneId: scene.id, commandId }
      ])
      expect(retry.sequence).toBe(1)
      expect(retry.writes).toHaveLength(1)
      expect(retry.receipts).toHaveLength(1)
      expect(retry.state).toEqual(before.state)
      expect(retry.actors).toEqual(before.actors)
      expect(retry.bindings).toEqual(before.bindings)
      expect(retry.sceneRows).toEqual(before.sceneRows)
      expect(retry.sceneSources).toEqual(before.sceneSources)
      expect(retry.outbox).toEqual([])
      expect(
        sent.mock.calls.map(([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        )
      ).toContainEqual(
        expect.objectContaining({ type: 'COMMAND_COMMITTED', commandId, sequence: 1 })
      )
      sent.mockClear()
      await instance.webSocketMessage(
        playerSocket,
        JSON.stringify({
          type: 'TRANSIENT',
          envelope: {
            baselineVersion: scene.version,
            audience: 'TABLE',
            kind: 'TOKEN_DRAG_PREVIEW',
            sceneId: scene.id,
            tokenId,
            sequence: 2,
            position: { x: 15, y: 15 }
          }
        })
      )
      expect(
        sent.mock.calls.map(([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        )
      ).toContainEqual(expect.objectContaining({ type: 'TRANSIENT' }))
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      if (triggerInstalled) context.storage.sql.exec('DROP TRIGGER abort_binding_receipt')
      sent.mockRestore()
    }
  })
})

it('refuses a player bound-token move from current native actor control with a private Scene correction', async () => {
  const { base, player, state, actors, scene, tokenId } = await localEncounterFixture()
  const revokeId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: state.id,
          commandId: revokeId,
          expectedVersion: state.version,
          actorId: actors[0]!.id,
          controllerUserIds: []
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ type: 'COMMAND_COMMITTED', commandId: revokeId, sequence: 1 })
    )
  )
  player.messages.length = 0
  const commandId = crypto.randomUUID()
  const move = tokenMoveCommand(scene, tokenId, commandId, { x: 20, y: 10 }, 1)
  await runInDurableObject(base.stub, async (instance, context) => {
    const before = localEncounterEvidence(context.storage)
    expect(before.state.version).toBe(2)
    const actor = before.actors.find(({ id }) => id === actors[0]!.id)
    if (!actor) throw new Error('Missing revoked native actor.')
    expect(
      encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson)).controllerUserIds
    ).toEqual([])
    const room = new RoomEncounterStore(context.storage)
    const beforeRows = room.records('SCENE_CHECKPOINT_ROW')
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.playerId
      )
    if (!socket) throw new Error('Missing native bound-token player socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    try {
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          ...move,
          command: {
            ...move.command,
            command: { ...move.command.command, expectedEncounterVersion: before.state.version }
          }
        })
      )
      expect(
        sent.mock.calls.map(([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        )
      ).toContainEqual(
        expect.objectContaining({
          code: 'DOMAIN_REJECTED',
          commandId,
          currentSequence: 1,
          correction: {
            scope: 'SCENE',
            state: projectSceneForViewer(scene, { role: 'PLAYER', userId: base.playerId })
          },
          reason: 'NOT_ACTOR_CONTROLLER',
          type: 'COMMAND_REJECTED'
        })
      )
      expect(localEncounterEvidence(context.storage)).toEqual(before)
      expect(new RoomEncounterStore(context.storage).records('SCENE_CHECKPOINT_ROW')).toEqual(
        beforeRows
      )
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      sent.mockRestore()
    }
  })
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        type: 'COMMAND_REJECTED',
        commandId,
        reason: 'NOT_ACTOR_CONTROLLER'
      })
    )
  )
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
})
it('refuses a movement decision off the presented Scene without a write (D42)', async () => {
  // The presented Scene is bound to no Encounter, so the Run's movement decision is off it.
  const { base, state, pendingOccurrence } = await localEncounterFixture([], {
    pendingMovementDecision: true,
    unboundEncounterScene: true
  })
  if (!pendingOccurrence) throw new Error('Missing pending movement decision.')
  const commandId = crypto.randomUUID()
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = memberSocket(context, base.userId)
    const writes = () =>
      context.storage.sql.exec('SELECT COUNT(*) AS count FROM room_writeset_log').one().count
    const before = writes()
    const sent = vi.spyOn(socket, 'send')
    try {
      await instance.webSocketMessage(
        socket,
        encounterFrame({
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: state.id,
          commandId,
          expectedVersion: state.version,
          occurrenceId: pendingOccurrence.id,
          expectedOccurrenceVersion: pendingOccurrence.version,
          correlationId: null,
          resolution: { kind: 'ENTER_INTEGER', requestId: 'd20', value: 12 }
        })
      )
      expect(sentMessages(sent)).toEqual([
        expect.objectContaining({
          code: 'DOMAIN_REJECTED',
          commandId,
          reason: 'SCENE_NOT_PRESENTED',
          message: 'Present this Scene to move Encounter tokens.',
          type: 'COMMAND_REJECTED'
        })
      ])
      expect(writes()).toBe(before)
    } finally {
      sent.mockRestore()
    }
  })
})

it('returns a projected correction for a stale Scene version', async () => {
  const value = doorScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  base.messages.length = 0

  const staleSceneId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify(
      doorCommand(value.scene, value.doorId, staleSceneId, { expectedSceneVersion: 1 })
    )
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'STALE_STATE',
        commandId: staleSceneId,
        correction: expect.objectContaining({
          scope: 'SCENE',
          state: expect.objectContaining({ version: 0 })
        }),
        type: 'COMMAND_REJECTED'
      })
    )
  )
})

it('verifies Scene content independently of the authority write-set chain', () => {
  const scene = doorScene(crypto.randomUUID()).scene
  const state = createNativeLiveSessionState(scene)
  expect(hydrateNativeLiveSessionState(state.stateJson)).toEqual({ scene })
  expect(() =>
    hydrateNativeLiveSessionState(
      JSON.stringify({
        state: { scene },
        contentChecksum: checksumCanonicalJson(scene)
      })
    )
  ).toThrow('Live Session state checksum mismatch.')
  expect(hydrateNativeLiveSessionState(createNativeLiveSessionState().stateJson)).toEqual({
    scene: null
  })
})

it('projects a private Scene without legacy Character or Encounter fields', () => {
  const value = movementScene(crypto.randomUUID())
  value.scene.tokens[0]!.hidden = true
  const state = createNativeLiveSessionState(value.scene).state
  const owner = projectNativeLiveSessionState(state, { role: 'OWNER', userId: crypto.randomUUID() })
  const player = projectNativeLiveSessionState(state, {
    role: 'PLAYER',
    userId: crypto.randomUUID()
  })
  expect(owner.scene?.tokens.map((token) => token.id)).toContain(value.tokenId)
  expect(player.scene?.tokens.map((token) => token.id)).not.toContain(value.tokenId)
  expect(Object.keys(player).sort()).toEqual(['recipientRole', 'scene'])
})
it('requires native authentication, consumes the ticket once, and never persists the JWT', async () => {
  const base = await fixture()
  expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(false)
  expect((await base.stub.fetch(base.request())).status).toBe(409)
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual({
      type: 'TRANSIENT_READY',
      campaignId: base.capture.campaignId
    })
  )
  expect(base.captureModes).toEqual(['AUTHORITY'])
  const evidence = await runInDurableObject(base.stub, (_instance, state) => ({
    attachments: state
      .getWebSockets()
      .map((socket) => JSON.stringify(socket.deserializeAttachment())),
    commandTables: state.storage.sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('room_meta', 'command_inbox')"
      )
      .toArray()
  }))
  expect(evidence.attachments.join('')).not.toContain(base.accessToken)
  expect(evidence.commandTables).toEqual([])
})

it('evicts only the exact departed membership epoch through private room control', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const input = {
    campaignId: base.capture.campaignId,
    operation: {
      membershipEpoch: base.capture.origin.membershipEpoch,
      type: 'EVICT_USER' as const,
      userId: base.userId
    }
  }
  expect((await control(input, `${secret}-wrong`)).status).toBe(401)
  const laterEpoch = new Date(Date.parse(base.capture.origin.membershipEpoch) + 1).toISOString()
  expect(
    await (
      await control({ ...input, operation: { ...input.operation, membershipEpoch: laterEpoch } })
    ).json()
  ).toEqual({ closed: 0 })

  const closed = waitForClose(base.socket)
  expect(await (await control(input)).json()).toEqual({ closed: 1 })
  await expect(closed).resolves.toMatchObject({ code: 1008, reason: 'Campaign access ended.' })
})

function invalidateInputs(base: Awaited<ReturnType<typeof fixture>>) {
  return control({
    campaignId: base.capture.campaignId,
    operation: { type: 'INVALIDATE_INPUTS', scopes: ['CAMPAIGN'] }
  })
}

function sendPing(socket: WebSocket, scene: CampaignSceneStateDto, sequence: number) {
  socket.send(
    JSON.stringify({
      type: 'TRANSIENT',
      envelope: {
        baselineVersion: scene.version,
        audience: 'TABLE',
        kind: 'PING',
        position: { x: 50, y: 50 },
        sceneId: scene.id,
        sequence
      }
    })
  )
}

function transients(messages: readonly LiveSessionWebSocketServerMessageDto[]) {
  return messages.filter((message) => message.type === 'TRANSIENT')
}

it('closes a removed member at the next command boundary, refusing broadcasts and their queued command', async () => {
  const { doorId, scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const player = await connectPlayer(base)
  let releaseRead: () => void = () => undefined
  const readHeld = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  await routeEncounterRequests(base, async (pathname) => {
    if (pathname === ROOM_AUTHORIZATION_PATH) await readHeld
    return undefined
  })

  // The departure commits in Convex, which notifies the room.
  base.authorization.members = base.authorization.members.filter(
    (member) => member.userId !== base.playerId
  )
  const closed = waitForClose(player.socket)
  expect(await (await invalidateInputs(base)).json()).toEqual({ invalidated: true })
  player.messages.length = 0
  // While the reload runs, no broadcast leaves the room and the player's command waits behind it.
  sendPing(base.socket, scene, 1)
  player.socket.send(JSON.stringify(doorCommand(scene, doorId, crypto.randomUUID())))
  await new Promise((resolve) => setTimeout(resolve, 75))
  expect(transients(player.messages)).toEqual([])
  releaseRead()

  await expect(closed).resolves.toMatchObject({ code: 1008, reason: 'Campaign access ended.' })
  expect(
    player.messages.filter(
      (message) => message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED'
    )
  ).toEqual([])
  const sequence = await runInDurableObject(
    base.stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ sequence: number }>('SELECT sequence FROM durable_session_authority WHERE id = 1')
        .one().sequence
  )
  expect(sequence).toBe(0)
})

it('closes a removed member within the lease when the notification is lost', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const player = await connectPlayer(base)
  const readsAfterAdmission = base.authorization.reads
  base.authorization.members = base.authorization.members.filter(
    (member) => member.userId !== base.playerId
  )
  const closed = waitForClose(player.socket)

  // Inside the lease the room cannot know yet: that one lease is the accepted exposure.
  player.messages.length = 0
  sendPing(base.socket, scene, 1)
  await vi.waitFor(() => expect(transients(player.messages)).toHaveLength(1))
  expect(base.authorization.reads).toBe(readsAfterAdmission)

  // Past the lease the next broadcast is refused until one read renews it, which ends the member.
  const realNow = Date.now
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + ROOM_LIMITS.authorizationLeaseMs)
  sendPing(base.socket, scene, 2)
  await expect(closed).resolves.toMatchObject({ code: 1008, reason: 'Campaign access ended.' })
  expect(transients(player.messages)).toHaveLength(1)
  expect(base.authorization.reads).toBe(readsAfterAdmission + 1)
})

it('follows an ownership transfer: both admissions end and the new owner rejoins with the GM view', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const player = await connectPlayer(base)
  const transferredAt = new Date(Date.parse(base.capture.origin.membershipEpoch) + 1).toISOString()
  base.authorization.members = [
    { membershipEpoch: transferredAt, role: 'PLAYER', userId: base.userId },
    { membershipEpoch: transferredAt, role: 'OWNER', userId: base.playerId }
  ]
  base.capture.origin = { ...base.capture.origin, membershipEpoch: transferredAt }
  const ownerClosed = waitForClose(base.socket)
  const playerClosed = waitForClose(player.socket)

  await invalidateInputs(base)
  await expect(ownerClosed).resolves.toMatchObject({ reason: 'Campaign access ended.' })
  await expect(playerClosed).resolves.toMatchObject({ reason: 'Campaign access ended.' })

  const response = await base.stub.fetch(
    base.request(
      await signTicket({
        authorityEpoch: base.authorityEpoch,
        campaignId: base.capture.campaignId,
        issuedAt: base.issuedAt,
        role: 'OWNER',
        subject: base.playerId
      })
    )
  )
  const socket = response.webSocket
  if (!socket) throw new Error('Missing new owner WebSocket.')
  sockets.push(socket)
  const messages: LiveSessionWebSocketServerMessageDto[] = []
  socket.addEventListener('message', (event) => {
    messages.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data))))
  })
  socket.accept()
  socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.playerAccessToken }))
  await vi.waitFor(() =>
    expect(messages).toContainEqual(
      expect.objectContaining({
        state: expect.objectContaining({ recipientRole: 'OWNER' }),
        type: 'STATE_SYNC'
      })
    )
  )
})

it('closes every socket when the live Session ends', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'STATE_SYNC')).toBe(true)
  )
  const closed = waitForClose(base.socket)
  expect(
    await (
      await control({
        campaignId: base.capture.campaignId,
        operation: { type: 'CLOSE_ROOM' }
      })
    ).json()
  ).toEqual({ closed: 1 })
  await expect(closed).resolves.toMatchObject({
    code: 1008,
    reason: 'The Campaign live table closed.'
  })
  expect(base.authorityLifecycleCalls).toEqual([
    '/live-sessions/begin-drain',
    '/live-sessions/release'
  ])
  await expect(
    runInDurableObject(
      base.stub,
      (_instance, state) =>
        state.storage.sql
          .exec<{ status: string }>('SELECT status FROM durable_session_authority WHERE id = 1')
          .toArray()[0]
    )
  ).resolves.toEqual({ status: 'RELEASED' })
})

it('resends the authoritative state on a valid resume frame', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'STATE_SYNC')).toBe(true)
  )
  base.messages.length = 0

  base.socket.send(JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 }))

  await vi.waitFor(() =>
    expect(base.messages).toContainEqual({
      authorityEpoch: base.authorityEpoch,
      sequence: 0,
      state: { recipientRole: 'OWNER', scene: null },
      type: 'STATE_SYNC'
    })
  )
})
it('rebuilds an unused provisional journal after Convex verifies a replacement epoch', async () => {
  const base = await fixture()
  const expiredEpoch = crypto.randomUUID()
  await runInDurableObject(base.stub, (_instance, state) => {
    const initial = createNativeLiveSessionState()
    new DurableCommandJournal(state.storage).activate({
      authorityEpoch: expiredEpoch,
      snapshotChecksum: initial.stateChecksum,
      stateJson: initial.stateJson
    })
  })
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const current = await runInDurableObject(base.stub, (_instance, state) =>
    new DurableCommandJournal(state.storage).readCurrent()
  )
  expect(current).toMatchObject({
    authorityEpoch: base.authorityEpoch,
    sequence: 0,
    publishedSequence: 0,
    status: 'ACTIVE'
  })
})

it('requires fresh authentication after hibernation restores only socket attachments', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  await evictDurableObject(base.stub)
  base.messages.length = 0
  base.socket.send(JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 }))
  await vi.waitFor(() => expect(base.messages).toContainEqual({ type: 'AUTHENTICATION_REQUIRED' }))
  expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(false)
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
})

it('extends drag paths around walls and keeps the sequence of a rejected sample', async () => {
  const value = movementScene(crypto.randomUUID())
  value.scene.barriers = [
    {
      id: crypto.randomUUID(),
      kind: 'WALL',
      blocksLight: false,
      blocksMovement: true,
      a: { x: 15, y: 0 },
      b: { x: 15, y: 12 }
    },
    {
      id: crypto.randomUUID(),
      kind: 'WALL',
      blocksLight: false,
      blocksMovement: true,
      a: { x: 22, y: 13 },
      b: { x: 22, y: 20 }
    }
  ]
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  const baseline = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    const sent = vi.spyOn(socket, 'send')
    await instance.webSocketMessage(
      socket,
      JSON.stringify({
        type: 'TRANSIENT',
        envelope: {
          baselineVersion: 0,
          audience: 'TABLE',
          kind: 'TOKEN_DRAG_PREVIEW',
          sceneId: value.scene.id,
          tokenId: value.tokenId,
          sequence: 7,
          position: { x: 15, y: 15 }
        }
      })
    )
    return sent.mock.calls.map(([frame]) =>
      liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(frame)))
    )
  })
  expect(baseline).toEqual([
    expect.objectContaining({
      type: 'TRANSIENT',
      message: expect.objectContaining({
        tokenDragResolution: {
          accepted: true,
          path: [
            { x: 10, y: 10 },
            { x: 15, y: 15 }
          ]
        }
      })
    })
  ])
  const frames = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    const sent = vi.spyOn(socket, 'send')
    sent.mockClear()
    for (const sample of [
      { sequence: 7, position: { x: 30, y: 30 } },
      { sequence: 8, position: { x: 20, y: 10 } },
      { sequence: 9, position: { x: -1, y: 10 } }
    ])
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          type: 'TRANSIENT',
          envelope: {
            baselineVersion: 0,
            audience: 'TABLE',
            kind: 'TOKEN_DRAG_PREVIEW',
            sceneId: value.scene.id,
            tokenId: value.tokenId,
            ...sample
          }
        })
      )
    const identity: unknown = socket.deserializeAttachment()
    expect(new TextEncoder().encode(JSON.stringify(identity)).byteLength).toBeLessThan(2000)
    return sent.mock.calls.map(([frame]) =>
      liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(frame)))
    )
  })
  const retainedPath = [
    { x: 10, y: 10 },
    { x: 15, y: 15 },
    { x: 20, y: 10 }
  ]
  expect(frames).toEqual([
    expect.objectContaining({
      type: 'TRANSIENT',
      message: expect.objectContaining({
        tokenDragResolution: { accepted: true, path: retainedPath }
      })
    }),
    expect.objectContaining({
      type: 'TRANSIENT',
      message: expect.objectContaining({
        tokenDragResolution: { accepted: false, path: retainedPath }
      })
    })
  ])
  const resumed = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    const sent = vi.spyOn(socket, 'send')
    sent.mockClear()
    for (const sequence of [9, 10])
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          type: 'TRANSIENT',
          envelope: {
            baselineVersion: 0,
            audience: 'TABLE',
            kind: 'TOKEN_DRAG_PREVIEW',
            sceneId: value.scene.id,
            tokenId: value.tokenId,
            sequence,
            position: { x: 25, y: 15 }
          }
        })
      )
    return sent.mock.calls.map(([frame]) =>
      liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(frame)))
    )
  })
  expect(resumed).toEqual([
    expect.objectContaining({
      type: 'TRANSIENT',
      message: expect.objectContaining({
        tokenDragResolution: { accepted: true, path: [...retainedPath, { x: 25, y: 15 }] }
      })
    })
  ])
})

it('admits concurrent authentication independently for each native socket', async () => {
  const base = await fixture()
  const ticket = await new SignJWT({
    authorityEpoch: base.authorityEpoch,
    campaignId: base.capture.campaignId,
    role: 'OWNER',
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setSubject(base.userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(base.issuedAt)
    .setExpirationTime(base.issuedAt + 60)
    .sign(new TextEncoder().encode(secret))
  const response = await base.stub.fetch(base.request(ticket))
  const peer = response.webSocket
  if (!peer) throw new Error('Missing peer native test WebSocket.')
  sockets.push(peer)
  const peerMessages: LiveSessionWebSocketServerMessageDto[] = []
  peer.addEventListener('message', (event) => {
    peerMessages.push(
      liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data)))
    )
  })
  peer.accept()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  peer.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() => {
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
    expect(peerMessages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  })
})

it('rejects an expired access token without admitting the socket', async () => {
  const base = await fixture()
  base.socket.send(
    JSON.stringify({
      type: 'AUTHENTICATE',
      accessToken: await base.issueAccessToken(base.issuedAt - 1)
    })
  )
  await vi.waitFor(() => expect(base.messages).toContainEqual({ type: 'AUTHENTICATION_REQUIRED' }))
  const captureCalls = await runInDurableObject(
    base.stub,
    () => vi.mocked(globalThis.fetch).mock.calls.length
  )
  expect(captureCalls).toBe(0)
  expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(false)
})

it('closes an authenticated socket when a later capture returns membership conflict', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  await runInDurableObject(base.stub, () => {
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('membership changed', { status: 409 })
    )
  })
  const closed = waitForClose(base.socket)
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  expect((await closed).code).toBe(1008)
})

it.each([false, true])(
  'retains admission only until the access token expires (expired: %s)',
  async (expired) => {
    const base = await fixture()
    base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
    await vi.waitFor(() =>
      expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
    )
    const frames = await runInDurableObject(base.stub, async (instance, state) => {
      const socket = state.getWebSockets()[0]
      if (!socket) throw new Error('Missing native server socket.')
      const sent = vi.spyOn(socket, 'send')
      vi.spyOn(Date, 'now').mockReturnValue((base.issuedAt + (expired ? 3_601 : 3_599)) * 1_000)
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          type: 'TRANSIENT',
          envelope: {
            baselineVersion: 0,
            audience: 'TABLE',
            kind: 'PING',
            position: { x: 10, y: 10 },
            sceneId: crypto.randomUUID(),
            sequence: 1
          }
        })
      )
      return sent.mock.calls.map(([frame]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(frame)))
      )
    })
    expect(frames).toEqual(expired ? [{ type: 'AUTHENTICATION_REQUIRED' }] : [])
  }
)

it.each(['RENEWAL_TRAFFIC', 'OLD_TRANSIENT_FAILURE'] as const)(
  'preserves the new admission across %s',
  async (race) => {
    const base = await fixture()
    base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
    await vi.waitFor(() =>
      expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
    )
    const newerToken = await base.issueAccessToken(base.issuedAt + 3_601)
    const frames = await runInDurableObject(base.stub, async (instance, state) => {
      const socket = state.getWebSockets()[0]
      if (!socket) throw new Error('Missing native server socket.')
      const sent = vi.spyOn(socket, 'send')
      let releaseCapture: (() => void) | undefined
      let markStarted: (() => void) | undefined
      const started = new Promise<void>((resolve) => {
        markStarted = resolve
      })
      vi.mocked(globalThis.fetch).mockImplementation(async (input, init) =>
        Response.json(
          new URL(new Request(input, init).url).pathname === ROOM_AUTHORIZATION_PATH
            ? roomAuthorizationResponse({ members: base.authorization.members })
            : base.capture
        )
      )
      vi.mocked(globalThis.fetch).mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            releaseCapture = () =>
              resolve(
                race === 'OLD_TRANSIENT_FAILURE'
                  ? new Response(null, { status: 401 })
                  : Response.json(base.capture)
              )
            markStarted?.()
          })
      )
      const authenticate = JSON.stringify({ type: 'AUTHENTICATE', accessToken: newerToken })
      const preview = JSON.stringify({
        type: 'TRANSIENT',
        envelope: {
          baselineVersion: 1,
          audience: 'TABLE',
          kind: 'TOKEN_DRAG_PREVIEW',
          position: { x: 20, y: 10 },
          sceneId: crypto.randomUUID(),
          sequence: 1,
          tokenId: crypto.randomUUID()
        }
      })
      const delayed = instance.webSocketMessage(
        socket,
        race === 'RENEWAL_TRAFFIC' ? authenticate : preview
      )
      await started
      try {
        if (race === 'RENEWAL_TRAFFIC') {
          await instance.webSocketMessage(socket, preview)
          await instance.webSocketMessage(socket, authenticate)
        } else {
          await instance.webSocketMessage(socket, authenticate)
        }
      } finally {
        releaseCapture?.()
        await delayed
      }
      await instance.webSocketMessage(socket, preview)
      return sent.mock.calls.map(([frame]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(frame)))
      )
    })
    expect(frames).toEqual([
      {
        campaignId: base.capture.campaignId,
        type: 'TRANSIENT_READY'
      },
      {
        authorityEpoch: base.authorityEpoch,
        sequence: 0,
        state: { recipientRole: 'OWNER', scene: null },
        type: 'STATE_SYNC'
      }
    ])
  }
)

it.each([false, true])(
  'does not restore a delayed admission after a newer membership denial (heartbeat: %s)',
  async (heartbeat) => {
    const base = await fixture()
    if (heartbeat) {
      base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
      await vi.waitFor(() =>
        expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
      )
      base.messages.length = 0
    }
    const newerToken = await base.issueAccessToken(base.issuedAt + 3_601)
    expect(newerToken).not.toBe(base.accessToken)
    const evidence = await runInDurableObject(base.stub, async (instance, state) => {
      const socket = state.getWebSockets()[0]
      if (!socket) throw new Error('Missing native server socket.')
      let releaseDelayedCapture: (() => void) | undefined
      let markDelayedCaptureStarted: (() => void) | undefined
      const delayedCaptureStarted = new Promise<void>((resolve) => {
        markDelayedCaptureStarted = resolve
      })
      vi.restoreAllMocks()
      let delayedCapture = true
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        const pathname = new URL(request.url).pathname
        if (
          pathname === '/live-sessions/capture' &&
          request.headers.get('authorization') === `Bearer ${base.accessToken}` &&
          delayedCapture
        ) {
          delayedCapture = false
          return new Promise<Response>((resolve) => {
            releaseDelayedCapture = () => resolve(Response.json(base.capture))
            markDelayedCaptureStarted?.()
          })
        }
        if (pathname === '/live-sessions/bootstrap')
          return Response.json({
            activationFingerprint: 'a'.repeat(64),
            persistedSequence: 0,
            persistedStateChecksum: 'a'.repeat(64)
          })
        if (pathname === '/live-sessions/activate') {
          const body = (await request.json()) as { stateChecksum: string }
          const now = new Date().toISOString()
          return Response.json({
            activationFingerprint: 'a'.repeat(64),
            campaignId: base.capture.campaignId,
            createdAt: now,
            epoch: base.authorityEpoch,
            persistedSequence: 0,
            persistedStateChecksum: body.stateChecksum,
            phase: 'DO_ACTIVE',
            updatedAt: now
          })
        }
        return new Response('membership changed', { status: 409 })
      })
      const delayed = instance.webSocketMessage(
        socket,
        JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken })
      )
      await delayedCaptureStarted
      await instance.webSocketMessage(
        socket,
        JSON.stringify({ type: 'AUTHENTICATE', accessToken: newerToken })
      )
      releaseDelayedCapture?.()
      await delayed
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          type: 'TRANSIENT',
          envelope: {
            baselineVersion: 0,
            audience: 'TABLE',
            kind: 'PING',
            position: { x: 10, y: 10 },
            sceneId: crypto.randomUUID(),
            sequence: 1
          }
        })
      )
      return socket.deserializeAttachment()
    })
    expect(evidence).toMatchObject({
      membershipEpoch: heartbeat ? base.capture.origin.membershipEpoch : null
    })
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(false)
  }
)

async function routeEncounterRequests(
  base: Awaited<ReturnType<typeof fixture>>,
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

async function localEncounterFixture(
  features: FeatureDto[] = [],
  options: {
    unboundSceneToken?: boolean
    unboundEncounterScene?: boolean
    /** The Encounter waits on a spatial movement decision, which holds its Scene's moves and doors. */
    pendingMovementDecision?: boolean
    /** That decision asks its target for a d20 save. */
    pendingD20Evidence?: boolean
  } = {}
) {
  const value = movementScene(crypto.randomUUID())
  // The held Scene also refuses door changes, so it gets a door to change.
  const door = options.pendingMovementDecision ? doorScene(value.scene.campaignId) : null
  if (door) {
    value.scene.barriers = door.scene.barriers
    value.scene.doorStates = door.scene.doorStates
  }
  // Encounter control, not exploration, decides these previews; a fogged Scene hides unexplored tokens.
  value.scene.fogMode = 'OFF'
  const base = await fixture(value.scene)
  const encounterId = crypto.randomUUID()
  const sideId = crypto.randomUUID()
  const now = '2026-09-30T00:00:00.000Z'
  base.capture.systemId = DND5E_SYSTEM_ID
  base.capture.sceneEncounterId = options.unboundEncounterScene ? null : encounterId
  const actors = [0, 1, 2].map((ordinal) => {
    const id = crypto.randomUUID()
    const sourceId = crypto.randomUUID()
    const payload = {
      id: sourceId,
      systemId: DND5E_SYSTEM_ID,
      label: `Native Creature ${ordinal}`,
      armorClass: 17,
      abilityScores: {},
      speeds: [],
      senses: [],
      features,
      damageVulnerabilities: [],
      damageResistances: [],
      damageImmunities: [],
      qualifiedDamageDefenses: [],
      conditionImmunities: []
    }
    return encounterRunActorStateSchema.parse({
      id,
      encounterId,
      sideId,
      kind: 'CREATURE',
      label: payload.label,
      sourceId,
      sourceRevision: 1,
      public: ordinal !== 2,
      controllerUserIds: ordinal === 0 ? [base.playerId] : [],
      disposition: 'HOSTILE',
      initiative: 20 - ordinal,
      manualOrder: ordinal,
      healthDisplay: null,
      systemId: DND5E_SYSTEM_ID,
      stableTieKey: id,
      currentHitPoints: 13,
      maxHitPoints: 19,
      tempHitPoints: 0,
      conditions: [],
      defeated: false,
      resources: features.length
        ? { featureCharges: Object.fromEntries(features.map(({ id }) => [id, 0])) }
        : {},
      gmNotes: `Private notes ${ordinal}`,
      snapshot: {
        kind: 'CREATURE',
        id: sourceId,
        systemId: DND5E_SYSTEM_ID,
        sourceRevision: 1,
        sourceVersionId: crypto.randomUUID(),
        sourceChecksum: checksumCanonicalJson(payload),
        payload
      },
      createdAt: now,
      updatedAt: now
    })
  })
  const optionalCombatSnapshot = {
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: []
  }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId: base.capture.campaignId,
    gameSystemId: DND5E_SYSTEM_ID,
    blueprintId: crypto.randomUUID(),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Native manual Encounter',
    status: 'ACTIVE',
    automationMode: 'MANUAL',
    manualReminderMode: 'OFF',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    currentActorId: null,
    actorIds: actors.map((actor) => actor.id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Creatures', sortOrder: 0 }],
    createdAt: now,
    updatedAt: now
  })
  const native = createMemoryEncounterStore({ idPrefix: 'convex-native-fixture' })
  await native.store.insert(
    'encounterRuns',
    encounterStoredRunSchema.parse({
      id: encounterId,
      campaignId: state.campaignId,
      gameSystemId: state.gameSystemId,
      status: state.status,
      version: state.version,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      createdAt: now,
      updatedAt: now
    })
  )
  for (const actor of actors) await insertRunActor({ db: native.store }, actor)
  const initiative = encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      encounterId,
      round: 1,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      policySnapshotChecksum: null,
      nextTurnOrderOrdinal: actors.length,
      version: 0,
      createdAt: now,
      updatedAt: now
    },
    sides: [],
    // The contract stores participants by ascending actor identity; turn order is the ordinal.
    participants: actors
      .map((actor, turnOrderOrdinal) => ({
        encounterId,
        round: 1,
        actorId: actor.id,
        sideId,
        status: 'READY',
        initiativeScore: actor.initiative,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal,
        version: 0,
        createdAt: now,
        updatedAt: now
      }))
      .sort((left, right) => (left.actorId < right.actorId ? -1 : 1))
  })
  await native.store.insert('encounterInitiativeRounds', initiative.round)
  for (const participant of initiative.participants)
    await native.store.insert('encounterInitiativeParticipants', participant)
  if (!options.unboundSceneToken)
    await native.store.insert('encounterActorTokenBindings', {
      encounterId,
      actorId: actors[0]!.id,
      tokenId: value.tokenId,
      sceneId: value.scene.id
    })
  const bindingCommand = bindCommand(encounterId, crypto.randomUUID()).command.command
  if (!options.unboundEncounterScene)
    await native.store.insert(
      'encounterSceneBindings',
      encounterSceneBindingSchema.parse({
        encounterId,
        campaignId: state.campaignId,
        sceneId: value.scene.id,
        commandId: bindingCommand.commandId,
        commandFingerprint: checksumCanonicalJson(bindingCommand),
        createdAt: now
      })
    )
  const pendingOccurrence = options.pendingMovementDecision
    ? await insertPendingMovementDecision(native.store, {
        campaignId: state.campaignId,
        encounterId,
        encounterVersion: state.version,
        sceneId: value.scene.id,
        sceneVersion: value.scene.version,
        tokenId: value.tokenId,
        userId: base.userId,
        sourceActorId: actors[0]!.id,
        gameSystemId: DND5E_SYSTEM_ID,
        now,
        d20Evidence: options.pendingD20Evidence
      })
    : null
  const runDocuments: Extract<LiveRoomInputsResponse, { kind: 'RUN' }>['documents'] = []
  for (const table of [
    'encounterRuns',
    'encounterRunActors',
    'encounterActorProjectionFacts',
    'encounterSourceProjectionFacts',
    'encounterInitiativeRounds',
    'encounterInitiativeParticipants',
    'encounterActorTokenBindings',
    'encounterSceneBindings',
    'encounterRuleOccurrences',
    'encounterPendingSnapshotParts'
  ] as const) {
    for (const { _id, _creationTime, ...fields } of native.documents(table))
      runDocuments.push({ table, id: _id, creationTime: _creationTime, fields })
  }
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === ROOM_AUTHORIZATION_PATH) {
      base.authorization.reads += 1
      return Response.json(
        roomAuthorizationResponse({
          members: base.authorization.members,
          play: {
            encounter: {
              encounterId,
              sceneId: value.scene.id,
              healthDisplayDefault: state.healthDisplayDefault,
              actors: actors.map(({ id, kind, sourceId, controllerUserIds, healthDisplay }) => ({
                id,
                kind,
                sourceId,
                controllerUserIds,
                healthDisplay
              })),
              tokens:
                options.unboundSceneToken || options.unboundEncounterScene
                  ? []
                  : [{ actorId: actors[0]!.id, tokenId: value.tokenId }]
            }
          }
        })
      )
    }
    if (pathname !== ROOM_INPUTS_PATH) return undefined
    const { scope } = liveRoomInputsInputSchema.parse(await request.json())
    if (scope.kind === 'CHAT_METADATA')
      return Response.json({ kind: 'CHAT_METADATA', documents: [], continueCursor: null })
    if (scope.kind === 'RUN') {
      expect(scope.encounterId).toBe(encounterId)
      return Response.json({
        kind: 'RUN',
        encounterVersion: 1,
        activeEncounterId: null,
        maintenanceCharacterOwners: [],
        documents: runDocuments,
        continueCursor: null
      })
    }
    return undefined
  })
  await synchronizeScene(base, value.scene)
  const player = await connectPlayer(base)
  return {
    base,
    player,
    state,
    actors,
    scene: value.scene,
    tokenId: value.tokenId,
    doorId: door?.doorId ?? null,
    pendingOccurrence
  }
}

function localEncounterEvidence(storage: DurableObjectStorage) {
  const room = new RoomEncounterStore(storage)
  const run = room.documents('encounterRuns')[0]
  if (!run) throw new Error('Missing durable native Run.')
  return {
    runId: run._id,
    state: readRunState(run),
    actors: room.documents('encounterRunActors'),
    facts: room.documents('encounterActorProjectionFacts'),
    sources: room.documents('encounterSourceProjectionFacts'),
    rounds: room.documents('encounterInitiativeRounds'),
    participants: room.documents('encounterInitiativeParticipants'),
    bindings: room.documents('encounterActorTokenBindings'),
    commands: room.documents('encounterRunCommands'),
    sequence: room.sequence,
    checksum: room.checksum,
    writes: storage.sql
      .exec('SELECT sequence, json, checksum, chain FROM room_writeset_log ORDER BY sequence')
      .toArray(),
    receipts: storage.sql
      .exec(
        'SELECT command_id, sequence, state_checksum, receipt_json FROM durable_command_receipts ORDER BY sequence'
      )
      .toArray(),
    authority: storage.sql
      .exec(
        'SELECT sequence, state_checksum, published_sequence FROM durable_session_authority WHERE id = 1'
      )
      .one()
  }
}

it('commits warm native reminders, round, initiative, health display, and actor control before acknowledgement', async () => {
  const { base, player, state, actors } = await localEncounterFixture()
  const reminderId = crypto.randomUUID()
  const checkpoints: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname !== '/live-sessions/checkpoint') return undefined
    const checkpoint = liveSessionCheckpointInputSchema.parse(await request.json())
    checkpoints.push(checkpoint)
    return Response.json(checkpointResponse(checkpoint, base.authorization.members))
  })
  const commands = [
    {
      type: 'UPSERT_REMINDER',
      reminder: {
        id: reminderId,
        label: 'Private round reminder',
        timing: 'ROUND_START',
        notes: 'Private reminder notes',
        public: false
      }
    },
    { type: 'REMOVE_REMINDER', reminderId },
    { type: 'SET_ROUND', round: 2 },
    { type: 'SET_INITIATIVE', actorId: actors[0]!.id, initiative: 30 },
    { type: 'SET_HEALTH_DISPLAY_DEFAULT', level: 'BAR' },
    {
      type: 'UPDATE_ACTOR',
      actorId: actors[1]!.id,
      gmNotes: 'Private updated actor notes',
      controllerUserIds: [base.playerId]
    }
  ]
  for (const [index, fields] of commands.entries()) {
    const command = encounterCommandInputDtoSchema.parse({
      ...fields,
      encounterId: state.id,
      commandId: crypto.randomUUID(),
      expectedVersion: index + 1
    })
    const sequence = index + 1
    const frame = JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: index,
      command: { scope: 'ENCOUNTER', command }
    })
    await runInDurableObject(base.stub, async (instance, context) => {
      const socket = context
        .getWebSockets()
        .find(
          (candidate) =>
            (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
        )
      if (!socket) throw new Error('Missing owner native socket.')
      vi.mocked(globalThis.fetch).mockClear()
      const originalSend = socket.send.bind(socket)
      let checkedBeforeAck = false
      const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
        const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        if (message.type === 'COMMAND_COMMITTED' && message.commandId === command.commandId) {
          const evidence = localEncounterEvidence(context.storage)
          expect(evidence.state.version).toBe(sequence + 1)
          expect(evidence.sequence).toBe(sequence)
          expect(evidence.commands).toHaveLength(sequence)
          expect(
            evidence.commands.find(({ commandId }) => commandId === command.commandId)
          ).toMatchObject({ commandType: command.type, version: sequence + 1 })
          expect(evidence.writes).toHaveLength(sequence < 3 ? sequence : sequence - 3)
          if (command.type === 'SET_ROUND') {
            expect(checkpoints).toHaveLength(1)
            expect(checkpoints[0]).toMatchObject({
              campaignId: base.capture.campaignId,
              epoch: base.authorityEpoch,
              fromSequence: 0,
              sequence,
              checksum: evidence.checksum
            })
            expect(checkpoints[0]?.records.changes).toContainEqual(
              expect.objectContaining({
                table: 'encounterRuns',
                key: [state.id]
              })
            )
            expect(
              checkpoints[0]?.records.history.filter(
                ({ table }) => table === 'encounterRunCommands'
              )
            ).toHaveLength(sequence)
          } else {
            expect(evidence.writes.at(-1)?.chain).toBe(evidence.checksum)
            const writeSet = evidence.writes.at(-1)
            if (typeof writeSet?.json !== 'string') throw new Error('Missing native write set.')
            expect(JSON.parse(writeSet.json)).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  op: 'PATCH',
                  id: evidence.runId,
                  fields: expect.objectContaining({ version: sequence + 1 })
                }),
                expect.objectContaining({ op: 'INSERT', table: 'encounterRunCommands' })
              ])
            )
          }
          expect(evidence.receipts).toHaveLength(sequence)
          expect(evidence.receipts.at(-1)).toMatchObject({
            command_id: command.commandId,
            sequence,
            state_checksum: evidence.checksum
          })
          expect(evidence.authority).toEqual({
            sequence,
            state_checksum: evidence.checksum,
            published_sequence: sequence < 3 ? 0 : 3
          })
          if (command.type === 'UPSERT_REMINDER')
            expect(evidence.state.reminders).toEqual([
              expect.objectContaining({ id: reminderId, notes: 'Private reminder notes' })
            ])
          if (command.type === 'REMOVE_REMINDER') expect(evidence.state.reminders).toEqual([])
          if (command.type === 'SET_ROUND') {
            expect(evidence.state.round).toBe(2)
            expect(evidence.rounds.find(({ round }) => round === 2)).toMatchObject({
              status: 'ACTIVE'
            })
            expect(evidence.participants.filter(({ round }) => round === 2)).toHaveLength(3)
          }
          if (command.type === 'SET_INITIATIVE' || command.type === 'UPDATE_ACTOR') {
            const row = evidence.actors.find(({ id }) => id === command.actorId)
            if (!row) throw new Error('Missing updated native actor.')
            const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
            expect(row.stateChecksum).toBe(checksumCanonicalJson(actor))
            expect(actor).toMatchObject(
              command.type === 'SET_INITIATIVE'
                ? { initiative: 30 }
                : {
                    gmNotes: 'Private updated actor notes',
                    controllerUserIds: [base.playerId]
                  }
            )
          }
          if (command.type === 'SET_HEALTH_DISPLAY_DEFAULT')
            expect(evidence.state.healthDisplayDefault).toBe('BAR')
          checkedBeforeAck = true
        }
        originalSend(data)
      })
      try {
        await instance.webSocketMessage(socket, frame)
      } finally {
        sent.mockRestore()
      }
      expect(checkedBeforeAck).toBe(true)
      if (command.type === 'SET_ROUND') {
        expect(globalThis.fetch).toHaveBeenCalledTimes(1)
        const [input, init] = vi.mocked(globalThis.fetch).mock.calls[0]!
        expect(new URL(new Request(input, init).url).pathname).toBe('/live-sessions/checkpoint')
      } else expect(globalThis.fetch).not.toHaveBeenCalled()
    })
    await vi.waitFor(() =>
      expect(
        player.messages.some(
          (message) =>
            message.type === 'COMMAND_COMMITTED' && message.commandId === command.commandId
        )
      ).toBe(true)
    )
    const recipient = player.messages.find(
      (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === command.commandId
    )
    if (recipient?.type !== 'COMMAND_COMMITTED' || recipient.delta?.scope !== 'ENCOUNTER')
      throw new Error('Missing local deterministic Encounter fan-out.')
    expect(recipient.delta.result.projection).toMatchObject({ version: sequence + 1 })
    expect(recipient.delta.result.projection.actors.map(({ id }) => id)).not.toContain(
      actors[2]!.id
    )
    expect(recipient.delta.result.projection.actors).toHaveLength(2)
    expect(recipient.delta.result.projection).not.toHaveProperty('reminders')
    for (const actor of recipient.delta.result.projection.actors) {
      expect(actor).not.toHaveProperty('gmNotes')
      expect(actor).not.toHaveProperty('statBlock')
      expect(actor).not.toHaveProperty('resources')
      expect(actor).not.toHaveProperty('maxHitPoints')
    }
    expect(JSON.stringify(recipient)).not.toContain('Private reminder notes')
    expect(JSON.stringify(recipient)).not.toContain('Private updated actor notes')
    if (command.type === 'UPDATE_ACTOR')
      expect(
        recipient.delta.result.projection.actors.find(({ id }) => id === actors[1]!.id)
      ).toMatchObject({ controllerUserIds: [base.playerId] })
  }
})

it('checkpoints the complete native Encounter prefix before acknowledging COMPLETE', async () => {
  const { base, state, actors } = await localEncounterFixture()
  const currentId = crypto.randomUUID()
  const completeId = crypto.randomUUID()
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    await instance.webSocketMessage(
      socket,
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'SET_CURRENT_ACTOR',
            encounterId: state.id,
            commandId: currentId,
            expectedVersion: 1,
            actorId: actors[0]!.id
          }
        }
      })
    )
    expect(localEncounterEvidence(context.storage).state).toMatchObject({
      version: 2,
      currentActorId: actors[0]!.id
    })
    const previous = vi.mocked(globalThis.fetch).getMockImplementation()
    let checkpointed = false
    let acknowledged = false
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      if (new URL(request.url).pathname !== '/live-sessions/checkpoint') {
        if (!previous) throw new Error('Missing native fetch fixture.')
        return previous(input, init)
      }
      const checkpoint = liveSessionCheckpointInputSchema.parse(await request.json())
      const evidence = localEncounterEvidence(context.storage)
      expect(checkpoint).toMatchObject({
        campaignId: base.capture.campaignId,
        epoch: base.authorityEpoch,
        fromSequence: 0,
        sequence: 2,
        checksum: evidence.checksum
      })
      expect(evidence.state).toMatchObject({
        status: 'COMPLETED',
        version: 3,
        currentActorId: null
      })
      expect(evidence.commands).toHaveLength(2)
      expect(evidence.writes).toHaveLength(2)
      expect(evidence.receipts).toHaveLength(2)
      expect(evidence.authority).toMatchObject({ sequence: 2, published_sequence: 0 })
      expect(acknowledged).toBe(false)
      checkpointed = true
      return Response.json(checkpointResponse(checkpoint, base.authorization.members))
    })
    const originalSend = socket.send.bind(socket)
    const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === completeId) {
        expect(checkpointed).toBe(true)
        const evidence = localEncounterEvidence(context.storage)
        expect(evidence.authority).toMatchObject({ sequence: 2, published_sequence: 2 })
        expect(evidence.writes).toHaveLength(0)
        acknowledged = true
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          type: 'COMMAND',
          expectedSessionSequence: 1,
          command: {
            scope: 'ENCOUNTER',
            command: {
              type: 'COMPLETE',
              encounterId: state.id,
              commandId: completeId,
              expectedVersion: 2
            }
          }
        })
      )
    } finally {
      sent.mockRestore()
      if (previous) vi.mocked(globalThis.fetch).mockImplementation(previous)
    }
    expect(acknowledged).toBe(true)
  })
})

it('commits a warm native initiative roll privately and replays its exact evidence after eviction', async () => {
  const { base, player, state, actors } = await localEncounterFixture()
  const commandId = crypto.randomUUID()
  const actorId = actors[0]!.id
  const frame = JSON.stringify({
    type: 'COMMAND',
    expectedSessionSequence: 0,
    command: {
      scope: 'ENCOUNTER',
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: state.id,
        commandId,
        expectedVersion: 1,
        actorId
      }
    }
  })
  const committed = await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const originalSend = socket.send.bind(socket)
    let checkedBeforeAck = false
    const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
        if (message.delta?.scope !== 'ENCOUNTER' || !message.delta.result.roll)
          throw new Error('Missing initiating native initiative roll.')
        const roll = message.delta.result.roll
        expect(roll).toMatchObject({
          normalizedExpression: '1d20',
          characterId: null,
          characterLabel: actors[0]!.label,
          source: { kind: 'INITIATIVE', label: 'Initiative' },
          evidence: { mode: 'NORMAL', modifier: 0 }
        })
        const term = roll.evidence.terms[0]
        expect(roll.evidence.terms).toHaveLength(1)
        expect(term).toMatchObject({ count: 1, die: 20 })
        expect(term?.rolls).toHaveLength(1)
        expect(term?.rolls[0]).toBeGreaterThanOrEqual(1)
        expect(term?.rolls[0]).toBeLessThanOrEqual(20)
        expect(roll.evidence.total).toBe(term?.rolls[0])
        const evidence = localEncounterEvidence(context.storage)
        expect(evidence.state.version).toBe(2)
        const actorRow = evidence.actors.find(({ id }) => id === actorId)
        if (!actorRow) throw new Error('Missing native initiative actor.')
        const actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
        expect(actor.initiative).toBe(roll.evidence.total)
        expect(actorRow.stateChecksum).toBe(checksumCanonicalJson(actor))
        expect(evidence.commands).toHaveLength(1)
        const history = evidence.commands[0]
        if (!history || history.commandType === 'CREATE')
          throw new Error('Missing native initiative history.')
        expect(history).toMatchObject({
          commandId,
          commandType: 'ROLL_ACTOR_INITIATIVE',
          version: 2
        })
        const replay = encounterStoredReplayReceiptSchema.parse(
          JSON.parse(history.replayReceiptJson)
        )
        expect(replay).toEqual({ roll, occurrence: null })
        expect(history.replayReceiptChecksum).toBe(checksumCanonicalJson(replay))
        expect(evidence.writes).toHaveLength(1)
        const writeSet = evidence.writes[0]
        if (typeof writeSet?.json !== 'string') throw new Error('Missing initiative write set.')
        expect(JSON.parse(writeSet.json)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ op: 'PATCH', id: evidence.runId }),
            expect.objectContaining({ op: 'PATCH', id: actorRow._id }),
            expect.objectContaining({ op: 'INSERT', table: 'encounterRunCommands' })
          ])
        )
        expect(writeSet.chain).toBe(evidence.checksum)
        expect(evidence.receipts).toHaveLength(1)
        expect(evidence.receipts[0]).toMatchObject({
          command_id: commandId,
          sequence: 1,
          state_checksum: evidence.checksum
        })
        expect(evidence.authority).toEqual({
          sequence: 1,
          state_checksum: evidence.checksum,
          published_sequence: 0
        })
        checkedBeforeAck = true
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(socket, frame)
    } finally {
      sent.mockRestore()
    }
    expect(checkedBeforeAck).toBe(true)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    return localEncounterEvidence(context.storage)
  })
  await vi.waitFor(() => {
    expect(
      base.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
    expect(
      player.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
  })
  const own = base.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  const recipient = player.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  if (
    own?.type !== 'COMMAND_COMMITTED' ||
    own.delta?.scope !== 'ENCOUNTER' ||
    recipient?.type !== 'COMMAND_COMMITTED' ||
    recipient.delta?.scope !== 'ENCOUNTER'
  )
    throw new Error('Missing native initiative fan-out.')
  expect(own.delta.result.roll).not.toBeNull()
  expect(recipient.delta.result.roll).toBeNull()
  expect(recipient.delta.result.projection.actors.map(({ id }) => id)).not.toContain(actors[2]!.id)
  for (const actor of recipient.delta.result.projection.actors) {
    expect(actor).not.toHaveProperty('gmNotes')
    expect(actor).not.toHaveProperty('statBlock')
    expect(actor).not.toHaveProperty('resources')
    expect(actor).not.toHaveProperty('maxHitPoints')
  }
  for (const reconstruct of [false, true]) {
    if (reconstruct) {
      await evictDurableObject(base.stub)
      base.messages.length = 0
      base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
      await vi.waitFor(() =>
        expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
      )
    }
    const replay = await runInDurableObject(base.stub, async (instance, context) => {
      const socket = context
        .getWebSockets()
        .find(
          (candidate) =>
            (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
        )
      if (!socket) throw new Error('Missing owner native socket.')
      vi.mocked(globalThis.fetch).mockClear()
      const sent = vi.spyOn(socket, 'send')
      try {
        await instance.webSocketMessage(socket, frame)
        expect(sent).toHaveBeenCalledTimes(1)
        expect(
          liveSessionWebSocketServerMessageDtoSchema.parse(
            JSON.parse(String(sent.mock.calls[0]?.[0]))
          )
        ).toEqual(own)
        if (!reconstruct) expect(globalThis.fetch).not.toHaveBeenCalled()
        return localEncounterEvidence(context.storage)
      } finally {
        sent.mockRestore()
      }
    })
    // Reauthenticating after eviction flushes the outbox, so the reconstructed room has published.
    expect(replay).toEqual(
      reconstruct
        ? { ...committed, writes: [], authority: { ...committed.authority, published_sequence: 1 } }
        : committed
    )
  }
})

it('commits a private native enemy roll and its charge once before acknowledgement', async () => {
  const feature = featureDtoSchema.parse({
    id: crypto.randomUUID(),
    label: 'Whirlwind (Recharge 4-6)',
    description: 'Native charged enemy roll fixture.',
    section: 'ACTION',
    order: 0,
    charges: {
      id: crypto.randomUUID(),
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    rollDefinitions: [
      {
        id: 'whirlwind-table',
        label: 'Table gust',
        kind: 'DAMAGE',
        expression: { count: 2, die: 6, modifier: 0 },
        rollMode: 'NORMAL',
        chargeCost: 1,
        order: 1
      }
    ]
  })
  const { base, player, state, actors } = await localEncounterFixture([feature])
  const commandId = crypto.randomUUID()
  const actorId = actors[0]!.id
  const frame = JSON.stringify({
    type: 'COMMAND',
    expectedSessionSequence: 0,
    command: {
      scope: 'ENCOUNTER',
      command: {
        type: 'ROLL_ENEMY_ACTION',
        encounterId: state.id,
        commandId,
        expectedVersion: 1,
        actorId,
        featureId: feature.id,
        rollDefinitionId: 'whirlwind-table',
        visibility: 'PRIVATE'
      }
    }
  })
  const committed = await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const originalSend = socket.send.bind(socket)
    let checkedBeforeAck = false
    const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
        if (message.delta?.scope !== 'ENCOUNTER' || !message.delta.result.roll)
          throw new Error('Missing initiating private enemy roll.')
        const roll = message.delta.result.roll
        expect(roll).toMatchObject({
          normalizedExpression: '2d6',
          characterId: null,
          source: { kind: 'DAMAGE', label: 'Whirlwind (Recharge 4-6): Table gust' },
          evidence: { mode: 'NORMAL', modifier: 0 }
        })
        expect(roll.evidence.terms).toHaveLength(1)
        const term = roll.evidence.terms[0]
        expect(term).toMatchObject({ count: 2, die: 6 })
        expect(term?.rolls).toHaveLength(2)
        for (const face of term?.rolls ?? []) {
          expect(face).toBeGreaterThanOrEqual(1)
          expect(face).toBeLessThanOrEqual(6)
        }
        expect(roll.evidence.total).toBe(term?.rolls.reduce((sum, face) => sum + face, 0))
        const evidence = localEncounterEvidence(context.storage)
        const actorRow = evidence.actors.find(({ id }) => id === actorId)
        if (!actorRow) throw new Error('Missing charged native actor.')
        const actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
        expect(actor.resources).toEqual({ featureCharges: { [feature.id]: 1 } })
        expect(actorRow.stateChecksum).toBe(checksumCanonicalJson(actor))
        expect(
          message.delta.result.projection.actors.find(({ id }) => id === actorId)
        ).toMatchObject({
          features: [
            expect.objectContaining({
              id: feature.id,
              resource: { maximum: 1, used: 1, remaining: 0, resetKind: 'MANUAL' }
            })
          ]
        })
        expect(evidence.state.version).toBe(2)
        expect(evidence.commands).toHaveLength(1)
        const history = evidence.commands[0]
        if (!history || history.commandType === 'CREATE')
          throw new Error('Missing private enemy roll history.')
        expect(history).toMatchObject({ commandId, commandType: 'ROLL_ENEMY_ACTION', version: 2 })
        const replay = encounterStoredReplayReceiptSchema.parse(
          JSON.parse(history.replayReceiptJson)
        )
        expect(replay).toEqual({ roll, occurrence: null })
        expect(history.replayReceiptChecksum).toBe(checksumCanonicalJson(replay))
        expect(evidence.writes).toHaveLength(1)
        const writeSet = evidence.writes[0]
        if (typeof writeSet?.json !== 'string') throw new Error('Missing private enemy write set.')
        expect(JSON.parse(writeSet.json)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ op: 'PATCH', id: actorRow._id }),
            expect.objectContaining({ op: 'PATCH', id: evidence.runId }),
            expect.objectContaining({ op: 'INSERT', table: 'encounterRunCommands' })
          ])
        )
        expect(writeSet.chain).toBe(evidence.checksum)
        expect(evidence.receipts).toHaveLength(1)
        expect(evidence.receipts[0]).toMatchObject({
          command_id: commandId,
          sequence: 1,
          state_checksum: evidence.checksum
        })
        expect(evidence.authority).toEqual({
          sequence: 1,
          state_checksum: evidence.checksum,
          published_sequence: 0
        })
        checkedBeforeAck = true
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(socket, frame)
    } finally {
      sent.mockRestore()
    }
    expect(checkedBeforeAck).toBe(true)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    return localEncounterEvidence(context.storage)
  })
  await vi.waitFor(() => {
    expect(
      base.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
    expect(
      player.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
  })
  const own = base.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  const recipient = player.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  if (
    own?.type !== 'COMMAND_COMMITTED' ||
    own.delta?.scope !== 'ENCOUNTER' ||
    recipient?.type !== 'COMMAND_COMMITTED' ||
    recipient.delta?.scope !== 'ENCOUNTER'
  )
    throw new Error('Missing private enemy roll fan-out.')
  expect(own.delta.result.roll).not.toBeNull()
  expect(recipient.delta.result.roll).toBeNull()
  expect(recipient.delta.result.projection.actors.map(({ id }) => id)).not.toContain(actors[2]!.id)
  for (const actor of recipient.delta.result.projection.actors) {
    expect(actor).not.toHaveProperty('gmNotes')
    expect(actor).not.toHaveProperty('statBlock')
    expect(actor).not.toHaveProperty('resources')
    expect(actor).not.toHaveProperty('maxHitPoints')
  }
  const retried = await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    try {
      await instance.webSocketMessage(socket, frame)
      expect(sent).toHaveBeenCalledTimes(1)
      expect(
        liveSessionWebSocketServerMessageDtoSchema.parse(
          JSON.parse(String(sent.mock.calls[0]?.[0]))
        )
      ).toEqual(own)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      return localEncounterEvidence(context.storage)
    } finally {
      sent.mockRestore()
    }
  })
  expect(retried).toEqual(committed)
})

it('commits a warm native REORDER before fan-out, redacts players, and replays without another write', async () => {
  const { base, player, state, actors } = await localEncounterFixture()
  const commandId = crypto.randomUUID()
  const actorIds = [...state.actorIds].reverse()
  const frame = JSON.stringify({
    type: 'COMMAND',
    expectedSessionSequence: 0,
    command: {
      scope: 'ENCOUNTER',
      command: {
        type: 'REORDER',
        encounterId: state.id,
        commandId,
        expectedVersion: 1,
        actorIds
      }
    }
  })
  player.messages.length = 0
  const committed = await runInDurableObject(base.stub, async (instance, context) => {
    vi.mocked(globalThis.fetch).mockClear()
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    const originalSend = socket.send.bind(socket)
    let checkedBeforeAck = false
    const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
        const evidence = localEncounterEvidence(context.storage)
        expect(evidence.state).toMatchObject({ version: 2, actorIds })
        expect(evidence.commands).toHaveLength(1)
        expect(evidence.commands[0]).toMatchObject({
          commandId,
          commandType: 'REORDER',
          version: 2
        })
        expect(evidence.writes).toHaveLength(1)
        const writeSet = evidence.writes[0]
        if (typeof writeSet?.json !== 'string') throw new Error('Missing committed write set.')
        expect(JSON.parse(writeSet.json)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              op: 'PATCH',
              id: evidence.runId,
              fields: expect.objectContaining({ version: 2 })
            }),
            expect.objectContaining({ op: 'PATCH', id: evidence.actors[0]!._id }),
            expect.objectContaining({ op: 'INSERT', table: 'encounterRunCommands' })
          ])
        )
        expect(writeSet.chain).toBe(evidence.checksum)
        expect(evidence.receipts).toHaveLength(1)
        expect(evidence.receipts[0]).toMatchObject({
          command_id: commandId,
          sequence: 1,
          state_checksum: evidence.checksum
        })
        expect(evidence.authority).toEqual({
          sequence: 1,
          state_checksum: evidence.checksum,
          published_sequence: 0
        })
        checkedBeforeAck = true
      }
      originalSend(data)
    })
    try {
      await instance.webSocketMessage(socket, frame)
    } finally {
      sent.mockRestore()
    }
    expect(checkedBeforeAck).toBe(true)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    return localEncounterEvidence(context.storage)
  })
  await vi.waitFor(() =>
    expect(
      player.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
  )
  const own = base.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  const recipient = player.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  if (
    own?.type !== 'COMMAND_COMMITTED' ||
    own.delta?.scope !== 'ENCOUNTER' ||
    recipient?.type !== 'COMMAND_COMMITTED' ||
    recipient.delta?.scope !== 'ENCOUNTER'
  )
    throw new Error('Missing native Encounter fan-out.')
  expect(own.delta.result.projection.actors).toHaveLength(3)
  expect(own.delta.result.projection.actors[0]).toMatchObject({
    gmNotes: expect.any(String),
    statBlock: { armorClass: 17 }
  })
  expect(recipient.delta.result.projection.actors.map(({ id }) => id)).not.toContain(actors[2]!.id)
  expect(recipient.delta.result.projection.actors).toHaveLength(2)
  for (const actor of recipient.delta.result.projection.actors) {
    expect(actor).not.toHaveProperty('gmNotes')
    expect(actor).not.toHaveProperty('statBlock')
    expect(actor).not.toHaveProperty('resources')
    expect(actor).not.toHaveProperty('maxHitPoints')
  }
  const replay = await runInDurableObject(base.stub, async (instance, context) => {
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    await instance.webSocketMessage(socket, frame)
    expect(sent).toHaveBeenCalledTimes(1)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(sent.mock.calls[0]?.[0])))
    ).toEqual(own)
    sent.mockRestore()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    return localEncounterEvidence(context.storage)
  })
  expect(replay).toEqual(committed)
  await evictDurableObject(base.stub)
  expect(
    await runInDurableObject(base.stub, (_instance, context) =>
      localEncounterEvidence(context.storage)
    )
  ).toEqual(committed)
})

it.each([true, false])(
  'commits warm CUSTOM reinforcement before acknowledgement and replays once (public: %s)',
  async (isPublic) => {
    const { base, player, state, actors } = await localEncounterFixture()
    const commandId = crypto.randomUUID()
    const frame = JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'REINFORCE',
          encounterId: state.id,
          commandId,
          expectedVersion: 1,
          sideId: state.sides[0]!.id,
          initiative: 21,
          public: isPublic,
          enemy: { kind: 'CUSTOM', label: 'Reinforcement', maxHitPoints: 8 }
        }
      }
    })
    player.messages.length = 0
    const committed = await runInDurableObject(base.stub, async (instance, context) => {
      const socket = context
        .getWebSockets()
        .find(
          (candidate) =>
            (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
        )
      if (!socket) throw new Error('Missing owner native socket.')
      vi.mocked(globalThis.fetch).mockClear()
      const originalSend = socket.send.bind(socket)
      let checkedBeforeAck = false
      const sent = vi.spyOn(socket, 'send').mockImplementation((data) => {
        const message = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        if (message.type === 'COMMAND_COMMITTED' && message.commandId === commandId) {
          const evidence = localEncounterEvidence(context.storage)
          expect(evidence.state.version).toBe(2)
          expect(evidence.state.actorIds).toHaveLength(4)
          expect(evidence.actors).toHaveLength(4)
          expect(evidence.facts).toHaveLength(4)
          expect(evidence.participants).toHaveLength(4)
          expect(evidence.commands).toHaveLength(1)
          const history = evidence.commands[0]
          if (!history || history.commandType !== 'REINFORCE')
            throw new Error('Missing reinforcement history.')
          const reinforced = encounterRunActorStateSchema.parse(
            JSON.parse(history.reinforcedActorStateJson)
          )
          expect(history).toMatchObject({ commandId, version: 2, actorUserId: base.userId })
          expect(reinforced).toMatchObject({
            id: history.reinforcedActorId,
            kind: 'CUSTOM',
            label: 'Reinforcement',
            public: isPublic,
            currentHitPoints: 8,
            maxHitPoints: 8,
            initiative: 21,
            manualOrder: 0
          })
          expect(history.reinforcedActorStateChecksum).toBe(checksumCanonicalJson(reinforced))
          expect(evidence.state.actorIds).toContain(reinforced.id)
          expect(evidence.actors.find(({ id }) => id === reinforced.id)?.stateChecksum).toBe(
            history.reinforcedActorStateChecksum
          )
          expect(
            evidence.participants.find(({ actorId }) => actorId === reinforced.id)
          ).toMatchObject({
            status: 'READY',
            initiativeScore: 21,
            turnOrderOrdinal: 0
          })
          expect(evidence.writes).toHaveLength(1)
          const writeSet = evidence.writes[0]
          if (typeof writeSet?.json !== 'string')
            throw new Error('Missing reinforcement write set.')
          expect(JSON.parse(writeSet.json)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ op: 'INSERT', table: 'encounterRunActors' }),
              expect.objectContaining({ op: 'INSERT', table: 'encounterActorProjectionFacts' }),
              expect.objectContaining({ op: 'INSERT', table: 'encounterRunCommands' })
            ])
          )
          expect(evidence.receipts).toHaveLength(1)
          expect(evidence.receipts[0]).toMatchObject({
            command_id: commandId,
            sequence: 1,
            state_checksum: evidence.checksum
          })
          expect(evidence.authority).toEqual({
            sequence: 1,
            state_checksum: evidence.checksum,
            published_sequence: 0
          })
          checkedBeforeAck = true
        }
        originalSend(data)
      })
      try {
        await instance.webSocketMessage(socket, frame)
      } finally {
        sent.mockRestore()
      }
      expect(checkedBeforeAck).toBe(true)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      return localEncounterEvidence(context.storage)
    })
    await vi.waitFor(() => {
      expect(
        base.messages.some(
          (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
        )
      ).toBe(true)
      expect(
        player.messages.some(
          (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
        )
      ).toBe(true)
    })
    const own = base.messages.find(
      (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
    )
    const recipient = player.messages.find(
      (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
    )
    if (
      own?.type !== 'COMMAND_COMMITTED' ||
      own.delta?.scope !== 'ENCOUNTER' ||
      recipient?.type !== 'COMMAND_COMMITTED' ||
      recipient.delta?.scope !== 'ENCOUNTER'
    )
      throw new Error('Missing reinforcement fan-out.')
    expect(
      own.delta.result.projection.actors.find(({ label }) => label === 'Reinforcement')
    ).toMatchObject({
      kind: 'CUSTOM',
      currentHitPoints: 8,
      maxHitPoints: 8,
      public: isPublic
    })
    const shown = recipient.delta.result.projection.actors
    expect(shown).toHaveLength(isPublic ? 3 : 2)
    expect(shown.map(({ id }) => id)).not.toContain(actors[2]!.id)
    expect(shown.some(({ label }) => label === 'Reinforcement')).toBe(isPublic)
    for (const actor of shown) {
      expect(actor).not.toHaveProperty('gmNotes')
      expect(actor).not.toHaveProperty('statBlock')
      expect(actor).not.toHaveProperty('resources')
      expect(actor).not.toHaveProperty('maxHitPoints')
    }
    const replay = await runInDurableObject(base.stub, async (instance, context) => {
      const socket = context
        .getWebSockets()
        .find(
          (candidate) =>
            (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
        )
      if (!socket) throw new Error('Missing owner native socket.')
      vi.mocked(globalThis.fetch).mockClear()
      const sent = vi.spyOn(socket, 'send')
      await instance.webSocketMessage(socket, frame)
      expect(sent).toHaveBeenCalledTimes(1)
      expect(
        liveSessionWebSocketServerMessageDtoSchema.parse(
          JSON.parse(String(sent.mock.calls[0]?.[0]))
        )
      ).toEqual(own)
      sent.mockRestore()
      expect(globalThis.fetch).not.toHaveBeenCalled()
      return localEncounterEvidence(context.storage)
    })
    expect(replay).toEqual(committed)
  }
)

it('rolls back a local Encounter command when admission expires during an input read', async () => {
  const { base, state, actors, scene, tokenId } = await localEncounterFixture()
  const authorization = roomAuthorizationResponse({
    members: base.authorization.members,
    play: {
      encounter: {
        encounterId: state.id,
        sceneId: scene.id,
        healthDisplayDefault: state.healthDisplayDefault,
        actors: actors.map(({ id, kind, sourceId, controllerUserIds, healthDisplay }) => ({
          id,
          kind,
          sourceId,
          controllerUserIds,
          healthDisplay
        })),
        tokens: [{ actorId: actors[0]!.id, tokenId }]
      }
    }
  })
  authorization.revisions.system = crypto.randomUUID()
  let authorityReadStarted = false
  let releaseRead = () => {}
  const heldRead = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === ROOM_AUTHORIZATION_PATH) {
      base.authorization.reads += 1
      return Response.json(authorization)
    }
    if (pathname !== ROOM_INPUTS_PATH) return undefined
    const { scope } = liveRoomInputsInputSchema.parse(await request.json())
    if (scope.kind === 'AUTHORITY') {
      authorityReadStarted = true
      await heldRead
    }
    return undefined
  })
  const evidence = (storage: DurableObjectStorage) => {
    const room = new RoomEncounterStore(storage)
    return {
      ...localEncounterEvidence(storage),
      inputs: room.records('ROOM_INPUT'),
      characterHeads: room.documents('characters'),
      characterPlay: room.documents('characterPlayStates')
    }
  }
  const before = await runInDurableObject(base.stub, async (instance, context) => {
    const before = evidence(context.storage)
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    const sent = vi.spyOn(socket, 'send')
    // Past the authorization lease, within admission: the command reloads the changed System.
    const leaseExpired = Date.now() + ROOM_LIMITS.authorizationLeaseMs + 1
    const clock = vi.spyOn(Date, 'now').mockReturnValue(leaseExpired)
    const commandId = crypto.randomUUID()
    const handling = instance.webSocketMessage(
      socket,
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'UPDATE_ACTOR',
            encounterId: state.id,
            commandId,
            expectedVersion: 1,
            actorId: actors[0]!.id,
            controllerUserIds: []
          }
        }
      })
    )
    try {
      await vi.waitFor(() => expect(authorityReadStarted).toBe(true))
      clock.mockReturnValue((base.issuedAt + 3_601) * 1_000)
      releaseRead()
      await handling
      const messages = sent.mock.calls.map(([data]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      )
      expect(messages).toContainEqual(
        expect.objectContaining({ type: 'COMMAND_REJECTED', commandId })
      )
      expect(messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
      expect(evidence(context.storage)).toEqual(before)
      return before
    } finally {
      releaseRead()
      await handling
      clock.mockRestore()
      sent.mockRestore()
    }
  })
  await evictDurableObject(base.stub)
  await runInDurableObject(base.stub, (_instance, context) => {
    expect(evidence(context.storage)).toEqual(before)
  })
})

it.each(['VERSION', 'SQLITE'] as const)(
  'rolls back native REORDER state and receipts on %s refusal',
  async (failure) => {
    const { base, state } = await localEncounterFixture()
    const commandId = crypto.randomUUID()
    await runInDurableObject(base.stub, async (instance, context) => {
      const before = localEncounterEvidence(context.storage)
      const socket = context
        .getWebSockets()
        .find(
          (candidate) =>
            (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
        )
      if (!socket) throw new Error('Missing owner native socket.')
      if (failure === 'SQLITE')
        context.storage.sql.exec(
          `CREATE TRIGGER abort_encounter_receipt AFTER INSERT ON durable_command_receipts BEGIN SELECT RAISE(ABORT, 'Injected Encounter SQLite failure'); END`
        )
      vi.mocked(globalThis.fetch).mockClear()
      const sent = vi.spyOn(socket, 'send')
      const command = {
        type: 'REORDER',
        encounterId: state.id,
        commandId,
        expectedVersion: failure === 'VERSION' ? 0 : 1,
        actorIds: [...state.actorIds].reverse()
      }
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          type: 'COMMAND',
          expectedSessionSequence: 0,
          command: { scope: 'ENCOUNTER', command }
        })
      )
      const messages = sent.mock.calls.map(([data]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      )
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId,
          ...(failure === 'VERSION' ? { code: 'DOMAIN_REJECTED', reason: 'VERSION_STALE' } : {})
        })
      )
      expect(messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
      expect(localEncounterEvidence(context.storage)).toEqual(before)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      if (failure === 'SQLITE') {
        context.storage.sql.exec('DROP TRIGGER abort_encounter_receipt')
        await instance.webSocketMessage(
          socket,
          JSON.stringify({
            type: 'COMMAND',
            expectedSessionSequence: 0,
            command: { scope: 'ENCOUNTER', command }
          })
        )
        const retry = localEncounterEvidence(context.storage)
        expect(retry.state.version).toBe(2)
        expect(retry.commands).toHaveLength(1)
        expect(retry.receipts).toHaveLength(1)
        expect(retry.writes).toHaveLength(1)
      }
      sent.mockRestore()
    })
  }
)

it('refuses a warm native undo without an action and preserves state and receipts', async () => {
  const { base, state } = await localEncounterFixture()
  const commandId = crypto.randomUUID()
  await runInDurableObject(base.stub, async (instance, context) => {
    const before = localEncounterEvidence(context.storage)
    expect(before.commands).toHaveLength(0)
    const socket = context
      .getWebSockets()
      .find(
        (candidate) =>
          (candidate.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!socket) throw new Error('Missing owner native socket.')
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    try {
      await instance.webSocketMessage(
        socket,
        JSON.stringify({
          type: 'COMMAND',
          expectedSessionSequence: 0,
          command: {
            scope: 'ENCOUNTER',
            command: {
              type: 'REVERT_LAST_ACTION',
              encounterId: state.id,
              commandId,
              expectedVersion: 1
            }
          }
        })
      )
      const messages = sent.mock.calls.map(([data]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
      )
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId,
          code: 'DOMAIN_REJECTED',
          reason: 'REVERT_UNAVAILABLE'
        })
      )
      expect(messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
      expect(localEncounterEvidence(context.storage)).toEqual(before)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      sent.mockRestore()
    }
  })
})

it('holds moves, door changes and undo on a Scene waiting on a movement decision without a write (D26)', async () => {
  const { base, scene, tokenId, doorId } = await localEncounterFixture([], {
    pendingMovementDecision: true
  })
  if (!doorId) throw new Error('Missing held Scene door.')
  const before = await runInDurableObject(base.stub, (_instance, context) =>
    localEncounterEvidence(context.storage)
  )
  const [doorCommandId, moveId, undoId] = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID()
  ]
  base.messages.length = 0
  base.socket.send(JSON.stringify(doorCommand(scene, doorId, doorCommandId)))
  base.socket.send(JSON.stringify(tokenMoveCommand(scene, tokenId, moveId, { x: 20, y: 10 })))
  base.socket.send(JSON.stringify(undoMoveCommand(scene.id, undoId, scene.version, 0)))
  for (const commandId of [doorCommandId, moveId, undoId])
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          code: 'UNAVAILABLE',
          commandId,
          message: 'Waiting on a movement decision.',
          type: 'COMMAND_REJECTED'
        })
      )
    )
  expect(base.messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
  await runInDurableObject(base.stub, (_instance, context) => {
    expect(localEncounterEvidence(context.storage)).toEqual(before)
  })
})

it('refuses a GM void of a held movement decision natively without a write (D26, D52)', async () => {
  const { base, state, pendingOccurrence } = await localEncounterFixture([], {
    pendingMovementDecision: true
  })
  if (!pendingOccurrence) throw new Error('Missing held movement decision.')
  const before = await runInDurableObject(base.stub, (_instance, context) =>
    localEncounterEvidence(context.storage)
  )
  const commandId = crypto.randomUUID()
  vi.mocked(globalThis.fetch).mockClear()
  base.messages.length = 0
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'VOID_RULE_OCCURRENCE',
          encounterId: state.id,
          commandId,
          expectedVersion: state.version,
          occurrenceId: pendingOccurrence.id,
          expectedOccurrenceVersion: pendingOccurrence.version
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'DOMAIN_REJECTED',
        commandId,
        message: "Dice during a move can't be voided; answer it to continue.",
        reason: 'DECISION_REQUIRES_ANSWER',
        type: 'COMMAND_REJECTED'
      })
    )
  )
  expect(globalThis.fetch).not.toHaveBeenCalled()
  await runInDurableObject(base.stub, (_instance, context) => {
    expect(localEncounterEvidence(context.storage)).toEqual(before)
    expect(
      new RoomEncounterStore(context.storage)
        .documents('encounterRuleOccurrences')
        .map(({ id, state: occurrenceState }) => [id, occurrenceState])
    ).toEqual([[pendingOccurrence.id, 'PENDING']])
  })
})

it('publishes a local token-control revocation before an evicted room reloads Convex grants', async () => {
  const { base, player, state, actors, scene, tokenId } = await localEncounterFixture()
  const commandId = crypto.randomUUID()
  const preview = (sequence: number) =>
    JSON.stringify({
      type: 'TRANSIENT',
      envelope: {
        baselineVersion: scene.version,
        audience: 'TABLE',
        kind: 'TOKEN_DRAG_PREVIEW',
        sceneId: scene.id,
        tokenId,
        sequence,
        position: { x: 15, y: 15 }
      }
    })
  const committed = await runInDurableObject(base.stub, async (instance, context) => {
    const socketFor = (userId: string) =>
      context
        .getWebSockets()
        .find(
          (candidate) => (candidate.deserializeAttachment() as { userId: string }).userId === userId
        )
    const ownerSocket = socketFor(base.userId)
    const playerSocket = socketFor(base.playerId)
    if (!ownerSocket || !playerSocket) throw new Error('Missing native control sockets.')
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(ownerSocket, 'send')
    try {
      await instance.webSocketMessage(playerSocket, preview(1))
      expect(
        sent.mock.calls.some(
          ([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data))).type ===
            'TRANSIENT'
        )
      ).toBe(true)
      await instance.webSocketMessage(
        ownerSocket,
        JSON.stringify({
          type: 'COMMAND',
          expectedSessionSequence: 0,
          command: {
            scope: 'ENCOUNTER',
            command: {
              type: 'UPDATE_ACTOR',
              encounterId: state.id,
              commandId,
              expectedVersion: 1,
              actorId: actors[0]!.id,
              controllerUserIds: []
            }
          }
        })
      )
      const evidence = localEncounterEvidence(context.storage)
      const actor = evidence.actors.find(({ id }) => id === actors[0]!.id)
      if (!actor) throw new Error('Missing revoked native actor.')
      expect(
        encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson)).controllerUserIds
      ).toEqual([])
      expect(evidence.bindings).toHaveLength(1)
      expect(evidence.authority).toMatchObject({ sequence: 1, published_sequence: 0 })
      expect(
        sent.mock.calls.map(([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
        )
      ).toContainEqual(expect.objectContaining({ type: 'COMMAND_COMMITTED', commandId }))
      sent.mockClear()
      await instance.webSocketMessage(playerSocket, preview(2))
      expect(
        sent.mock.calls.some(
          ([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data))).type ===
            'TRANSIENT'
        )
      ).toBe(false)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      return evidence
    } finally {
      sent.mockRestore()
    }
  })
  const authorizationReads = base.authorization.reads
  // Convex serves the older grant until the room publishes the revocation.
  let revocationPublished = false
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === '/live-sessions/checkpoint') {
      revocationPublished ||=
        liveSessionCheckpointInputSchema.parse(await request.json()).sequence >= 1
      return undefined
    }
    if (pathname !== ROOM_AUTHORIZATION_PATH) return undefined
    base.authorization.reads += 1
    return Response.json(
      roomAuthorizationResponse({
        members: base.authorization.members,
        play: {
          encounter: {
            encounterId: state.id,
            sceneId: scene.id,
            healthDisplayDefault: state.healthDisplayDefault,
            actors: actors.map(({ id, kind, sourceId, controllerUserIds, healthDisplay }) => ({
              id,
              kind,
              sourceId,
              controllerUserIds:
                revocationPublished && id === actors[0]!.id ? [] : controllerUserIds,
              healthDisplay
            })),
            tokens: [{ actorId: actors[0]!.id, tokenId }]
          }
        }
      })
    )
  })
  await evictDurableObject(base.stub)
  base.messages.length = 0
  player.messages.length = 0
  await synchronizeScene(base, scene)
  player.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.playerAccessToken }))
  await vi.waitFor(() =>
    expect(player.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  // Reauthentication published the revocation before the room reloaded Convex's grants.
  expect(revocationPublished).toBe(true)
  expect(base.authorization.reads).toBeGreaterThan(authorizationReads)
  await runInDurableObject(base.stub, async (instance, context) => {
    const socketFor = (userId: string) =>
      context
        .getWebSockets()
        .find(
          (candidate) => (candidate.deserializeAttachment() as { userId: string }).userId === userId
        )
    const ownerSocket = socketFor(base.userId)
    const playerSocket = socketFor(base.playerId)
    if (!ownerSocket || !playerSocket) throw new Error('Missing recovered native control sockets.')
    vi.mocked(globalThis.fetch).mockClear()
    const ownerSent = vi.spyOn(ownerSocket, 'send')
    const playerSent = vi.spyOn(playerSocket, 'send')
    try {
      await instance.webSocketMessage(playerSocket, preview(3))
      expect(
        ownerSent.mock.calls.some(
          ([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data))).type ===
            'TRANSIENT'
        )
      ).toBe(false)
      // An owner preview on the same token proves the warmed Scene can actually fan out samples.
      await instance.webSocketMessage(ownerSocket, preview(4))
      expect(
        playerSent.mock.calls.some(
          ([data]) =>
            liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data))).type ===
            'TRANSIENT'
        )
      ).toBe(true)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      const published = localEncounterEvidence(context.storage)
      expect(published.actors).toEqual(committed.actors)
      expect(published.authority).toEqual({ ...committed.authority, published_sequence: 1 })
    } finally {
      ownerSent.mockRestore()
      playerSent.mockRestore()
    }
  })
})

it('preserves corrupt unpublished rows until recovery succeeds, then hydrates acknowledged inputs under the replacement epoch', async () => {
  const { base, player, state, actors } = await localEncounterFixture()
  const commandId = crypto.randomUUID()
  await runInDurableObject(base.stub, async (instance, context) => {
    const owner = context
      .getWebSockets()
      .find(
        (socket) => (socket.deserializeAttachment() as { userId: string }).userId === base.userId
      )
    if (!owner) throw new Error('Missing owner native recovery socket.')
    await instance.webSocketMessage(
      owner,
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'UPDATE_ACTOR',
            encounterId: state.id,
            commandId,
            expectedVersion: 1,
            actorId: actors[0]!.id,
            controllerUserIds: []
          }
        }
      })
    )
    const committed = localEncounterEvidence(context.storage)
    expect(committed.state.version).toBe(2)
    expect(committed.authority).toMatchObject({ sequence: 1, published_sequence: 0 })
    expect(committed.receipts).toHaveLength(1)
    const revoked = committed.actors.find(({ id }) => id === actors[0]!.id)
    if (!revoked) throw new Error('Missing unpublished native actor before recovery.')
    expect(
      encounterRunActorStateSchema.parse(JSON.parse(revoked.stateJson)).controllerUserIds
    ).toEqual([])
    context.storage.sql.exec("UPDATE room_snapshot_chunks SET content = 'bad' WHERE part = 0")
  })
  const retainedRows = () =>
    runInDurableObject(base.stub, (_instance, context) => ({
      snapshot: context.storage.sql
        .exec(
          'SELECT generation, part, part_count, epoch, sequence, chain, content_checksum, content FROM room_snapshot_chunks ORDER BY generation, part'
        )
        .toArray(),
      writes: context.storage.sql
        .exec('SELECT sequence, json, checksum, chain FROM room_writeset_log ORDER BY sequence')
        .toArray(),
      receipts: context.storage.sql
        .exec(
          'SELECT command_id, sequence, state_checksum, receipt_json FROM durable_command_receipts ORDER BY sequence'
        )
        .toArray(),
      authority: context.storage.sql
        .exec(
          'SELECT authority_epoch, sequence, state_checksum, published_sequence FROM durable_session_authority WHERE id = 1'
        )
        .toArray()
    }))
  const damaged = await retainedRows()
  const replacementEpoch = crypto.randomUUID()
  const now = new Date().toISOString()
  const replacement = liveSessionAuthorityDtoSchema.parse({
    campaignId: base.capture.campaignId,
    epoch: replacementEpoch,
    phase: 'ACTIVATING',
    activationFingerprint: 'a'.repeat(64),
    persistedSequence: 0,
    persistedStateChecksum: 'a'.repeat(64),
    createdAt: now,
    updatedAt: now
  })
  const recoveries: Array<ReturnType<typeof liveSessionStorageRecoveryInputSchema.parse>> = []
  const reloadedInputs: Array<ReturnType<typeof liveRoomInputsInputSchema.parse>> = []
  let recoveryAvailable = false
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === LIVE_SESSION_ROUTE_PATHS.recoverStorage) {
      expect(request.headers.get('authorization')).toBeNull()
      expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
      const scope = liveSessionStorageRecoveryInputSchema.parse(await request.json())
      expect(scope).toEqual({ campaignId: base.capture.campaignId, epoch: base.authorityEpoch })
      recoveries.push(scope)
      // Convex has fenced the old epoch, but the first HTTP response has an unknown outcome.
      return recoveryAvailable
        ? Response.json(replacement)
        : new Response('Recovery response unavailable.', { status: 503 })
    }
    if (pathname === ROOM_INPUTS_PATH)
      reloadedInputs.push(liveRoomInputsInputSchema.parse(await request.json()))
    if (pathname === LIVE_SESSION_ROUTE_PATHS.checkpoint)
      throw new Error('Recovery must not publish the abandoned command suffix.')
    return undefined
  })
  const ownerClosed = waitForClose(base.socket)
  const playerClosed = waitForClose(player.socket)
  await evictDurableObject(base.stub)
  await runInDurableObject(base.stub, (_instance, context) => {
    expect(new RoomEncounterStore(context.storage).corruption).not.toBeNull()
  })
  await expect(runInDurableObject(base.stub, (instance) => instance.alarm())).rejects.toThrow()
  await expect(ownerClosed).resolves.toMatchObject({
    code: 1008,
    reason: 'Live Session storage recovered; reconnect to resynchronize.'
  })
  await expect(playerClosed).resolves.toMatchObject({
    code: 1008,
    reason: 'Live Session storage recovered; reconnect to resynchronize.'
  })
  expect(await retainedRows()).toEqual(damaged)
  expect(recoveries).toHaveLength(1)

  recoveryAvailable = true
  await evictDurableObject(base.stub)
  await runInDurableObject(base.stub, (instance) => instance.alarm())
  expect(recoveries).toEqual([
    { campaignId: base.capture.campaignId, epoch: base.authorityEpoch },
    { campaignId: base.capture.campaignId, epoch: base.authorityEpoch }
  ])
  await runInDurableObject(base.stub, (_instance, context) => {
    const recovered = new RoomEncounterStore(context.storage)
    expect(recovered.corruption).toBeNull()
    expect(recovered.epoch).toBe(replacementEpoch)
    expect(recovered.sequence).toBe(0)
    expect(recovered.documents('encounterRuns')).toEqual([])
    expect(recovered.record('ROOM_INPUT', 'AUTHORITY')).toBeNull()
    expect(new DurableCommandJournal(context.storage).readCurrent()).toBeNull()
  })
  const messages = await authenticateOwner(
    base,
    await signTicket({
      authorityEpoch: replacementEpoch,
      campaignId: base.capture.campaignId,
      issuedAt: Math.floor(Date.now() / 1_000),
      role: 'OWNER',
      subject: base.userId
    })
  )
  expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  expect(reloadedInputs.map(({ scope }) => scope.kind)).toEqual(
    expect.arrayContaining(['AUTHORITY', 'RUN', 'SCENE'])
  )
  for (const input of reloadedInputs)
    expect(input).toMatchObject({ campaignId: base.capture.campaignId, epoch: replacementEpoch })
  await runInDurableObject(base.stub, (_instance, context) => {
    const rehydrated = new RoomEncounterStore(context.storage)
    const evidence = localEncounterEvidence(context.storage)
    expect(rehydrated.epoch).toBe(replacementEpoch)
    expect(rehydrated.record('ROOM_INPUT', 'AUTHORITY')).not.toBeNull()
    expect(evidence.state.version).toBe(1)
    const actor = evidence.actors.find(({ id }) => id === actors[0]!.id)
    if (!actor) throw new Error('Missing acknowledged native actor after recovery.')
    expect(
      encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson)).controllerUserIds
    ).toEqual([base.playerId])
    expect(evidence.sequence).toBe(0)
    expect(evidence.writes).toEqual([])
    expect(evidence.receipts).toEqual([])
    expect(new DurableCommandJournal(context.storage).readCurrent()).toMatchObject({
      authorityEpoch: replacementEpoch,
      sequence: 0,
      publishedSequence: 0,
      status: 'ACTIVE'
    })
  })
})

it('removes a native Encounter actor and its binding, ending the player token control immediately', async () => {
  const { base, player, state, actors, scene, tokenId } = await localEncounterFixture()
  await runInDurableObject(base.stub, async (instance, context) => {
    const socketFor = (userId: string) =>
      context
        .getWebSockets()
        .find(
          (candidate) => (candidate.deserializeAttachment() as { userId: string }).userId === userId
        )
    const ownerSocket = socketFor(base.userId)
    const playerSocket = socketFor(base.playerId)
    if (!ownerSocket || !playerSocket) throw new Error('Missing native Encounter sockets.')
    const sent = vi.spyOn(ownerSocket, 'send')
    const preview = (sequence: number) =>
      JSON.stringify({
        type: 'TRANSIENT',
        envelope: {
          baselineVersion: scene.version,
          audience: 'TABLE',
          kind: 'TOKEN_DRAG_PREVIEW',
          sceneId: scene.id,
          tokenId,
          sequence,
          position: { x: 15, y: 15 }
        }
      })
    vi.mocked(globalThis.fetch).mockClear()
    await instance.webSocketMessage(playerSocket, preview(1))
    expect(
      sent.mock.calls.some(
        ([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data))).type ===
          'TRANSIENT'
      )
    ).toBe(true)
    const commandId = crypto.randomUUID()
    await instance.webSocketMessage(
      ownerSocket,
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'REMOVE_ACTOR',
            encounterId: state.id,
            commandId,
            expectedVersion: 1,
            actorId: actors[0]!.id
          }
        }
      })
    )
    const evidence = localEncounterEvidence(context.storage)
    expect(evidence.state).toMatchObject({ version: 2, actorIds: state.actorIds.slice(1) })
    expect(evidence.actors.map(({ id }) => id)).not.toContain(actors[0]!.id)
    expect(evidence.facts.map(({ id }) => id)).not.toContain(actors[0]!.id)
    expect(evidence.participants.map(({ actorId }) => actorId)).not.toContain(actors[0]!.id)
    expect(evidence.bindings).toEqual([])
    expect(evidence.commands[0]).toMatchObject({ commandId, commandType: 'REMOVE_ACTOR' })
    sent.mockClear()
    await instance.webSocketMessage(playerSocket, preview(2))
    expect(
      sent.mock.calls.some(
        ([data]) =>
          liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data))).type ===
          'TRANSIENT'
      )
    ).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    sent.mockRestore()
  })
  await vi.waitFor(() =>
    expect(player.messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(true)
  )
})

function memberSocket(context: DurableObjectState, userId: string) {
  const socket = context
    .getWebSockets()
    .find(
      (candidate) => (candidate.deserializeAttachment() as { userId: string }).userId === userId
    )
  if (!socket) throw new Error('Missing member native socket.')
  return socket
}

function encounterFrame(command: Record<string, unknown>) {
  return JSON.stringify({
    type: 'COMMAND',
    expectedSessionSequence: 0,
    command: { scope: 'ENCOUNTER', command }
  })
}

function sentMessages(sent: { mock: { calls: unknown[][] } }) {
  return sent.mock.calls.map(([data]) =>
    liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(data)))
  )
}

function tableBucketTokens(storage: DurableObjectStorage, userId: string) {
  return storage.sql
    .exec<{ tokens: number }>(
      "SELECT tokens FROM room_account_buckets WHERE user_id = ? AND kind = 'TABLE'",
      userId
    )
    .toArray()
    .map(({ tokens }) => tokens)
}

it('commits a TABLE enemy roll with its table card and one D72 TABLE charge, in the room (D78)', async () => {
  const feature = featureDtoSchema.parse({
    id: crypto.randomUUID(),
    label: 'Whirlwind (Recharge 4-6)',
    description: 'Native table enemy roll fixture.',
    section: 'ACTION',
    order: 0,
    charges: {
      id: crypto.randomUUID(),
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    rollDefinitions: [
      {
        id: 'gust',
        label: 'Table gust',
        kind: 'DAMAGE',
        expression: { count: 2, die: 6, modifier: 0 },
        rollMode: 'NORMAL',
        chargeCost: 1,
        order: 1
      }
    ]
  })
  const { base, state, actors } = await localEncounterFixture([feature])
  const roll = (commandId: string, expectedVersion: number) => ({
    type: 'ROLL_ENEMY_ACTION',
    encounterId: state.id,
    commandId,
    expectedVersion,
    actorId: actors[0]!.id,
    featureId: feature.id,
    rollDefinitionId: 'gust',
    visibility: 'TABLE'
  })
  const [commandId, limitedId] = [crypto.randomUUID(), crypto.randomUUID()]
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = memberSocket(context, base.userId)
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    try {
      await instance.webSocketMessage(socket, encounterFrame(roll(commandId, 1)))
      await instance.webSocketMessage(socket, encounterFrame(roll(commandId, 1)))
      const [committed, replayed] = sentMessages(sent)
      if (
        committed?.type !== 'COMMAND_COMMITTED' ||
        committed.delta?.scope !== 'ENCOUNTER' ||
        !committed.delta.result.roll
      )
        throw new Error('Missing committed TABLE enemy roll.')
      expect(replayed).toEqual(committed)
      const tableRoll = committed.delta.result.roll
      expect(tableRoll).toMatchObject({ normalizedExpression: '2d6', characterId: null })
      const room = new RoomEncounterStore(context.storage)
      expect(room.documents('campaignConversationEntries')).toEqual([
        expect.objectContaining({ authorUserId: base.userId, clientNonce: commandId })
      ])
      expect(room.documents('campaignConversationEntryPayloads')).toEqual([
        expect.objectContaining({
          kind: 'ROLL',
          roll: expect.objectContaining({ id: tableRoll.id }),
          authorUsername: 'FixtureMember'
        })
      ])
      expect(localEncounterEvidence(context.storage).commands).toEqual([
        expect.objectContaining({ commandId, commandType: 'ROLL_ENEMY_ACTION', version: 2 })
      ])
      // The commit spends one of the GM's TABLE tokens, as a chat roll does; the replay is free.
      expect(tableBucketTokens(context.storage, base.userId)).toEqual([
        ACCOUNT_BUCKETS.TABLE.OWNER.capacity - 1
      ])
      context.storage.sql.exec(
        "UPDATE room_account_buckets SET tokens = 0, updated_at = ? WHERE user_id = ? AND kind = 'TABLE'",
        Date.now() + 60_000,
        base.userId
      )
      sent.mockClear()
      await instance.webSocketMessage(socket, encounterFrame(roll(limitedId, 2)))
      expect(sentMessages(sent)).toEqual([
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId: limitedId,
          code: 'RATE_LIMITED'
        })
      ])
      expect(localEncounterEvidence(context.storage).commands).toHaveLength(1)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      sent.mockRestore()
    }
  })
})

it('commits a GM evidence roll with its table card and one D72 TABLE charge, in the room (D78)', async () => {
  const { base, state, pendingOccurrence } = await localEncounterFixture([], {
    pendingMovementDecision: true,
    pendingD20Evidence: true
  })
  if (!pendingOccurrence) throw new Error('Missing pending movement decision.')
  const commandId = crypto.randomUUID()
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = memberSocket(context, base.userId)
    vi.mocked(globalThis.fetch).mockClear()
    const sent = vi.spyOn(socket, 'send')
    try {
      await instance.webSocketMessage(
        socket,
        encounterFrame({
          type: 'ROLL_RULE_EVIDENCE',
          encounterId: state.id,
          commandId,
          expectedVersion: state.version,
          occurrenceId: pendingOccurrence.id,
          expectedOccurrenceVersion: pendingOccurrence.version,
          requestId: 'd20',
          rollMode: null
        })
      )
      const [committed] = sentMessages(sent)
      if (committed?.type !== 'COMMAND_COMMITTED' || committed.delta?.scope !== 'ENCOUNTER')
        throw new Error('Missing committed evidence roll.')
      const { roll, evidenceRoll } = committed.delta.result
      expect(evidenceRoll).not.toBeNull()
      expect(roll).toMatchObject({ normalizedExpression: '1d20' })
      const room = new RoomEncounterStore(context.storage)
      expect(room.documents('encounterEvidenceRolls')).toEqual([
        expect.objectContaining({ commandId, userId: base.userId, attempt: 1 })
      ])
      expect(room.documents('campaignConversationEntryPayloads')).toEqual([
        expect.objectContaining({ kind: 'ROLL', roll: expect.objectContaining({ id: roll?.id }) })
      ])
      expect(tableBucketTokens(context.storage, base.userId)).toEqual([
        ACCOUNT_BUCKETS.TABLE.OWNER.capacity - 1
      ])
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      sent.mockRestore()
    }
  })
})

it('refuses a decision no room planner owns as Convex did, without a write or a Convex call (D78)', async () => {
  const { base, state, pendingOccurrence } = await localEncounterFixture([], {
    pendingMovementDecision: true
  })
  if (!pendingOccurrence) throw new Error('Missing pending movement decision.')
  const decision = (type: 'RESOLVE_RULE_OCCURRENCE' | 'VOID_RULE_OCCURRENCE') => ({
    type,
    encounterId: state.id,
    commandId: crypto.randomUUID(),
    expectedVersion: state.version,
    occurrenceId: crypto.randomUUID(),
    expectedOccurrenceVersion: pendingOccurrence.version,
    ...(type === 'RESOLVE_RULE_OCCURRENCE'
      ? { resolution: { kind: 'ENTER_INTEGER', requestId: 'd20', value: 12 } }
      : {})
  })
  await runInDurableObject(base.stub, async (instance, context) => {
    const before = localEncounterEvidence(context.storage)
    vi.mocked(globalThis.fetch).mockClear()
    for (const [userId, command] of [
      [base.userId, decision('RESOLVE_RULE_OCCURRENCE')],
      [base.userId, decision('VOID_RULE_OCCURRENCE')],
      [base.playerId, decision('VOID_RULE_OCCURRENCE')]
    ] as const) {
      const socket = memberSocket(context, userId)
      const sent = vi.spyOn(socket, 'send')
      try {
        await instance.webSocketMessage(socket, encounterFrame(command))
        expect(sentMessages(sent)).toEqual([
          expect.objectContaining({
            type: 'COMMAND_REJECTED',
            commandId: command.commandId,
            code: 'DOMAIN_REJECTED',
            reason: 'VERSION_STALE',
            message: 'Rule occurrence is unavailable.'
          })
        ])
      } finally {
        sent.mockRestore()
      }
    }
    expect(localEncounterEvidence(context.storage)).toEqual(before)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

it("lets a player have one Encounter command in flight and tells them a GM-only command is the GM's (D42)", async () => {
  const { base, state, actors } = await localEncounterFixture()
  const [firstId, secondId, thirdId] = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID()
  ]
  const update = (commandId: string) =>
    encounterFrame({
      type: 'UPDATE_ACTOR',
      encounterId: state.id,
      commandId,
      expectedVersion: state.version,
      actorId: actors[0]!.id,
      currentHitPoints: 5
    })
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = memberSocket(context, base.playerId)
    const before = localEncounterEvidence(context.storage)
    const sent = vi.spyOn(socket, 'send')
    try {
      // The gate runs before the first await, so the second command meets the first in flight.
      const first = instance.webSocketMessage(socket, update(firstId))
      await instance.webSocketMessage(socket, update(secondId))
      await first
      // The slot frees once the first command settles.
      await instance.webSocketMessage(socket, update(thirdId))
      const rejected = sentMessages(sent).filter(({ type }) => type === 'COMMAND_REJECTED')
      expect(rejected).toEqual([
        expect.objectContaining({
          commandId: secondId,
          code: 'UNAVAILABLE',
          message: 'Your previous action is still resolving.'
        }),
        ...[firstId, thirdId].map((commandId) =>
          expect.objectContaining({
            commandId,
            code: 'DOMAIN_REJECTED',
            reason: 'GM_ONLY',
            message: DOMAIN_REJECTION_MESSAGES.GM_ONLY
          })
        )
      ])
      expect(localEncounterEvidence(context.storage)).toEqual(before)
    } finally {
      sent.mockRestore()
    }
  })
})
it('sends an expected domain rejection and keeps an unexpected failure generic', async () => {
  const { base, state, actors } = await localEncounterFixture()
  const [staleId, failedId] = [crypto.randomUUID(), crypto.randomUUID()]
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = memberSocket(context, base.userId)
    const before = localEncounterEvidence(context.storage)
    const sent = vi.spyOn(socket, 'send')
    try {
      for (const [commandId, expectedVersion, actorId] of [
        [staleId, state.version + 1, actors[0]!.id],
        [failedId, state.version, crypto.randomUUID()]
      ] as const)
        await instance.webSocketMessage(
          socket,
          encounterFrame({
            type: 'UPDATE_ACTOR',
            encounterId: state.id,
            commandId,
            expectedVersion,
            actorId,
            currentHitPoints: 5
          })
        )
      const messages = sentMessages(sent)
      expect(messages).toEqual([
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId: staleId,
          code: 'DOMAIN_REJECTED',
          reason: 'VERSION_STALE'
        }),
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId: failedId,
          code: 'UNAVAILABLE',
          message: 'The Encounter command could not be completed.',
          reason: null
        })
      ])
      expect(JSON.stringify(messages)).not.toContain('Encounter actor was not found')
      expect(localEncounterEvidence(context.storage)).toEqual(before)
    } finally {
      sent.mockRestore()
    }
  })
})

const ownerTicket = (base: Awaited<ReturnType<typeof fixture>>) =>
  signTicket({
    authorityEpoch: base.authorityEpoch,
    campaignId: base.capture.campaignId,
    issuedAt: base.issuedAt,
    role: 'OWNER',
    subject: base.userId
  })

it('closes a socket whose message exceeds the UTF-8 byte cap', async () => {
  const base = await fixture()
  const closed = waitForClose(base.socket)
  // 30,000 code units of a 3-byte character: under the cap in UTF-16, over it in UTF-8.
  base.socket.send(JSON.stringify({ type: 'RESUME', padding: '€'.repeat(30_000) }))
  await expect(closed).resolves.toMatchObject({
    code: 1008,
    reason: 'Invalid live-session message.'
  })
})

it('closes a socket that exceeds its message budget', async () => {
  const base = await fixture()
  const closed = waitForClose(base.socket)
  for (let index = 0; index < 30; index++)
    base.socket.send(JSON.stringify({ type: 'RESUME', lastAppliedSequence: 0 }))
  await expect(closed).resolves.toMatchObject({
    code: 1008,
    reason: 'Too many live-session messages.'
  })
})

it('refuses a user beyond the per-user socket cap before consuming the ticket', async () => {
  const base = await fixture()
  for (let index = 1; index < 4; index++) {
    const response = await base.stub.fetch(base.request(await ownerTicket(base)))
    expect(response.status).toBe(101)
    response.webSocket?.accept()
    if (response.webSocket) sockets.push(response.webSocket)
  }
  const ticket = await ownerTicket(base)
  expect((await base.stub.fetch(base.request(ticket))).status).toBe(429)
  base.socket.close(1000, 'done')
  await vi.waitFor(async () => {
    const response = await base.stub.fetch(base.request(ticket))
    expect(response.status).toBe(101)
    response.webSocket?.accept()
    if (response.webSocket) sockets.push(response.webSocket)
  })
})

it('closes sockets that do not authenticate within the admission window', async () => {
  const base = await fixture()
  const closed = waitForClose(base.socket)
  await runInDurableObject(base.stub, async (instance) => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_001)
    await instance.alarm()
  })
  await expect(closed).resolves.toMatchObject({
    code: 1008,
    reason: 'Live-session authentication timed out.'
  })
})

it('keeps authenticated sockets open when the admission alarm fires', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const open = await runInDurableObject(base.stub, async (instance, state) => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_001)
    await instance.alarm()
    return state.getWebSockets().filter((socket) => socket.readyState === WebSocket.OPEN).length
  })
  expect(open).toBe(1)
})

async function authenticateOwner(
  base: Awaited<ReturnType<typeof fixture>>,
  ticket: string
): Promise<LiveSessionWebSocketServerMessageDto[]> {
  const response = await base.stub.fetch(base.request(ticket))
  const socket = response.webSocket
  if (!socket) throw new Error('Missing owner native test WebSocket.')
  sockets.push(socket)
  const messages: LiveSessionWebSocketServerMessageDto[] = []
  socket.addEventListener('message', (event) => {
    messages.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data))))
  })
  socket.accept()
  socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  return messages
}

function idleRelease(stub: Awaited<ReturnType<typeof fixture>>['stub']) {
  return runInDurableObject(stub, async (_instance, state) => ({
    alarm: await state.storage.getAlarm(),
    releaseAt:
      state.storage.sql
        .exec<{ release_at: number }>('SELECT release_at FROM room_idle_release WHERE id = 1')
        .toArray()[0]?.release_at ?? null,
    status:
      state.storage.sql
        .exec<{ status: string }>('SELECT status FROM durable_session_authority WHERE id = 1')
        .toArray()[0]?.status ?? null
  }))
}

function fireAlarmAfterIdleWindow(stub: Awaited<ReturnType<typeof fixture>>['stub']) {
  return runInDurableObject(stub, async (instance) => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000 + 1)
    try {
      await instance.alarm()
    } finally {
      clock.mockRestore()
    }
  })
}

async function leaveAndFireIdleAlarm(base: Awaited<ReturnType<typeof fixture>>) {
  const leftAt = Date.now()
  base.socket.close(1000, 'done')
  await vi.waitFor(async () => {
    const pending = await idleRelease(base.stub)
    expect(pending.releaseAt).toBeGreaterThanOrEqual(leftAt + 5 * 60_000)
    const checkpointAt = await runInDurableObject(base.stub, (_instance, state) => {
      const first = new DurableCommandJournal(state.storage).oldestUnpublishedCommandTime()
      return first === null ? null : first + ROOM_LIMITS.checkpointDeadlineMs
    })
    expect(pending.alarm).toBe(
      checkpointAt === null ? pending.releaseAt : Math.min(checkpointAt, pending.releaseAt!)
    )
  })
  await fireAlarmAfterIdleWindow(base.stub)
}

it('drains and releases authority after five minutes without an admitted socket', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  await fireAlarmAfterIdleWindow(base.stub)

  expect(base.authorityLifecycleCalls).toEqual([])

  await leaveAndFireIdleAlarm(base)
  expect(base.authorityLifecycleCalls).toEqual([
    '/live-sessions/begin-drain',
    '/live-sessions/release'
  ])
  await expect(idleRelease(base.stub)).resolves.toEqual({
    alarm: null,
    releaseAt: null,
    status: 'RELEASED'
  })

  // The next join bootstraps a fresh epoch over the released journal.
  const replacementEpoch = crypto.randomUUID()
  await authenticateOwner(
    base,
    await signTicket({
      authorityEpoch: replacementEpoch,
      campaignId: base.capture.campaignId,
      issuedAt: Math.floor(Date.now() / 1_000),
      role: 'OWNER',
      subject: base.userId
    })
  )
  await expect(
    runInDurableObject(base.stub, (_instance, state) =>
      new DurableCommandJournal(state.storage).readCurrent()
    )
  ).resolves.toMatchObject({ authorityEpoch: replacementEpoch, sequence: 0, status: 'ACTIVE' })
})

it('cancels the idle release when a member reconnects inside the window', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  base.socket.close(1000, 'done')
  await vi.waitFor(async () => expect((await idleRelease(base.stub)).releaseAt).not.toBeNull())
  await authenticateOwner(base, await ownerTicket(base))
  await expect(idleRelease(base.stub)).resolves.toMatchObject({
    releaseAt: null,
    status: 'ACTIVE'
  })
  await fireAlarmAfterIdleWindow(base.stub)

  expect(base.authorityLifecycleCalls).toEqual([])
  await expect(idleRelease(base.stub)).resolves.toMatchObject({ status: 'ACTIVE' })
})

it('retries the exact pending checkpoint after eviction before an idle room releases its authority', async () => {
  const value = doorScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  const calls: string[] = []
  const checkpoints: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
  let publishAvailable = false
  await runInDurableObject(base.stub, () => {
    const original = vi.mocked(globalThis.fetch).getMockImplementation()
    if (!original) throw new Error('Missing native fetch mock.')
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      calls.push(pathname)
      if (pathname !== '/live-sessions/checkpoint') return original(input, init)
      const body = liveSessionCheckpointInputSchema.parse(await request.json())
      checkpoints.push(body)
      if (!publishAvailable) return new Response('Unavailable.', { status: 503 })
      return Response.json(checkpointResponse(body, base.authorization.members))
    })
  })
  const commandId = crypto.randomUUID()
  base.socket.send(JSON.stringify(doorCommand(value.scene, value.doorId, commandId)))
  await vi.waitFor(() =>
    expect(
      base.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
  )
  expect(calls).toEqual([])
  await expect(fireCheckpointAlarm(base.stub)).rejects.toThrow()
  expect(checkpoints).toHaveLength(1)
  expect(await journalEvidence(base)).toMatchObject({
    authority: { published_sequence: 0, sequence: 1 },
    pendingWriteCount: 1
  })
  await evictDurableObject(base.stub)
  publishAvailable = true
  calls.length = 0

  await leaveAndFireIdleAlarm(base)
  expect(calls).toEqual([
    '/live-sessions/checkpoint',
    '/live-sessions/begin-drain',
    '/live-sessions/release'
  ])
  expect(checkpoints).toHaveLength(2)
  expect(checkpoints[1]).toEqual(checkpoints[0])
  const journal = await runInDurableObject(base.stub, (_instance, state) => ({
    authority: state.storage.sql
      .exec<{ published_sequence: number; sequence: number; status: string }>(
        'SELECT published_sequence, sequence, status FROM durable_session_authority WHERE id = 1'
      )
      .one(),
    pendingWriteCount: state.storage.sql
      .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
      .one().count
  }))
  expect(journal).toEqual({
    authority: { published_sequence: 1, sequence: 1, status: 'RELEASED' },
    pendingWriteCount: 0
  })
})

it('never captures authority for pings on the synchronized Scene', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const captures = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    const header = base.capture.sceneHeader!
    const pingMessage = (sequence: number) =>
      JSON.stringify({
        type: 'TRANSIENT',
        envelope: {
          audience: 'TABLE',
          kind: 'PING',
          sceneId: header.id,
          baselineVersion: header.version,
          sequence,
          position: { x: sequence, y: 10 }
        }
      })
    const captureCalls = () =>
      vi
        .mocked(globalThis.fetch)
        .mock.calls.filter(([input]) => new Request(input).url.endsWith('/live-sessions/capture'))
        .length
    const before = captureCalls()
    for (let sequence = 1; sequence <= 5; sequence++)
      await instance.webSocketMessage(socket, pingMessage(sequence))
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
    await instance.webSocketMessage(socket, pingMessage(6))
    return captureCalls() - before
  })
  expect(captures).toBe(0)
})

it('rejects commands beyond the pending-command bound without closing the socket', async () => {
  const { base, state, actors } = await localEncounterFixture()
  const commandIds = Array.from({ length: 9 }, () => crypto.randomUUID())
  await runInDurableObject(base.stub, async (instance, context) => {
    const socket = memberSocket(context, base.userId)
    const sent = vi.spyOn(socket, 'send')
    try {
      // Each call passes the synchronous gate before any queued command runs.
      await Promise.all(
        commandIds.map((commandId) =>
          instance.webSocketMessage(
            socket,
            encounterFrame({
              type: 'UPDATE_ACTOR',
              encounterId: state.id,
              commandId,
              expectedVersion: state.version + 1,
              actorId: actors[0]!.id,
              currentHitPoints: 5
            })
          )
        )
      )
      const rejected = sentMessages(sent).filter(({ type }) => type === 'COMMAND_REJECTED')
      expect(rejected[0]).toMatchObject({
        commandId: commandIds[8],
        code: 'UNAVAILABLE',
        message: 'Too many pending table changes.'
      })
      expect(rejected).toHaveLength(9)
    } finally {
      sent.mockRestore()
    }
  })
  expect(base.socket.readyState).toBe(WebSocket.OPEN)
})

function exploredDoorScene(explored: boolean) {
  const { doorId, scene } = doorScene(crypto.randomUUID())
  return {
    doorId,
    scene: {
      ...scene,
      fogLayers: [createUniformSceneFogLayer(scene, { explored, ownerUserId: null })]
    }
  }
}

function planDoorChange(input: {
  scene: CampaignSceneStateDto
  doorId: string
  role: 'OWNER' | 'PLAYER'
  state: 'OPEN' | 'CLOSED' | 'LOCKED'
}) {
  return planLiveSceneCommand({
    command: {
      barrierId: input.doorId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: input.scene.version,
      sceneId: input.scene.id,
      state: input.state,
      type: 'SET_SCENE_DOOR_STATE'
    },
    scene: input.scene,
    encounterId: null,
    actor: { role: input.role, userId: crypto.randomUUID() }
  })
}

it.each([
  // Fog is on with a stored layer, so an allowed door change stages exploration through Convex.
  { role: 'PLAYER' as const, from: 'CLOSED' as const, to: 'OPEN' as const, outcome: 'EXTERNAL' },
  { role: 'PLAYER' as const, from: 'OPEN' as const, to: 'CLOSED' as const, outcome: 'EXTERNAL' },
  { role: 'PLAYER' as const, from: 'CLOSED' as const, to: 'LOCKED' as const, outcome: 'FORBIDDEN' },
  { role: 'PLAYER' as const, from: 'LOCKED' as const, to: 'OPEN' as const, outcome: 'FORBIDDEN' },
  { role: 'OWNER' as const, from: 'CLOSED' as const, to: 'LOCKED' as const, outcome: 'EXTERNAL' },
  { role: 'OWNER' as const, from: 'LOCKED' as const, to: 'OPEN' as const, outcome: 'EXTERNAL' }
])('lets $role change a visible $from door to $to: $outcome', ({ role, from, to, outcome }) => {
  const { doorId, scene } = exploredDoorScene(true)
  const plan = planDoorChange({
    scene: { ...scene, doorStates: { [doorId]: from } },
    doorId,
    role,
    state: to
  })
  expect(plan.kind === 'REJECTED' ? plan.code : plan.kind).toBe(outcome)
})

it.each([
  { case: 'an unexplored door', explored: false, missing: false },
  { case: 'a missing door', explored: true, missing: true }
])('refuses a player door change for $case', ({ explored, missing }) => {
  const { doorId, scene } = exploredDoorScene(explored)
  const plan = planDoorChange({
    scene,
    doorId: missing ? crypto.randomUUID() : doorId,
    role: 'PLAYER',
    state: 'OPEN'
  })
  expect(plan).toMatchObject({ code: 'INVALID_COMMAND' })
})

it('lets a player open a door in a fog-OFF Scene even with a kept unexplored layer', () => {
  const { doorId, scene } = exploredDoorScene(false)
  expect(
    planDoorChange({ scene: { ...scene, fogMode: 'OFF' }, doorId, role: 'PLAYER', state: 'OPEN' })
  ).toMatchObject({ kind: 'ACCEPTED' })
  expect(planDoorChange({ scene, doorId, role: 'PLAYER', state: 'OPEN' })).toMatchObject({
    code: 'INVALID_COMMAND'
  })
})

it('plans live token movement with vision and kept fog only while fog is OFF', () => {
  const { scene: base, tokenId } = movementScene(crypto.randomUUID())
  const scene: CampaignSceneStateDto = {
    ...base,
    fogLayers: [createUniformSceneFogLayer(base, { explored: false, ownerUserId: null })],
    tokens: base.tokens.map((token) => ({
      ...token,
      vision: { ...token.vision!, dimRange: 30, enabled: true }
    }))
  }
  const plan = (fogMode: CampaignSceneStateDto['fogMode']) =>
    planLiveSceneCommand({
      command: {
        commandId: crypto.randomUUID(),
        correlationId: null,
        expectedEncounterVersion: null,
        expectedSceneVersion: scene.version,
        movementKind: 'VOLUNTARY',
        path: [
          { x: 10, y: 10 },
          { x: 20, y: 10 }
        ],
        sceneId: scene.id,
        tokenId,
        type: 'MOVE_SCENE_TOKEN'
      },
      scene: { ...scene, fogMode },
      encounterId: null,
      actor: { role: 'OWNER', userId: crypto.randomUUID() }
    })
  expect(plan('OFF')).toMatchObject({ kind: 'ACCEPTED' })
  expect(plan('SHARED_PARTY')).toMatchObject({ kind: 'EXTERNAL' })
})

it('plans bound moves and moves on a bound Scene through room geometry', () => {
  const { scene, tokenId } = movementScene(crypto.randomUUID())
  const plan = (input: {
    expectedEncounterVersion: number | null
    encounterId: string | null
    role: 'OWNER' | 'PLAYER'
  }) =>
    planLiveSceneCommand({
      command: {
        commandId: crypto.randomUUID(),
        correlationId: null,
        expectedEncounterVersion: input.expectedEncounterVersion,
        expectedSceneVersion: scene.version,
        movementKind: 'VOLUNTARY',
        path: [
          { x: 10, y: 10 },
          { x: 20, y: 10 }
        ],
        sceneId: scene.id,
        tokenId,
        type: 'MOVE_SCENE_TOKEN'
      },
      scene: { ...scene, fogMode: 'OFF' },
      encounterId: input.encounterId,
      actor: { role: input.role, userId: crypto.randomUUID() }
    })
  const encounterId = crypto.randomUUID()
  // A bound token follows its actor's controllers, which room geometry checks, never the token's list.
  expect(plan({ expectedEncounterVersion: 3, encounterId, role: 'PLAYER' })).toEqual({
    kind: 'EXTERNAL'
  })
  expect(plan({ expectedEncounterVersion: null, encounterId, role: 'OWNER' })).toEqual({
    kind: 'EXTERNAL'
  })
  expect(plan({ expectedEncounterVersion: null, encounterId, role: 'PLAYER' })).toMatchObject({
    code: 'FORBIDDEN'
  })
})

it('fans out every non-hidden token and door to a player in a fog-OFF Scene', async () => {
  const { doorId, scene: doors } = doorScene(crypto.randomUUID())
  const token = movementScene(doors.campaignId).scene.tokens[0]!
  const allyTokenId = crypto.randomUUID()
  const hiddenTokenId = crypto.randomUUID()
  const scene: CampaignSceneStateDto = {
    ...doors,
    fogMode: 'OFF',
    annotations: [
      { id: crypto.randomUUID(), position: { x: 5, y: 5 }, text: 'GM', visibility: 'GM_ONLY' }
    ],
    tokens: [
      { ...token, controlledByUserIds: [crypto.randomUUID()], id: allyTokenId, label: 'Ally' },
      { ...token, hidden: true, id: hiddenTokenId, label: 'Ambush' }
    ]
  }
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const player = await connectPlayer(base)
  player.socket.send(
    JSON.stringify({
      expectedPresentationVersion: base.capture.presentation!.version,
      sceneId: scene.id,
      type: 'SYNCHRONIZE_SCENE',
      version: scene.version
    })
  )
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        state: expect.objectContaining({
          recipientRole: 'PLAYER',
          scene: expect.objectContaining({
            annotations: [],
            barriers: [expect.objectContaining({ id: doorId })],
            doorStates: { [doorId]: 'CLOSED' },
            tokens: [expect.objectContaining({ id: allyTokenId })]
          })
        }),
        type: 'STATE_SYNC'
      })
    )
  )
})

/** One Scene command message; the room is the only writer of the presented Scene (D79). */
function sceneMessage(command: Record<string, unknown>, expectedSessionSequence: number) {
  return JSON.stringify({
    command: { command, scope: 'SCENE' },
    expectedSessionSequence,
    type: 'COMMAND'
  })
}

function commitsOf(messages: LiveSessionWebSocketServerMessageDto[], commandId: string) {
  return messages.filter(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
}

function rejectionOf(messages: LiveSessionWebSocketServerMessageDto[], commandId: string) {
  return messages.find(
    (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandId
  )
}

/** Records every Checkpoint the room publishes while the fixture keeps answering. */
async function recordCheckpoints(base: Awaited<ReturnType<typeof fixture>>) {
  const publications: Array<ReturnType<typeof liveSessionCheckpointInputSchema.parse>> = []
  await runInDurableObject(base.stub, () => {
    const answer = vi.mocked(globalThis.fetch).getMockImplementation()
    if (!answer) throw new Error('Missing fixture fetch.')
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      if (new URL(request.url).pathname === '/live-sessions/checkpoint')
        publications.push(liveSessionCheckpointInputSchema.parse(await request.clone().json()))
      return answer(request)
    })
  })
  return publications
}

async function storedScene(base: Awaited<ReturnType<typeof fixture>>) {
  const stateJson = await runInDurableObject(
    base.stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ state_json: string }>(
          'SELECT state_json FROM durable_session_authority WHERE id = 1'
        )
        .one().state_json
  )
  return hydrateNativeLiveSessionState(stateJson).scene
}

it('commits an inline GM edit with its INLINE receipt, checkpoints it and replays it', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const publications = await recordCheckpoints(base)
  base.messages.length = 0

  const commandId = crypto.randomUUID()
  const command = {
    commandId,
    expectedSceneVersion: 0,
    illumination: 'DIM',
    sceneId: scene.id,
    type: 'SET_SCENE_AMBIENT_ILLUMINATION'
  }
  base.socket.send(sceneMessage(command, 0))
  await vi.waitFor(() => expect(commitsOf(base.messages, commandId)).toHaveLength(1))
  const [committed] = commitsOf(base.messages, commandId)
  expect(committed).toMatchObject({
    delta: {
      scope: 'SCENE',
      result: {
        delta: { kind: 'AMBIENT_ILLUMINATION_SET', illumination: 'DIM' },
        replayed: false,
        version: 1
      }
    },
    sequence: 1
  })
  expect((await storedScene(base))?.ambientIllumination).toBe('DIM')

  await fireCheckpointAlarm(base.stub)
  expect(publications).toHaveLength(1)
  expect(checkpointReceipt(publications[0]!, commandId)).toMatchObject({
    actorUserId: base.userId,
    encoding: 'INLINE',
    input: command
  })

  base.socket.send(sceneMessage(command, 0))
  await vi.waitFor(() => expect(commitsOf(base.messages, commandId)).toHaveLength(2))
  expect(commitsOf(base.messages, commandId)[1]).toEqual(asReplay(committed))
  base.socket.send(sceneMessage({ ...command, illumination: 'BRIGHT' }, 1))
  await vi.waitFor(() =>
    expect(rejectionOf(base.messages, commandId)).toMatchObject({ code: 'INVALID_COMMAND' })
  )
  expect(publications).toHaveLength(1)
})

it('lets a player save and remove only their own measurements', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const player = await connectPlayer(base)
  player.socket.send(
    JSON.stringify({
      expectedPresentationVersion: base.capture.presentation!.version,
      sceneId: scene.id,
      type: 'SYNCHRONIZE_SCENE',
      version: scene.version
    })
  )
  await vi.waitFor(() =>
    expect(player.messages.some((message) => message.type === 'STATE_SYNC')).toBe(true)
  )
  const measurement = (createdByUserId: string) => ({
    createdByUserId,
    id: crypto.randomUUID(),
    label: null,
    path: [
      { x: 0, y: 0 },
      { x: 20, y: 0 }
    ]
  })
  const upsert = (createdByUserId: string, expectedSceneVersion: number) => ({
    commandId: crypto.randomUUID(),
    expectedSceneVersion,
    measurement: measurement(createdByUserId),
    sceneId: scene.id,
    type: 'UPSERT_SCENE_MEASUREMENT'
  })

  const own = upsert(base.playerId, 0)
  player.socket.send(sceneMessage(own, 0))
  await vi.waitFor(() =>
    expect(commitsOf(player.messages, own.commandId)).toEqual([
      expect.objectContaining({
        delta: expect.objectContaining({
          result: expect.objectContaining({
            delta: { kind: 'MEASUREMENT_UPSERTED', measurement: own.measurement }
          })
        }),
        sequence: 1
      })
    ])
  )

  const forged = upsert(base.userId, 1)
  player.socket.send(sceneMessage(forged, 1))
  const gms = upsert(base.userId, 1)
  base.socket.send(sceneMessage(gms, 1))
  await vi.waitFor(() => {
    expect(rejectionOf(player.messages, forged.commandId)).toMatchObject({ code: 'FORBIDDEN' })
    expect(commitsOf(base.messages, gms.commandId)).toHaveLength(1)
  })
  const removal = {
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 2,
    measurementId: gms.measurement.id,
    sceneId: scene.id,
    type: 'REMOVE_SCENE_MEASUREMENT'
  }
  player.socket.send(sceneMessage(removal, 2))
  await vi.waitFor(() =>
    expect(rejectionOf(player.messages, removal.commandId)).toMatchObject({ code: 'FORBIDDEN' })
  )
  const ownRemoval = {
    ...removal,
    commandId: crypto.randomUUID(),
    measurementId: own.measurement.id
  }
  player.socket.send(sceneMessage(ownRemoval, 2))
  await vi.waitFor(() => expect(commitsOf(player.messages, ownRemoval.commandId)).toHaveLength(1))
  expect((await storedScene(base))?.measurements).toEqual([gms.measurement])
})

it('rebases an inline edit over unrelated changes and refuses a stale target', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  base.messages.length = 0
  const ambient = (expectedSceneVersion: number, illumination: string) => ({
    commandId: crypto.randomUUID(),
    expectedSceneVersion,
    illumination,
    sceneId: scene.id,
    type: 'SET_SCENE_AMBIENT_ILLUMINATION'
  })

  const first = ambient(0, 'DIM')
  base.socket.send(sceneMessage(first, 0))
  await vi.waitFor(() => expect(commitsOf(base.messages, first.commandId)).toHaveLength(1))
  const unrelated = {
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    mode: 'ON_DROP',
    sceneId: scene.id,
    type: 'SET_SCENE_VISION_REVEAL_MODE'
  }
  base.socket.send(sceneMessage(unrelated, 1))
  await vi.waitFor(() =>
    expect(commitsOf(base.messages, unrelated.commandId)).toEqual([
      expect.objectContaining({
        delta: expect.objectContaining({ result: expect.objectContaining({ version: 2 }) })
      })
    ])
  )
  const conflicting = ambient(0, 'ORDINARY_DARKNESS')
  const ahead = ambient(5, 'ORDINARY_DARKNESS')
  base.socket.send(sceneMessage(conflicting, 2))
  base.socket.send(sceneMessage(ahead, 2))
  await vi.waitFor(() => {
    expect(rejectionOf(base.messages, conflicting.commandId)).toMatchObject({
      code: 'STALE_STATE',
      correction: { scope: 'SCENE' }
    })
    expect(rejectionOf(base.messages, ahead.commandId)).toMatchObject({ code: 'STALE_STATE' })
  })
  expect(await storedScene(base)).toMatchObject({
    ambientIllumination: 'DIM',
    version: 2,
    visionRevealMode: 'ON_DROP'
  })
})

it('keeps undo working past an inline edit in the Scene history', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  base.messages.length = 0
  const moveCommandId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify(tokenMoveCommand(value.scene, value.tokenId, moveCommandId, { x: 20, y: 10 }))
  )
  await vi.waitFor(() => expect(commitsOf(base.messages, moveCommandId)).toHaveLength(1))
  const inlineCommandId = crypto.randomUUID()
  base.socket.send(
    sceneMessage(
      {
        commandId: inlineCommandId,
        expectedSceneVersion: 1,
        illumination: 'DIM',
        sceneId: value.scene.id,
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      },
      1
    )
  )
  await vi.waitFor(() => expect(commitsOf(base.messages, inlineCommandId)).toHaveLength(1))
  const undoCommandId = crypto.randomUUID()
  base.socket.send(JSON.stringify(undoMoveCommand(value.scene.id, undoCommandId, 2, 2)))
  await vi.waitFor(() =>
    expect(commitsOf(base.messages, undoCommandId)).toEqual([
      expect.objectContaining({
        delta: expect.objectContaining({
          result: expect.objectContaining({
            delta: expect.objectContaining({
              kind: 'TOKEN_MOVE_UNDONE',
              undoneCommandId: moveCommandId
            }),
            version: 3
          })
        })
      })
    ])
  )
  expect(await storedScene(base)).toMatchObject({ ambientIllumination: 'DIM' })
  expect((await storedScene(base))?.tokens[0]?.position).toEqual({ x: 10, y: 10 })
})

it('derives fog exploration for a GM token upsert, refuses a player and replays it', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const player = await connectPlayer(base)
  base.messages.length = 0
  const token = {
    ...movementScene(scene.campaignId).scene.tokens[0]!,
    controlledByUserIds: [base.playerId],
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 30, directionDegrees: 0, enabled: true }
  }
  const command = {
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    sceneId: scene.id,
    token,
    type: 'UPSERT_SCENE_TOKEN'
  }
  const playerCommand = { ...command, commandId: crypto.randomUUID() }
  player.socket.send(sceneMessage(playerCommand, 0))
  await vi.waitFor(() =>
    expect(rejectionOf(player.messages, playerCommand.commandId)).toMatchObject({
      code: 'FORBIDDEN'
    })
  )

  base.socket.send(sceneMessage(command, 0))
  await vi.waitFor(() => expect(commitsOf(base.messages, command.commandId)).toHaveLength(1))
  const [committed] = commitsOf(base.messages, command.commandId)
  expect(committed).toMatchObject({
    delta: { result: { delta: { kind: 'TOKEN_UPSERTED', token }, version: 1 } },
    sequence: 1
  })
  const stored = await storedScene(base)
  expect(stored?.tokens).toEqual([token])
  expect(stored?.fogLayers).toHaveLength(1)
  expect(stored?.fogLayers[0]).toMatchObject({ ownerUserId: null })
  expect(stored?.fogLayers[0]?.chunks.length).toBeGreaterThan(0)

  base.socket.send(sceneMessage(command, 0))
  await vi.waitFor(() => expect(commitsOf(base.messages, command.commandId)).toHaveLength(2))
  expect(commitsOf(base.messages, command.commandId)[1]).toEqual(asReplay(committed))
})

/** The GM's full explored fog patch for a Scene, as begin input and its chunks. */
function fogPatch(scene: CampaignSceneStateDto) {
  const layer = createUniformSceneFogLayer(scene, { explored: true, ownerUserId: null })
  return {
    chunks: layer.chunks,
    input: {
      chunkManifest: layer.chunks.map((chunk) => ({
        checksum: checksumCanonicalJson(chunk),
        index: chunk.index
      })),
      commandId: crypto.randomUUID(),
      expectedSceneVersion: scene.version,
      layer: { height: layer.height, ownerUserId: null, width: layer.width },
      sceneId: scene.id,
      type: 'PATCH_SCENE_FOG'
    }
  }
}

function fogProgress(messages: LiveSessionWebSocketServerMessageDto[], commandId: string) {
  return messages.flatMap((message) =>
    message.type === 'SCENE_FOG_PROGRESS' && message.progress.commandId === commandId
      ? [message.progress]
      : []
  )
}

it('stages a GM fog patch over the socket, publishes it atomically and replays every step', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const player = await connectPlayer(base)
  const publications = await recordCheckpoints(base)
  base.messages.length = 0
  const patch = fogPatch(scene)
  const { commandId } = patch.input

  player.socket.send(JSON.stringify({ input: patch.input, type: 'SCENE_FOG_BEGIN' }))
  await vi.waitFor(() =>
    expect(rejectionOf(player.messages, commandId)).toMatchObject({ code: 'FORBIDDEN' })
  )
  base.socket.send(JSON.stringify({ input: patch.input, type: 'SCENE_FOG_BEGIN' }))
  await vi.waitFor(() => expect(fogProgress(base.messages, commandId)).toHaveLength(1))
  const [begun] = fogProgress(base.messages, commandId)
  expect(begun).toMatchObject({ receivedChunks: 0, status: 'RECEIVING', totalChunks: 16 })
  const saveId = begun!.saveId

  const publish = {
    commandId,
    expectedSceneVersion: 0,
    saveId,
    sceneId: scene.id,
    type: 'PUBLISH_SCENE_FOG_PATCH'
  }
  base.socket.send(sceneMessage(publish, 0))
  await vi.waitFor(() =>
    expect(rejectionOf(base.messages, commandId)).toMatchObject({
      code: 'INVALID_COMMAND',
      message: 'Scene fog save is incomplete.'
    })
  )
  const append = (offset: number) =>
    JSON.stringify({
      commandId,
      input: { chunks: patch.chunks.slice(offset, offset + 8), offset, saveId },
      type: 'SCENE_FOG_APPEND'
    })
  base.socket.send(append(0))
  base.socket.send(append(0))
  base.socket.send(append(8))
  await vi.waitFor(() => expect(fogProgress(base.messages, commandId)).toHaveLength(4))
  expect(
    fogProgress(base.messages, commandId)
      .slice(1)
      .map((progress) => progress.receivedChunks)
  ).toEqual([8, 8, 16])

  base.socket.send(sceneMessage(publish, 0))
  await vi.waitFor(() => expect(commitsOf(base.messages, commandId)).toHaveLength(1))
  const [committed] = commitsOf(base.messages, commandId)
  expect(committed).toMatchObject({
    delta: { result: { replayed: false, version: 1 } },
    sequence: 1
  })
  expect((await storedScene(base))?.fogLayers).toEqual([
    { ...createUniformSceneFogLayer(scene, { explored: true, ownerUserId: null }) }
  ])
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(expect.objectContaining({ commandId, sequence: 1 }))
  )

  await fireCheckpointAlarm(base.stub)
  expect(publications).toHaveLength(1)
  expect(checkpointReceipt(publications[0]!, commandId)).toMatchObject({
    actorUserId: base.userId,
    encoding: 'FOG_PATCH'
  })
  expect(
    publications[0]!.records.scenes.flatMap((record) =>
      record.changes.map((change) => change.table)
    )
  ).toEqual(expect.arrayContaining(['sceneFogLayers', 'sceneFogChunks', 'sceneFogSaves']))

  base.socket.send(sceneMessage(publish, 0))
  base.socket.send(JSON.stringify({ input: patch.input, type: 'SCENE_FOG_BEGIN' }))
  await vi.waitFor(() => {
    expect(commitsOf(base.messages, commandId)).toHaveLength(2)
    expect(fogProgress(base.messages, commandId)).toHaveLength(5)
  })
  expect(commitsOf(base.messages, commandId)[1]).toEqual(asReplay(committed))
  expect(fogProgress(base.messages, commandId)[4]).toMatchObject({
    receivedChunks: 16,
    saveId,
    status: 'PUBLISHED'
  })
  expect(publications).toHaveLength(1)
})

it('bounds staged fog per GM and expires an unpublished patch', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  base.messages.length = 0
  const patches = Array.from({ length: ROOM_LIMITS.maxFogUploadsPerUser + 1 }, () =>
    fogPatch(scene)
  )
  for (const patch of patches)
    base.socket.send(JSON.stringify({ input: patch.input, type: 'SCENE_FOG_BEGIN' }))
  const over = patches.at(-1)!.input.commandId
  await vi.waitFor(() =>
    expect(rejectionOf(base.messages, over)).toMatchObject({ code: 'RATE_LIMITED' })
  )
  const first = patches[0]!
  const [begun] = fogProgress(base.messages, first.input.commandId)
  if (!begun) throw new Error('Missing staged fog patch.')
  base.socket.send(
    JSON.stringify({
      commandId: first.input.commandId,
      input: { chunks: first.chunks.slice(0, 8), offset: 0, saveId: begun.saveId },
      type: 'SCENE_FOG_APPEND'
    })
  )
  await vi.waitFor(() => expect(fogProgress(base.messages, first.input.commandId)).toHaveLength(2))

  const later = Date.now() + ROOM_LIMITS.fogUploadWindowMs + 1
  vi.spyOn(Date, 'now').mockReturnValue(later)
  base.socket.send(
    sceneMessage(
      {
        commandId: first.input.commandId,
        expectedSceneVersion: 0,
        saveId: begun.saveId,
        sceneId: scene.id,
        type: 'PUBLISH_SCENE_FOG_PATCH'
      },
      0
    )
  )
  await vi.waitFor(() =>
    expect(rejectionOf(base.messages, first.input.commandId)).toMatchObject({
      code: 'INVALID_COMMAND',
      message: 'Scene fog save expired.'
    })
  )
  // The expired patches no longer count, so a new one stages.
  const next = fogPatch(scene)
  base.socket.send(JSON.stringify({ input: next.input, type: 'SCENE_FOG_BEGIN' }))
  await vi.waitFor(() =>
    expect(fogProgress(base.messages, next.input.commandId)).toEqual([
      expect.objectContaining({ status: 'RECEIVING' })
    ])
  )
  expect(base.messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
  expect(await journalEvidence(base)).toMatchObject({ authority: { sequence: 0 } })
})

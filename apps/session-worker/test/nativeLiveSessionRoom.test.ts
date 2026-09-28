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
  liveSessionDrainReleaseInputSchema,
  liveSessionPublishInputSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import { liveSessionMovementStageInputSchema } from '@artificer-toolkit/schema/api/liveSessionMovementStage'
import {
  liveSessionEncounterBindingCommitInputSchema,
  liveSessionSceneGeometryCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  liveSessionTransientCaptureInputSchema,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createUniformSceneFogLayer } from '@artificer-toolkit/shared/vtt'

import { DurableCommandJournal } from '../src/durableCommandJournal.js'
import { planLiveSceneCommand } from '../src/nativeRoomSceneCommand.js'
import {
  createNativeLiveSessionState,
  hydrateNativeLiveSessionState,
  projectNativeLiveSessionState
} from '../src/nativeLiveSessionState.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const sockets: WebSocket[] = []

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
    sceneMovementDecisionPending: false,
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
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
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
        return Response.json({
          activationFingerprint,
          persistedSequence: 0,
          persistedStateChecksum: activationFingerprint
        })
      }
      if (pathname === '/live-sessions/activate') {
        expect(request.headers.get('authorization')).toBeNull()
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
      if (pathname === '/live-sessions/begin-drain') {
        const body = liveSessionDrainReleaseInputSchema.parse(await request.json())
        authorityLifecycleCalls.push(pathname)
        const now = new Date().toISOString()
        return Response.json({
          activationFingerprint,
          campaignId,
          createdAt: now,
          epoch: authorityEpoch,
          finalSequence: body.finalSequence,
          finalStateChecksum: body.finalStateChecksum,
          persistedSequence: body.finalSequence,
          persistedStateChecksum: body.finalStateChecksum,
          phase: 'DRAINING',
          updatedAt: now
        })
      }
      if (pathname === '/live-sessions/release') {
        liveSessionDrainReleaseInputSchema.parse(await request.json())
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
    await synchronizeScene(base, value.scene)
    if (!base.capture.presentation) throw new Error('Missing Scene presentation.')
    base.capture.presentation.version = 2
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
    let publication: ReturnType<typeof liveSessionPublishInputSchema.parse> | null = null
    let heldEvidence: {
      authority: { published_sequence: number; sequence: number }
      outboxCount: number
    } | null = null
    await runInDurableObject(base.stub, (_instance, state) => {
      vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        expect(new URL(request.url).pathname).toBe('/live-sessions/publish')
        const body = liveSessionPublishInputSchema.parse(await request.json())
        if (!('expectedSceneResult' in body)) throw new Error('Expected Scene publication.')
        publication = body
        heldEvidence = {
          authority: state.storage.sql
            .exec<{ published_sequence: number; sequence: number }>(
              'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
            )
            .one(),
          outboxCount: state.storage.sql
            .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
            .one().count
        }
        publishStarted = true
        await new Promise((resolve) => setTimeout(resolve, 250))
        publishFinished = true
        const now = new Date().toISOString()
        return Response.json({
          authority: {
            activationFingerprint: 'a'.repeat(64),
            campaignId: body.campaignId,
            createdAt: now,
            epoch: body.epoch,
            persistedSequence: body.sequence,
            persistedStateChecksum: body.stateChecksum,
            phase: 'DO_ACTIVE',
            updatedAt: now
          },
          sceneResult: body.expectedSceneResult,
          scope: 'SCENE'
        })
      })
    })

    const commandId = crypto.randomUUID()
    const command = doorCommand(value.scene, value.doorId, commandId)
    base.socket.send(JSON.stringify(command))
    await vi.waitFor(() => expect(publishStarted).toBe(true))
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
    expect(heldEvidence).toEqual({
      authority: { published_sequence: 0, sequence: 1 },
      outboxCount: 1
    })
    expect(publishFinished).toBe(false)

    await vi.waitFor(() => expect(publishFinished).toBe(true))
    await vi.waitFor(async () => {
      const evidence = await runInDurableObject(base.stub, (_instance, state) => ({
        authority: state.storage.sql
          .exec<{ published_sequence: number; sequence: number }>(
            'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
          )
          .one(),
        outboxCount: state.storage.sql
          .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
          .one().count
      }))
      expect(evidence).toEqual({
        authority: { published_sequence: 1, sequence: 1 },
        outboxCount: 0
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
    const doorReceipt = await runInDurableObject(base.stub, (_instance, state) =>
      state.storage.sql
        .exec<{ undo_json: string | null }>(
          'SELECT undo_json FROM durable_command_receipts WHERE command_id = ?',
          commandId
        )
        .one()
    )
    expect(doorReceipt.undo_json).toBeNull()

    base.socket.send(
      JSON.stringify(doorCommand(value.scene, value.doorId, commandId, { state: 'LOCKED' }))
    )
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({ code: 'INVALID_COMMAND', commandId, type: 'COMMAND_REJECTED' })
      )
    )
    expect(publication).toMatchObject({
      command: {
        command: command.command.command,
        scope: 'SCENE',
        presentation: {
          expectedPresentationVersion: 2
        }
      },
      expectedSceneResult: {
        commandId,
        delta: { barrierId: value.doorId, kind: 'DOOR_STATE_SET', state: 'OPEN' },
        replayed: false,
        sceneId: value.scene.id,
        version: 1
      }
    })
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
    const publications: Array<ReturnType<typeof liveSessionPublishInputSchema.parse>> = []
    const presentations: Array<ReturnType<typeof liveSessionPresentationCommitInputSchema.parse>> =
      []
    await runInDurableObject(base.stub, (_instance, state) => {
      const originalFetch = vi.mocked(globalThis.fetch).getMockImplementation()
      if (!originalFetch) throw new Error('Missing native request fixture.')
      vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        const pathname = new URL(request.url).pathname
        if (pathname === '/live-sessions/publish') {
          const body = liveSessionPublishInputSchema.parse(await request.json())
          if (!('expectedSceneResult' in body)) throw new Error('Expected Scene publication.')
          publications.push(body)
          if (publications.length === 1) await heldPublication
          if (publicationFails) return new Response('Publication unavailable.', { status: 409 })
          expect(base.capture.presentation?.sceneId).toBe(body.command.command.sceneId)
          expect(base.capture.presentation?.version).toBe(
            body.command.presentation.expectedPresentationVersion
          )
          const result = body.expectedSceneResult
          if (result.delta?.kind !== 'DOOR_STATE_SET')
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
          const now = new Date().toISOString()
          return Response.json({
            authority: {
              activationFingerprint: 'a'.repeat(64),
              campaignId: body.campaignId,
              createdAt: now,
              epoch: body.epoch,
              persistedSequence: body.sequence,
              persistedStateChecksum: body.stateChecksum,
              phase: 'DO_ACTIVE',
              updatedAt: now
            },
            sceneResult: result,
            scope: 'SCENE'
          })
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
    await vi.waitFor(() => expect(publications).toHaveLength(1))
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
            .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
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
    await vi.waitFor(async () => {
      const final = await runInDurableObject(base.stub, (_instance, state) => ({
        authority: state.storage.sql
          .exec<{ published_sequence: number; sequence: number }>(
            'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
          )
          .one(),
        outboxCount: state.storage.sql
          .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
          .one().count
      }))
      expect(final).toEqual({
        authority: { published_sequence: 3, sequence: 3 },
        outboxCount: 0
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
  const publications: Array<ReturnType<typeof liveSessionPublishInputSchema.parse>> = []
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
      if (pathname === '/live-sessions/publish') {
        const body = liveSessionPublishInputSchema.parse(await request.json())
        if (!('expectedSceneResult' in body)) throw new Error('Expected Scene publication.')
        publications.push(body)
        expect(base.capture.presentation?.version).toBe(2)
        expect(body.command.presentation.expectedPresentationVersion).toBe(2)
        const now = new Date().toISOString()
        return Response.json({
          authority: {
            activationFingerprint: 'a'.repeat(64),
            campaignId: body.campaignId,
            createdAt: now,
            epoch: body.epoch,
            persistedSequence: body.sequence,
            persistedStateChecksum: body.stateChecksum,
            phase: 'DO_ACTIVE',
            updatedAt: now
          },
          sceneResult: body.expectedSceneResult,
          scope: 'SCENE'
        })
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
  await vi.waitFor(() => expect(publications).toHaveLength(1))
})

it.each([false, true])(
  'commits standalone movement and undo with legacy receipt %s, replays, and rejects an uncontrolled player',
  async (legacyUndo) => {
    const value = movementScene(crypto.randomUUID())
    const base = await fixture(value.scene)
    await synchronizeScene(base, value.scene)
    if (!base.capture.presentation) throw new Error('Missing Scene presentation.')
    base.capture.presentation.version = 2
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

    const publications: Array<ReturnType<typeof liveSessionPublishInputSchema.parse>> = []
    const heldEvidence: Array<{
      authority: { published_sequence: number; sequence: number }
      outboxCount: number
    }> = []
    let publishFinished = 0
    await runInDurableObject(base.stub, (_instance, state) => {
      vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        expect(new URL(request.url).pathname).toBe('/live-sessions/publish')
        const body = liveSessionPublishInputSchema.parse(await request.json())
        if (!('expectedSceneResult' in body)) throw new Error('Expected Scene publication.')
        publications.push(body)
        heldEvidence.push({
          authority: state.storage.sql
            .exec<{ published_sequence: number; sequence: number }>(
              'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
            )
            .one(),
          outboxCount: state.storage.sql
            .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
            .one().count
        })
        await new Promise((resolve) => setTimeout(resolve, 250))
        publishFinished += 1
        const now = new Date().toISOString()
        return Response.json({
          authority: {
            activationFingerprint: 'a'.repeat(64),
            campaignId: body.campaignId,
            createdAt: now,
            epoch: body.epoch,
            persistedSequence: body.sequence,
            persistedStateChecksum: body.stateChecksum,
            phase: 'DO_ACTIVE',
            updatedAt: now
          },
          sceneResult: body.expectedSceneResult,
          scope: 'SCENE'
        })
      })
    })

    const movedPosition = { x: 20, y: 10 }
    const moveCommandId = crypto.randomUUID()
    const move = tokenMoveCommand(value.scene, value.tokenId, moveCommandId, movedPosition)
    base.socket.send(JSON.stringify(move))
    await vi.waitFor(() => expect(publications).toHaveLength(1))
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
    expect(heldEvidence[0]).toEqual({
      authority: { published_sequence: 0, sequence: 1 },
      outboxCount: 1
    })
    expect(publishFinished).toBe(0)

    await vi.waitFor(() => expect(publishFinished).toBe(1))
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

    const compactUndo = {
      id: value.scene.id,
      version: value.scene.version,
      tokens: [{ id: value.tokenId, position: value.scene.tokens[0]!.position }]
    }
    await runInDurableObject(base.stub, (_instance, state) => {
      const stored = state.storage.sql
        .exec<{ undo_json: string }>(
          'SELECT undo_json FROM durable_command_receipts WHERE command_id = ?',
          moveCommandId
        )
        .one()
      expect(JSON.parse(stored.undo_json)).toEqual(compactUndo)
      if (legacyUndo)
        state.storage.sql.exec(
          'UPDATE durable_command_receipts SET undo_json = ? WHERE command_id = ?',
          JSON.stringify(value.scene),
          moveCommandId
        )
    })
    base.messages.length = 0
    player.messages.length = 0
    const undoCommandId = crypto.randomUUID()
    const undo = undoMoveCommand(value.scene.id, undoCommandId, 1, 1)
    base.socket.send(JSON.stringify(undo))
    await vi.waitFor(() => expect(publications).toHaveLength(2))
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
    expect(heldEvidence[1]).toEqual({
      authority: { published_sequence: 1, sequence: 2 },
      outboxCount: 1
    })
    expect(publishFinished).toBe(1)

    await vi.waitFor(() => expect(publishFinished).toBe(2))
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
    const undoCopies = await runInDurableObject(base.stub, (_instance, state) =>
      state.storage.sql
        .exec<{ command_id: string; undo_json: string | null }>(
          `SELECT command_id, undo_json FROM durable_command_receipts
         WHERE command_id IN (?, ?) ORDER BY sequence`,
          moveCommandId,
          undoCommandId
        )
        .toArray()
    )
    expect(undoCopies).toHaveLength(2)
    expect(undoCopies[0]?.command_id).toBe(moveCommandId)
    expect(JSON.parse(undoCopies[0]!.undo_json!)).toEqual(legacyUndo ? value.scene : compactUndo)
    expect(undoCopies[1]).toEqual({ command_id: undoCommandId, undo_json: null })

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
    if (!('expectedSceneResult' in movePublication) || !('expectedSceneResult' in undoPublication))
      throw new Error('Missing Scene publication evidence.')
    expect(movePublication).toEqual({
      actorRole: 'OWNER',
      actorUserId: base.userId,
      campaignId: base.capture.campaignId,
      command: {
        command: move.command.command,
        scope: 'SCENE',
        presentation: {
          expectedPresentationVersion: 2
        }
      },
      epoch: base.authorityEpoch,
      expectedSceneResult: moveCommitted.delta.result,
      expectedStateChecksum: expect.any(String),
      occurredAt: expect.any(String),
      receiptId: moveCommandId,
      sequence: 1,
      stateChecksum: expect.any(String)
    })
    expect(undoPublication).toEqual({
      actorRole: 'OWNER',
      actorUserId: base.userId,
      campaignId: base.capture.campaignId,
      command: {
        command: undo.command.command,
        scope: 'SCENE',
        presentation: {
          expectedPresentationVersion: 2
        }
      },
      epoch: base.authorityEpoch,
      expectedSceneResult: undoCommitted.delta.result,
      expectedStateChecksum: movePublication.stateChecksum,
      occurredAt: expect.any(String),
      receiptId: undoCommandId,
      sequence: 2,
      stateChecksum: expect.any(String)
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
      const restored = hydrateNativeLiveSessionState(current.state_json, current.state_checksum)
      expect(current).toMatchObject({ published_sequence: 2, sequence: 2 })
      expect(restored.scene?.tokens[0]?.position).toEqual({ x: 10, y: 10 })
    })
  }
)
type ExternalConvex = {
  calls: string[]
  commits: Array<ReturnType<typeof liveSessionSceneGeometryCommitInputSchema.parse>>
  stages: Array<ReturnType<typeof liveSessionMovementStageInputSchema.parse>>
  stagedOwners: Array<string | null>
  /** What the next commit does: answer, time out (no response) or refuse. */
  commit: 'COMMIT' | 'TIMEOUT' | 'REFUSE'
  resolve: 'COMMITTED' | 'ABANDONED'
  stage?: (body: ReturnType<typeof liveSessionMovementStageInputSchema.parse>) => Response | null
}

/** A fake Convex for the room's Convex-first pipeline (D27); it records each private route call. */
async function installExternalConvex(base: Awaited<ReturnType<typeof fixture>>) {
  const convex: ExternalConvex = {
    calls: [],
    commits: [],
    stages: [],
    stagedOwners: [],
    commit: 'COMMIT',
    resolve: 'COMMITTED'
  }
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === '/live-sessions/encounter-movement-stage') {
      convex.calls.push('stage')
      const body = liveSessionMovementStageInputSchema.parse(await request.json())
      convex.stages.push(body)
      const custom = convex.stage?.(body)
      if (custom) return custom
      if (body.command.type !== 'MOVE_SCENE_TOKEN' && body.command.type !== 'SET_SCENE_DOOR_STATE')
        throw new Error('Unexpected external decision.')
      const saveId = crypto.randomUUID()
      return Response.json({
        kind: 'STAGED',
        begun: {
          kind: 'READY',
          saveId,
          input: body.command,
          header: base.capture.sceneHeader,
          encounterId: base.capture.sceneEncounterId
        },
        saveId,
        capture: null
      })
    }
    if (pathname === '/live-sessions/scene-geometry') {
      convex.calls.push('commit')
      const body = liveSessionSceneGeometryCommitInputSchema.parse(await request.json())
      convex.commits.push(body)
      convex.stagedOwners.push(...body.fogLayers.map((layer) => layer.ownerUserId))
      if (convex.commit === 'TIMEOUT') throw new TypeError('The Convex request timed out.')
      if (convex.commit === 'REFUSE')
        return new Response('Live Session Scene commit unavailable.', { status: 409 })
      const stage = convex.stages.at(-1)!
      return Response.json({
        sceneId: body.expectedScene.sceneId,
        commandId: stage.command.commandId,
        version: body.expectedScene.version,
        occurrence: null,
        replayed: false,
        delta: body.expectedScene.delta,
        fogPatches: []
      })
    }
    if (pathname === '/live-sessions/external-commit-resolve') {
      expect(request.headers.get('authorization')).toBeNull()
      convex.calls.push('resolve')
      return Response.json({ outcome: convex.resolve })
    }
    if (pathname === '/live-sessions/begin-drain') convex.calls.push('beginDrain')
    return undefined
  })
  return convex
}

async function journalEvidence(base: Awaited<ReturnType<typeof fixture>>) {
  return runInDurableObject(base.stub, (_instance, state) => ({
    authority: state.storage.sql
      .exec<{ published_sequence: number; sequence: number }>(
        'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
      )
      .one(),
    outboxCount: state.storage.sql
      .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
      .one().count,
    records: state.storage.sql
      .exec<{ command_id: string }>('SELECT command_id FROM durable_external_commit')
      .toArray()
      .map((row) => row.command_id)
  }))
}

it('commits a move on an Encounter-bound Scene Convex-first with the authority advance (D27)', async () => {
  const value = movementScene(crypto.randomUUID())
  // Fog OFF lets the player see the moved token.
  value.scene.fogMode = 'OFF'
  const base = await fixture(value.scene)
  base.capture.sceneEncounterId = crypto.randomUUID()
  await synchronizeScene(base, value.scene)
  const player = await connectPlayer(base)
  const convex = await installExternalConvex(base)
  // The journal holds no Scene until its first committed command.
  const initial = createNativeLiveSessionState()
  base.messages.length = 0
  player.messages.length = 0

  const commandId = crypto.randomUUID()
  const command = tokenMoveCommand(value.scene, value.tokenId, commandId, { x: 20, y: 10 })
  base.socket.send(JSON.stringify(command))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ commandId, sequence: 1, type: 'COMMAND_COMMITTED' })
    )
  )
  // One stage (begin and observe the Scene vision) and one commit; fog is OFF, so no layer (D52).
  expect(convex.calls).toEqual(['stage', 'commit'])
  const moved = {
    ...value.scene,
    tokens: value.scene.tokens.map((token) => ({ ...token, position: { x: 20, y: 10 } })),
    version: 1
  }
  expect(convex.commits).toEqual([
    {
      campaignId: base.capture.campaignId,
      authorityEpoch: base.authorityEpoch,
      expectedUserId: base.userId,
      expectedRole: 'OWNER',
      finish: { saveId: expect.any(String), baseOrdinal: 0 },
      fogLayers: [],
      authority: {
        sequence: 1,
        expectedStateChecksum: initial.stateChecksum,
        stateChecksum: createNativeLiveSessionState(moved).stateChecksum
      },
      expectedScene: {
        sceneId: value.scene.id,
        version: 1,
        delta: { kind: 'TOKEN_MOVED', tokenId: value.tokenId, position: { x: 20, y: 10 } }
      }
    }
  ])
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        commandId,
        delta: { scope: 'SCENE', result: expect.objectContaining({ occurrence: null }) },
        sequence: 1
      })
    )
  )
  // Convex persisted the sequence itself: the journal advances with nothing left to publish.
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 1, sequence: 1 },
    outboxCount: 0,
    records: []
  })

  const first = base.messages.find(
    (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
  )
  base.socket.send(JSON.stringify(command))
  // An exact retry returns the stored receipt, reporting the replay as Convex does (D47).
  await vi.waitFor(() =>
    expect(
      base.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toEqual([first, asReplay(first)])
  )
  const reused = tokenMoveCommand(moved, value.tokenId, commandId, { x: 30, y: 10 }, 1)
  base.socket.send(JSON.stringify(reused))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ code: 'INVALID_COMMAND', commandId, type: 'COMMAND_REJECTED' })
    )
  )
  expect(convex.calls).toEqual(['stage', 'commit'])
})

it('stages each fog owner on a fog-deriving move and resynchronizes the table', async () => {
  const value = movementScene(crypto.randomUUID())
  const [first, second] = [crypto.randomUUID(), crypto.randomUUID()]
  const scene: CampaignSceneStateDto = {
    ...value.scene,
    fogMode: 'PER_PLAYER',
    tokens: value.scene.tokens.map((token) => ({
      ...token,
      controlledByUserIds: [first, second].sort(),
      vision: { ...token.vision!, dimRange: 30, enabled: true }
    }))
  }
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const convex = await installExternalConvex(base)
  base.messages.length = 0

  const commandId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify(tokenMoveCommand(scene, value.tokenId, commandId, { x: 20, y: 10 }))
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        sequence: 1,
        state: expect.objectContaining({
          scene: expect.objectContaining({
            fogLayers: expect.arrayContaining([
              expect.objectContaining({ ownerUserId: first }),
              expect.objectContaining({ ownerUserId: second })
            ])
          })
        }),
        type: 'STATE_SYNC'
      })
    )
  )
  // Each owner's complete layer travels with the commit, which stages it in its transaction (D52).
  expect(convex.calls).toEqual(['stage', 'commit'])
  expect(convex.stagedOwners.sort()).toEqual([first, second].sort())
})

it('keeps the record of a commit that timed out, and the next command settles it', async () => {
  for (const outcome of ['COMMITTED', 'ABANDONED'] as const) {
    const value = movementScene(crypto.randomUUID())
    const base = await fixture(value.scene)
    base.capture.sceneEncounterId = crypto.randomUUID()
    await synchronizeScene(base, value.scene)
    const convex = await installExternalConvex(base)
    convex.commit = 'TIMEOUT'
    convex.resolve = outcome
    base.messages.length = 0

    const commandId = crypto.randomUUID()
    base.socket.send(
      JSON.stringify(tokenMoveCommand(value.scene, value.tokenId, commandId, { x: 20, y: 10 }))
    )
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({ code: 'UNAVAILABLE', commandId, type: 'COMMAND_REJECTED' })
      )
    )
    expect(await journalEvidence(base)).toEqual({
      authority: { published_sequence: 0, sequence: 0 },
      outboxCount: 0,
      records: [commandId]
    })

    convex.commit = 'COMMIT'
    const nextId = crypto.randomUUID()
    base.socket.send(
      JSON.stringify(tokenMoveCommand(value.scene, value.tokenId, nextId, { x: 30, y: 10 }))
    )
    await vi.waitFor(() => expect(convex.calls).toContain('resolve'))
    // A recovered commit takes sequence 1; after an abandoned one the next command does.
    await vi.waitFor(async () =>
      expect(await journalEvidence(base)).toEqual({
        authority: { published_sequence: 1, sequence: 1 },
        outboxCount: 0,
        records: []
      })
    )
    if (outcome === 'COMMITTED')
      // Members never saw the recovered commit, so every socket resynchronizes.
      await vi.waitFor(() =>
        expect(base.messages.some((message) => message.type === 'AUTHENTICATION_REQUIRED')).toBe(
          true
        )
      )
    else
      await vi.waitFor(() =>
        expect(base.messages).toContainEqual(
          expect.objectContaining({ commandId: nextId, sequence: 1, type: 'COMMAND_COMMITTED' })
        )
      )
  }
})

it('surfaces a refused commit and leaves the room unchanged', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  base.capture.sceneEncounterId = crypto.randomUUID()
  await synchronizeScene(base, value.scene)
  const convex = await installExternalConvex(base)
  convex.commit = 'REFUSE'
  base.messages.length = 0
  const commandId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify(tokenMoveCommand(value.scene, value.tokenId, commandId, { x: 20, y: 10 }))
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'STALE_STATE',
        commandId,
        correction: expect.objectContaining({ scope: 'SCENE' }),
        type: 'COMMAND_REJECTED'
      })
    )
  )
  // A response means Convex rolled back, so the record is forgotten without a resolve call.
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 0, sequence: 0 },
    outboxCount: 0,
    records: []
  })
  expect(convex.calls).not.toContain('resolve')
})

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

/** Serves the room's binding commit like Convex, recording each request body. */
async function installBindingConvex(
  base: Awaited<ReturnType<typeof fixture>>,
  outcome: () => 'COMMIT' | 'TIMEOUT' = () => 'COMMIT'
) {
  const commits: Array<ReturnType<typeof liveSessionEncounterBindingCommitInputSchema.parse>> = []
  const resolves: unknown[] = []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === '/live-sessions/external-commit-resolve') {
      resolves.push(await request.clone().json())
      return undefined
    }
    if (pathname !== '/live-sessions/encounter-binding') return undefined
    const body = liveSessionEncounterBindingCommitInputSchema.parse(await request.json())
    commits.push(body)
    if (outcome() === 'TIMEOUT') throw new TypeError('The Convex request timed out.')
    return Response.json({
      commandId: body.command.commandId,
      encounterId: body.command.encounterId,
      replayed: false,
      sceneId: body.sceneId
    })
  })
  return { commits, resolves }
}

it('binds an Encounter to the presented Scene through the room, GM only, then moves run Convex-first (D47)', async () => {
  const value = movementScene(crypto.randomUUID())
  value.scene.fogMode = 'OFF'
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  const player = await connectPlayer(base)
  const convex = await installExternalConvex(base)
  const binding = await installBindingConvex(base)
  const encounterId = crypto.randomUUID()
  const initial = createNativeLiveSessionState()
  base.messages.length = 0
  player.messages.length = 0

  // A player may not bind: the refusal says it is the GM's.
  const refusedId = crypto.randomUUID()
  player.socket.send(JSON.stringify(bindCommand(encounterId, refusedId)))
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        code: 'DOMAIN_REJECTED',
        commandId: refusedId,
        reason: 'GM_ONLY',
        type: 'COMMAND_REJECTED'
      })
    )
  )
  expect(binding.commits).toEqual([])

  const commandId = crypto.randomUUID()
  base.socket.send(JSON.stringify(bindCommand(encounterId, commandId)))
  const committed = {
    commandId,
    delta: {
      scope: 'ENCOUNTER_BINDING',
      result: { commandId, encounterId, replayed: false, sceneId: value.scene.id }
    },
    sequence: 1,
    type: 'COMMAND_COMMITTED'
  }
  // Every member gets the binding with the new sequence.
  await vi.waitFor(() => expect(base.messages).toContainEqual(committed))
  await vi.waitFor(() => expect(player.messages).toContainEqual(committed))
  expect(binding.commits).toEqual([
    {
      campaignId: base.capture.campaignId,
      authorityEpoch: base.authorityEpoch,
      expectedUserId: base.userId,
      expectedRole: 'OWNER',
      command: { commandId, encounterId, type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE' },
      sceneId: value.scene.id,
      presentation: { expectedPresentationVersion: 1 },
      // A binding advances the sequence and leaves the room's state unchanged.
      authority: {
        sequence: 1,
        expectedStateChecksum: initial.stateChecksum,
        stateChecksum: initial.stateChecksum
      },
      expiresAt: expect.any(Number)
    }
  ])
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 1, sequence: 1 },
    outboxCount: 0,
    records: []
  })

  // An exact retry replays the stored receipt without another commit.
  base.socket.send(JSON.stringify(bindCommand(encounterId, commandId)))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual({
      ...committed,
      delta: { ...committed.delta, result: { ...committed.delta.result, replayed: true } }
    })
  )
  expect(binding.commits).toHaveLength(1)

  // The Scene is now Encounter-bound, so a move on it commits to Convex first.
  const moveId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify(tokenMoveCommand(value.scene, value.tokenId, moveId, { x: 20, y: 10 }, 1))
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ commandId: moveId, sequence: 2, type: 'COMMAND_COMMITTED' })
    )
  )
  expect(convex.calls).toEqual(['stage', 'commit'])
})

it('keeps the record of a binding whose commit timed out and settles it by its binding subject', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  const convex = await installExternalConvex(base)
  convex.resolve = 'ABANDONED'
  let timeout = true
  const binding = await installBindingConvex(base, () => (timeout ? 'TIMEOUT' : 'COMMIT'))
  const encounterId = crypto.randomUUID()
  base.messages.length = 0

  const lostId = crypto.randomUUID()
  base.socket.send(JSON.stringify(bindCommand(encounterId, lostId)))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ code: 'UNAVAILABLE', commandId: lostId, type: 'COMMAND_REJECTED' })
    )
  )
  expect(await journalEvidence(base)).toMatchObject({ records: [lostId] })

  timeout = false
  const nextId = crypto.randomUUID()
  base.socket.send(JSON.stringify(bindCommand(encounterId, nextId)))
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ commandId: nextId, sequence: 1, type: 'COMMAND_COMMITTED' })
    )
  )
  expect(binding.resolves).toEqual([
    expect.objectContaining({
      subject: {
        kind: 'ENCOUNTER_BINDING',
        encounterId,
        commandId: lostId,
        expiresAt: binding.commits[0]!.expiresAt
      }
    })
  ])
})

it('surfaces a player domain rejection from Convex with the Scene correction', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  base.capture.sceneEncounterId = crypto.randomUUID()
  await synchronizeScene(base, value.scene)
  const player = await connectPlayer(base)
  player.socket.send(
    JSON.stringify({
      expectedPresentationVersion: base.capture.presentation!.version,
      sceneId: value.scene.id,
      type: 'SYNCHRONIZE_SCENE',
      version: value.scene.version
    })
  )
  await vi.waitFor(() =>
    expect(player.messages.some((message) => message.type === 'STATE_SYNC')).toBe(true)
  )
  const convex = await installExternalConvex(base)
  convex.stage = () =>
    Response.json(
      {
        code: 'DOMAIN_REJECTED',
        reason: 'NOT_ACTOR_CONTROLLER',
        message: "You don't control this actor."
      },
      { status: 422 }
    )
  const commandId = crypto.randomUUID()
  const bound = tokenMoveCommand(value.scene, value.tokenId, commandId, { x: 20, y: 10 })
  player.socket.send(
    JSON.stringify({
      ...bound,
      command: {
        ...bound.command,
        command: { ...bound.command.command, expectedEncounterVersion: 4 }
      }
    })
  )
  await vi.waitFor(() =>
    expect(player.messages).toContainEqual(
      expect.objectContaining({
        code: 'DOMAIN_REJECTED',
        commandId,
        correction: expect.objectContaining({ scope: 'SCENE' }),
        reason: 'NOT_ACTOR_CONTROLLER',
        type: 'COMMAND_REJECTED'
      })
    )
  )
  // The room never applies the token's own controller list to a bound token.
  expect(convex.stages).toHaveLength(1)
  expect(await journalEvidence(base)).toEqual({
    authority: { published_sequence: 0, sequence: 0 },
    outboxCount: 0,
    records: []
  })
})

it('holds moves and door changes on a Scene waiting on a movement decision, and keeps the chain free (D26)', async () => {
  const value = doorScene(crypto.randomUUID())
  const token = movementScene(value.scene.campaignId).scene.tokens[0]!
  const scene: CampaignSceneStateDto = { ...value.scene, fogMode: 'OFF', tokens: [token] }
  const base = await fixture(scene)
  base.capture.sceneEncounterId = crypto.randomUUID()
  base.capture.sceneMovementDecisionPending = true
  await synchronizeScene(base, scene)
  const encounterId = crypto.randomUUID()
  await routeEncounterRequests(base, async (pathname) =>
    pathname === '/live-sessions/encounter-command'
      ? Response.json(encounterResult(base.capture.campaignId, encounterId))
      : undefined
  )
  base.messages.length = 0
  const [doorId, moveId, roundId] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
  base.socket.send(JSON.stringify(doorCommand(scene, value.doorId, doorId)))
  base.socket.send(JSON.stringify(tokenMoveCommand(scene, token.id, moveId, { x: 20, y: 10 })))
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'SET_ROUND',
          encounterId,
          commandId: roundId,
          expectedVersion: 3,
          round: 2
        }
      }
    })
  )
  for (const commandId of [doorId, moveId])
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
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ commandId: roundId, type: 'COMMAND_COMMITTED' })
    )
  )
})

it('stages a GM void of a held movement decision without a route read (D26, D52)', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  const encounterId = crypto.randomUUID()
  base.capture.sceneEncounterId = encounterId
  base.capture.sceneMovementDecisionPending = true
  await synchronizeScene(base, value.scene)
  const convex = await installExternalConvex(base)
  const routes: unknown[] = []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname !== '/live-sessions/encounter-route') return undefined
    routes.push(await request.json())
    return Response.json({ route: 'MOVEMENT', decline: null })
  })
  convex.stage = () =>
    Response.json(
      {
        code: 'DOMAIN_REJECTED',
        reason: 'DECISION_REQUIRES_ANSWER',
        message: "Dice during a move can't be voided; answer it to continue."
      },
      { status: 422 }
    )
  const command = {
    type: 'VOID_RULE_OCCURRENCE',
    encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: 5,
    occurrenceId: crypto.randomUUID(),
    expectedOccurrenceVersion: 1
  } as const
  base.messages.length = 0
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: { scope: 'ENCOUNTER', command }
    })
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'DOMAIN_REJECTED',
        commandId: command.commandId,
        reason: 'DECISION_REQUIRES_ANSWER'
      })
    )
  )
  // The room holds this Encounter's movement decision, so the stage routes it in the same call.
  expect(routes).toEqual([])
  expect(convex.stages).toEqual([expect.objectContaining({ command })])
  expect(convex.calls).toEqual(['stage'])
})

it('plans a held decision on the planner its stage names when it is no longer a movement decision (D52)', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  const encounterId = crypto.randomUUID()
  base.capture.sceneEncounterId = encounterId
  base.capture.sceneMovementDecisionPending = true
  await synchronizeScene(base, value.scene)
  const convex = await installExternalConvex(base)
  // The held occurrence was settled elsewhere: Convex routes the void to its own recording.
  convex.stage = () => Response.json({ kind: 'ROUTED', route: { route: 'VOID', decline: null } })
  const routed: string[] = []
  await routeEncounterRequests(base, async (pathname) => {
    if (pathname === '/live-sessions/encounter-route') routed.push(pathname)
    if (pathname !== '/live-sessions/encounter-void-prepare') return undefined
    routed.push(pathname)
    return Response.json({
      kind: 'COMPLETE',
      result: encounterResult(base.capture.campaignId, encounterId)
    })
  })
  const command = {
    type: 'VOID_RULE_OCCURRENCE',
    encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: 5,
    occurrenceId: crypto.randomUUID(),
    expectedOccurrenceVersion: 1
  } as const
  base.messages.length = 0
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: { scope: 'ENCOUNTER', command }
    })
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({ commandId: command.commandId, type: 'COMMAND_COMMITTED' })
    )
  )
  expect(convex.calls).toEqual(['stage'])
  expect(routed).toEqual(['/live-sessions/encounter-void-prepare'])
})

it('refuses a movement decision off the presented Scene without staging it (D42)', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  base.capture.sceneEncounterId = crypto.randomUUID()
  await synchronizeScene(base, value.scene)
  const convex = await installExternalConvex(base)
  await routeEncounterRequests(base, async (pathname) =>
    pathname === '/live-sessions/encounter-route'
      ? Response.json({ route: 'MOVEMENT', decline: null })
      : undefined
  )
  const command = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    expectedVersion: 5,
    occurrenceId: crypto.randomUUID(),
    expectedOccurrenceVersion: 1,
    correlationId: null,
    resolution: { kind: 'DECLINE' }
  } as const
  base.messages.length = 0
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: { scope: 'ENCOUNTER', command }
    })
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'DOMAIN_REJECTED',
        commandId: command.commandId,
        reason: 'SCENE_NOT_PRESENTED',
        message: 'Present this Scene to move Encounter tokens.',
        type: 'COMMAND_REJECTED'
      })
    )
  )
  expect(convex.stages).toEqual([])
})

it('settles an unsettled commit before the drain fence when the room closes', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  base.capture.sceneEncounterId = crypto.randomUUID()
  await synchronizeScene(base, value.scene)
  const convex = await installExternalConvex(base)
  convex.commit = 'TIMEOUT'
  convex.resolve = 'ABANDONED'
  const commandId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify(tokenMoveCommand(value.scene, value.tokenId, commandId, { x: 20, y: 10 }))
  )
  await vi.waitFor(async () => expect((await journalEvidence(base)).records).toEqual([commandId]))
  const closed = await control({
    campaignId: value.scene.campaignId,
    operation: { type: 'CLOSE_ROOM' }
  })
  expect(closed.status).toBe(200)
  expect(convex.calls.slice(convex.calls.indexOf('resolve'))).toEqual(['resolve', 'beginDrain'])
  expect(base.authorityLifecycleCalls).toEqual([
    '/live-sessions/begin-drain',
    '/live-sessions/release'
  ])
})

it('completes or abandons a record left by a restart when the next member admits (D27)', async () => {
  for (const persisted of [1, 0]) {
    const value = movementScene(crypto.randomUUID())
    const base = await fixture(value.scene)
    base.capture.sceneEncounterId = crypto.randomUUID()
    await synchronizeScene(base, value.scene)
    const moved = createNativeLiveSessionState({ ...value.scene, version: 1 })
    const commandId = crypto.randomUUID()
    await runInDurableObject(base.stub, (_instance, state) => {
      const journal = new DurableCommandJournal(state.storage)
      const current = journal.readCurrent()!
      journal.beginExternalCommit({
        actorId: base.userId,
        authorityEpoch: base.authorityEpoch,
        commandId,
        expectedSequence: 0,
        expectedStateChecksum: current.stateChecksum,
        fingerprint: 'f'.repeat(64),
        nextStateChecksum: moved.stateChecksum,
        nextStateJson: moved.stateJson,
        receiptJson: JSON.stringify({
          commandId,
          delta: null,
          sequence: 1,
          type: 'COMMAND_COMMITTED'
        }),
        subject: { kind: 'SCENE_SAVE', saveId: crypto.randomUUID() }
      })
    })
    await evictDurableObject(base.stub)
    const resolved: unknown[] = []
    await runInDurableObject(base.stub, () => {
      const previous = vi.mocked(globalThis.fetch).getMockImplementation()
      vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        const pathname = new URL(request.url).pathname
        if (pathname === '/live-sessions/bootstrap')
          return Response.json({
            activationFingerprint: 'a'.repeat(64),
            persistedSequence: persisted,
            persistedStateChecksum: persisted === 1 ? moved.stateChecksum : 'a'.repeat(64)
          })
        if (pathname === '/live-sessions/external-commit-resolve') {
          resolved.push(await request.json())
          return Response.json({ outcome: persisted === 1 ? 'COMMITTED' : 'ABANDONED' })
        }
        if (!previous) throw new Error('Missing base native fetch mock.')
        return previous(input, init)
      })
    })
    base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
    await vi.waitFor(() => expect(resolved).toHaveLength(1))
    await vi.waitFor(async () =>
      expect(await journalEvidence(base)).toMatchObject({
        authority: { published_sequence: persisted, sequence: persisted },
        records: []
      })
    )
  }
})

it('returns projected corrections for stale Session and Scene versions', async () => {
  const value = doorScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  base.messages.length = 0

  const staleSessionId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify(
      doorCommand(value.scene, value.doorId, staleSessionId, { expectedSessionSequence: 1 })
    )
  )
  await vi.waitFor(() =>
    expect(base.messages).toContainEqual(
      expect.objectContaining({
        code: 'STALE_SEQUENCE',
        commandId: staleSessionId,
        correction: expect.objectContaining({
          scope: 'SCENE',
          state: expect.objectContaining({ version: 0 })
        }),
        type: 'COMMAND_REJECTED'
      })
    )
  )

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

it('verifies a prior journal envelope before retaining only its Scene', () => {
  const scene = doorScene(crypto.randomUUID()).scene
  const prior = { characters: [{ legacy: 'discarded' }], encounter: { legacy: 'discarded' }, scene }
  const checksum = checksumCanonicalJson(prior)
  expect(hydrateNativeLiveSessionState(JSON.stringify(prior), checksum)).toEqual({ scene })
  expect(() =>
    hydrateNativeLiveSessionState(JSON.stringify(prior), checksumCanonicalJson(scene))
  ).toThrow('Live Session state checksum mismatch.')
  const preScene = { characters: [] }
  expect(
    hydrateNativeLiveSessionState(JSON.stringify(preScene), checksumCanonicalJson(preScene))
  ).toEqual({ scene: null })
  expect(createNativeLiveSessionState().stateJson).toBe('{"scene":null}')
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
            kind: 'POINTER_PREVIEW',
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
      vi.mocked(globalThis.fetch).mockImplementation(async () => Response.json(base.capture))
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
            kind: 'POINTER_PREVIEW',
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

function encounterResult(campaignId: string, encounterId: string) {
  return {
    projection: {
      id: encounterId,
      campaignId,
      gameSystemId: crypto.randomUUID(),
      blueprintId: crypto.randomUUID(),
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      name: 'Live Encounter',
      status: 'ACTIVE' as const,
      automationMode: 'ASSISTED' as const,
      version: 4,
      round: 2,
      currentActorId: null,
      actors: [],
      createdAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z'
    },
    roll: null,
    occurrence: null
  }
}

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

it('forwards an unplanned Encounter command in room order and acknowledges only its initiator', async () => {
  const base = await fixture(doorScene(crypto.randomUUID()).scene)
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const player = await connectPlayer(base)
  const encounterId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const forwarded: unknown[] = []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname !== '/live-sessions/encounter-command') return undefined
    expect(request.headers.get('authorization')).toBe(`Bearer ${base.accessToken}`)
    forwarded.push(await request.json())
    return Response.json(encounterResult(base.capture.campaignId, encounterId))
  })
  player.messages.length = 0
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: { type: 'SET_ROUND', encounterId, commandId, expectedVersion: 3, round: 2 }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      base.messages.find(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toMatchObject({ delta: { scope: 'ENCOUNTER', result: { projection: { round: 2 } } } })
  )
  expect(forwarded).toEqual([
    {
      campaignId: base.capture.campaignId,
      authorityEpoch: base.authorityEpoch,
      expectedUserId: base.userId,
      expectedRole: 'OWNER',
      command: { type: 'SET_ROUND', encounterId, commandId, expectedVersion: 3, round: 2 }
    }
  ])
  expect(player.messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
})

it('lets a player have one Encounter command in flight', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const player = await connectPlayer(base)
  const encounterId = crypto.randomUUID()
  const [firstId, secondId, thirdId] = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID()
  ]
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let forwarded = 0
  await routeEncounterRequests(base, async (pathname) => {
    if (pathname !== '/live-sessions/encounter-command') return undefined
    forwarded += 1
    if (forwarded === 1) await held
    return Response.json(encounterResult(base.capture.campaignId, encounterId))
  })
  const send = (commandId: string) =>
    player.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: { type: 'SET_ROUND', encounterId, commandId, expectedVersion: 3, round: 2 }
        }
      })
    )
  send(firstId)
  await vi.waitFor(() => expect(forwarded).toBe(1))
  send(secondId)
  await vi.waitFor(() =>
    expect(
      player.messages.find(
        (message) => message.type === 'COMMAND_REJECTED' && message.commandId === secondId
      )
    ).toMatchObject({ code: 'UNAVAILABLE', message: 'Your previous action is still resolving.' })
  )
  release()
  await vi.waitFor(() =>
    expect(
      player.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === firstId
      )
    ).toBe(true)
  )
  // The slot frees once the first command settles.
  send(thirdId)
  await vi.waitFor(() =>
    expect(
      player.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === thirdId
      )
    ).toBe(true)
  )
  expect(forwarded).toBe(2)
})

it('never hands a player an unredacted GM projection', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const player = await connectPlayer(base)
  const encounterId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  await routeEncounterRequests(base, (pathname) => {
    if (pathname !== '/live-sessions/encounter-command') return undefined
    const result = encounterResult(base.capture.campaignId, encounterId)
    return Response.json({
      ...result,
      projection: { ...result.projection, manualReminderMode: 'SUBTLE' }
    })
  })
  player.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: { type: 'SET_ROUND', encounterId, commandId, expectedVersion: 3, round: 2 }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      player.messages.find(
        (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandId
      )
    ).toMatchObject({ code: 'UNAVAILABLE' })
  )
  expect(JSON.stringify(player.messages)).not.toContain('manualReminderMode')
})

it('asks Convex which planner owns a decision and records a GM void that declines nothing', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const encounterId = crypto.randomUUID()
  const occurrenceId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const calls: string[] = []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === '/live-sessions/encounter-route') {
      calls.push(pathname)
      expect(await request.json()).toMatchObject({ command: { encounterId, occurrenceId } })
      return Response.json({ route: 'VOID', decline: null })
    }
    if (pathname === '/live-sessions/encounter-void-prepare') {
      calls.push(pathname)
      return Response.json({
        kind: 'COMPLETE',
        result: encounterResult(base.capture.campaignId, encounterId)
      })
    }
    return undefined
  })
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'VOID_RULE_OCCURRENCE',
          encounterId,
          commandId,
          expectedVersion: 3,
          occurrenceId,
          expectedOccurrenceVersion: 1
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      base.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
  )
  expect(calls).toEqual(['/live-sessions/encounter-route', '/live-sessions/encounter-void-prepare'])
})
it('draws a dice command with the room random source between the Convex dice read and commit', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const encounterId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const command = {
    type: 'ROLL_ENEMY_ACTION',
    encounterId,
    commandId,
    expectedVersion: 3,
    actorId: crypto.randomUUID(),
    featureId: 'whirlwind',
    rollDefinitionId: 'gust',
    visibility: 'PRIVATE'
  }
  const calls: { pathname: string; body: unknown }[] = []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === '/live-sessions/encounter-roll-dice') {
      calls.push({ pathname, body: await request.json() })
      return Response.json({ dice: [20, 6] })
    }
    if (pathname === '/live-sessions/encounter-roll') {
      calls.push({ pathname, body: await request.json() })
      return Response.json(encounterResult(base.capture.campaignId, encounterId))
    }
    return undefined
  })
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: { scope: 'ENCOUNTER', command }
    })
  )
  await vi.waitFor(() =>
    expect(
      base.messages.some(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toBe(true)
  )
  const scope = {
    campaignId: base.capture.campaignId,
    authorityEpoch: base.authorityEpoch,
    expectedUserId: base.userId,
    expectedRole: 'OWNER'
  }
  expect(calls.map((call) => call.pathname)).toEqual([
    '/live-sessions/encounter-roll-dice',
    '/live-sessions/encounter-roll'
  ])
  expect(calls[0]!.body).toEqual({ ...scope, command })
  const commit = calls[1]!.body as { draws: number[] }
  expect(commit).toEqual({ ...scope, command, draws: [expect.any(Number), expect.any(Number)] })
  expect(commit.draws[0]).toBeLessThan(20)
  expect(commit.draws[1]).toBeLessThan(6)
})
it('rejects a refused Encounter command with a generic code and no Convex detail', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const commandId = crypto.randomUUID()
  await routeEncounterRequests(base, (pathname) =>
    pathname === '/live-sessions/encounter-command'
      ? new Response('Encounter version is stale: internal detail', { status: 409 })
      : undefined
  )
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'SET_ROUND',
          encounterId: crypto.randomUUID(),
          commandId,
          expectedVersion: 3,
          round: 2
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      base.messages.find(
        (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandId
      )
    ).toMatchObject({ code: 'STALE_STATE', reason: null })
  )
  expect(JSON.stringify(base.messages)).not.toContain('internal detail')
})

it("tells a player a GM-only Encounter command is the GM's, not a changed Encounter (D42)", async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const commandId = crypto.randomUUID()
  await routeEncounterRequests(base, (pathname) =>
    pathname === '/live-sessions/encounter-command'
      ? Response.json(
          { code: 'DOMAIN_REJECTED', reason: 'GM_ONLY', message: 'Only the GM can do that.' },
          { status: 422 }
        )
      : undefined
  )
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'SET_ROUND',
          encounterId: crypto.randomUUID(),
          commandId,
          expectedVersion: 3,
          round: 2
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      base.messages.find(
        (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandId
      )
    ).toMatchObject({
      code: 'DOMAIN_REJECTED',
      reason: 'GM_ONLY',
      message: 'Only the GM can do that.'
    })
  )
})

it('forwards an expected domain rejection and keeps an unexpected failure generic', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const [rejectedId, failedId] = [crypto.randomUUID(), crypto.randomUUID()]
  // The room serializes commands, so the first forwarded command is the rejected one.
  let forwarded = 0
  await routeEncounterRequests(base, (pathname) => {
    if (pathname !== '/live-sessions/encounter-command') return undefined
    forwarded += 1
    return forwarded === 1
      ? Response.json(
          {
            code: 'DOMAIN_REJECTED',
            reason: 'ACTIVE_ENCOUNTER_EXISTS',
            message: 'Campaign already has an active Encounter.'
          },
          { status: 422 }
        )
      : Response.json({ code: 'INTERNAL', message: 'internal detail' }, { status: 500 })
  })
  for (const commandId of [rejectedId, failedId])
    base.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'SET_ROUND',
            encounterId: crypto.randomUUID(),
            commandId,
            expectedVersion: 3,
            round: 2
          }
        }
      })
    )
  const rejection = (commandId: string) =>
    base.messages.find(
      (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandId
    )
  await vi.waitFor(() => {
    expect(rejection(rejectedId)).toMatchObject({
      code: 'DOMAIN_REJECTED',
      message: 'Campaign already has an active Encounter.',
      reason: 'ACTIVE_ENCOUNTER_EXISTS'
    })
    expect(rejection(failedId)).toMatchObject({
      code: 'UNAVAILABLE',
      message: 'The Encounter command could not be completed.',
      reason: null
    })
  })
  expect(JSON.stringify(base.messages)).not.toContain('internal detail')
})

it('forwards overridable rule warnings with an action rejection', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const warnings = [
    { code: 'ACTION_ECONOMY_UNAVAILABLE', message: 'No bonus action left this turn.' },
    { code: 'TARGET_OUT_OF_RANGE', message: 'The target is out of range.' }
  ]
  await routeEncounterRequests(base, (pathname) =>
    pathname === '/live-sessions/encounter-command'
      ? Response.json(
          {
            code: 'DOMAIN_REJECTED',
            reason: 'RULE_WARNINGS',
            message: 'This action breaks a rule. Do it anyway?',
            warnings
          },
          { status: 422 }
        )
      : undefined
  )
  const commandId = crypto.randomUUID()
  base.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'SET_ROUND',
          encounterId: crypto.randomUUID(),
          commandId,
          expectedVersion: 3,
          round: 2
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      base.messages.find(
        (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandId
      )
    ).toMatchObject({ code: 'DOMAIN_REJECTED', reason: 'RULE_WARNINGS', warnings })
  )
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
    expect(pending.alarm).toBe(pending.releaseAt)
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

it('publishes the pending outbox before an idle room releases its authority', async () => {
  const value = doorScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  await synchronizeScene(base, value.scene)
  const calls: string[] = []
  let publishAvailable = false
  await runInDurableObject(base.stub, () => {
    const original = vi.mocked(globalThis.fetch).getMockImplementation()
    if (!original) throw new Error('Missing native fetch mock.')
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      calls.push(pathname)
      if (pathname !== '/live-sessions/publish') return original(input, init)
      if (!publishAvailable) return new Response('Unavailable.', { status: 503 })
      const body = liveSessionPublishInputSchema.parse(await request.json())
      if (!('expectedSceneResult' in body)) throw new Error('Expected Scene publication.')
      const now = new Date().toISOString()
      return Response.json({
        authority: {
          activationFingerprint: 'a'.repeat(64),
          campaignId: body.campaignId,
          createdAt: now,
          epoch: body.epoch,
          persistedSequence: body.sequence,
          persistedStateChecksum: body.stateChecksum,
          phase: 'DO_ACTIVE',
          updatedAt: now
        },
        sceneResult: body.expectedSceneResult,
        scope: 'SCENE'
      })
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
  await vi.waitFor(() => expect(calls).toContain('/live-sessions/publish'))
  publishAvailable = true
  calls.length = 0

  await leaveAndFireIdleAlarm(base)
  expect(calls).toEqual([
    '/live-sessions/begin-drain',
    '/live-sessions/publish',
    '/live-sessions/release'
  ])
  const journal = await runInDurableObject(base.stub, (_instance, state) => ({
    authority: state.storage.sql
      .exec<{ published_sequence: number; sequence: number; status: string }>(
        'SELECT published_sequence, sequence, status FROM durable_session_authority WHERE id = 1'
      )
      .one(),
    outboxCount: state.storage.sql
      .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
      .one().count
  }))
  expect(journal).toEqual({
    authority: { published_sequence: 1, sequence: 1, status: 'RELEASED' },
    outboxCount: 0
  })
})

it('never captures authority for pointer samples on the synchronized Scene', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  await synchronizeScene(base, scene)
  const captures = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    const header = base.capture.sceneHeader!
    const pointer = (sequence: number) =>
      JSON.stringify({
        type: 'TRANSIENT',
        envelope: {
          audience: 'TABLE',
          kind: 'POINTER_PREVIEW',
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
      await instance.webSocketMessage(socket, pointer(sequence))
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
    await instance.webSocketMessage(socket, pointer(6))
    return captureCalls() - before
  })
  expect(captures).toBe(0)
})

it('rejects commands beyond the pending-command bound without closing the socket', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  // Each forwarded command stays in Convex long enough for the rest to queue behind it.
  await routeEncounterRequests(base, (pathname) =>
    pathname === '/live-sessions/encounter-command'
      ? new Promise<Response>((resolve) =>
          setTimeout(() => resolve(new Response('stale', { status: 409 })), 100)
        )
      : undefined
  )
  const commandIds = Array.from({ length: 9 }, () => crypto.randomUUID())
  for (const commandId of commandIds)
    base.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'SET_ROUND',
            encounterId: crypto.randomUUID(),
            commandId,
            expectedVersion: 3,
            round: 2
          }
        }
      })
    )
  await vi.waitFor(() =>
    expect(
      base.messages.find(
        (message) => message.type === 'COMMAND_REJECTED' && message.commandId === commandIds[8]
      )
    ).toMatchObject({ code: 'UNAVAILABLE', message: 'Too many pending table changes.' })
  )
  expect(base.socket.readyState).toBe(WebSocket.OPEN)
  await vi.waitFor(
    () =>
      expect(base.messages.filter((message) => message.type === 'COMMAND_REJECTED')).toHaveLength(
        9
      ),
    { timeout: 3_000 }
  )
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
    movementDecisionPending: false,
    actor: { role: input.role, userId: crypto.randomUUID() },
    latestUnmatchedMove: () => null
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
      movementDecisionPending: false,
      actor: { role: 'OWNER', userId: crypto.randomUUID() },
      latestUnmatchedMove: () => null
    })
  expect(plan('OFF')).toMatchObject({ kind: 'ACCEPTED' })
  expect(plan('SHARED_PARTY')).toMatchObject({ kind: 'EXTERNAL' })
})

it('commits bound moves and moves on a bound Scene to Convex first, and holds a Scene with a pending movement decision (D26)', () => {
  const { scene, tokenId } = movementScene(crypto.randomUUID())
  const plan = (input: {
    expectedEncounterVersion: number | null
    encounterId: string | null
    movementDecisionPending: boolean
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
      movementDecisionPending: input.movementDecisionPending,
      actor: { role: input.role, userId: crypto.randomUUID() },
      latestUnmatchedMove: () => null
    })
  const encounterId = crypto.randomUUID()
  // A bound token follows its actor's controllers, which Convex checks, never the token's list.
  expect(
    plan({
      expectedEncounterVersion: 3,
      encounterId,
      movementDecisionPending: false,
      role: 'PLAYER'
    })
  ).toEqual({ kind: 'EXTERNAL' })
  expect(
    plan({
      expectedEncounterVersion: null,
      encounterId,
      movementDecisionPending: false,
      role: 'OWNER'
    })
  ).toEqual({ kind: 'EXTERNAL' })
  expect(
    plan({
      expectedEncounterVersion: null,
      encounterId,
      movementDecisionPending: false,
      role: 'PLAYER'
    })
  ).toMatchObject({ code: 'FORBIDDEN' })
  expect(
    plan({ expectedEncounterVersion: 3, encounterId, movementDecisionPending: true, role: 'OWNER' })
  ).toMatchObject({ code: 'UNAVAILABLE', message: 'Waiting on a movement decision.' })
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

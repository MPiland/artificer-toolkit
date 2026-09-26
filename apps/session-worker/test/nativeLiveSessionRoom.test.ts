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
    sceneEncounterBound: false,
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
    sceneSnapshot: scene,
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
    ).toEqual(first)
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
      base.capture.sceneSnapshot = scene
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
    ).toEqual(moveCommitted)
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
    ).toEqual(undoCommitted)
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
it('rejects encounter-bound token movement before committing durable state', async () => {
  const value = movementScene(crypto.randomUUID())
  const base = await fixture(value.scene)
  base.capture.sceneEncounterBound = true
  await synchronizeScene(base, value.scene)
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
  await expect(
    runInDurableObject(base.stub, (_instance, state) => ({
      authority: state.storage.sql
        .exec<{ published_sequence: number; sequence: number }>(
          'SELECT published_sequence, sequence FROM durable_session_authority WHERE id = 1'
        )
        .one(),
      outboxCount: state.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
        .one().count
    }))
  ).resolves.toEqual({ authority: { published_sequence: 0, sequence: 0 }, outboxCount: 0 })
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

it('preserves drag path and rejected-sample sequence through hibernation', async () => {
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
  await evictDurableObject(base.stub)
  base.messages.length = 0
  await synchronizeScene(base, value.scene)
  const frames = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    const sent = vi.spyOn(socket, 'send')
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
  await evictDurableObject(base.stub)
  base.messages.length = 0
  await synchronizeScene(base, value.scene)
  const resumed = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    const sent = vi.spyOn(socket, 'send')
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
  await control({
    campaignId: base.capture.campaignId,
    operation: {
      type: 'EVICT_USER',
      userId: base.userId,
      membershipEpoch: base.capture.origin.membershipEpoch
    }
  })
  expect(
    await runInDurableObject(
      base.stub,
      (_instance, state) =>
        state.storage.sql
          .exec<{ count: number }>('SELECT COUNT(*) AS count FROM native_socket_transients')
          .one().count
    )
  ).toBe(0)
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
      const captureCalls = vi.mocked(globalThis.fetch).mock.calls.length
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
      expect(globalThis.fetch).toHaveBeenCalledTimes(captureCalls + (expired ? 0 : 1))
      return sent.mock.calls.map(([frame]) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(frame)))
      )
    })
    expect(frames).toEqual(expired ? [{ type: 'AUTHENTICATION_REQUIRED' }] : [])
  }
)

it('coalesces queued pointer samples while an authoritative capture is pending', async () => {
  const base = await fixture()
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
  const captures = await runInDurableObject(base.stub, async (instance, state) => {
    const socket = state.getWebSockets()[0]!
    let release: (() => void) | undefined
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const fetch = vi
      .mocked(globalThis.fetch)
      .mockReset()
      .mockImplementation(async () => Response.json(base.capture))
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(Response.json(base.capture))
          markStarted?.()
        })
    )
    const sceneId = crypto.randomUUID()
    const message = (sequence: number) =>
      JSON.stringify({
        type: 'TRANSIENT',
        envelope: {
          audience: 'TABLE',
          kind: 'POINTER_PREVIEW',
          sceneId,
          baselineVersion: 0,
          sequence,
          position: { x: sequence, y: 10 }
        }
      })
    const first = instance.webSocketMessage(socket, message(1))
    await started
    const queued = Array.from({ length: 40 }, (_, index) =>
      instance.webSocketMessage(socket, message(index + 2))
    )
    release?.()
    await Promise.all([first, ...queued])
    return fetch.mock.calls.length
  })
  // One in-flight sample and the latest queued sample each use one current authority capture.
  expect(captures).toBe(2)
})

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
      const captureCalls = vi.mocked(globalThis.fetch).mock.calls.length
      await instance.webSocketMessage(socket, preview)
      expect(globalThis.fetch).toHaveBeenCalledTimes(captureCalls + 2)
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

it('asks Convex which planner owns a decision and follows a NATIVE route', async () => {
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
      expect(await request.json()).toMatchObject({ encounterId, occurrenceId })
      return Response.json({ route: 'NATIVE' })
    }
    if (pathname === '/live-sessions/encounter-command') {
      calls.push(pathname)
      return Response.json(encounterResult(base.capture.campaignId, encounterId))
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
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId,
          commandId,
          expectedVersion: 3,
          occurrenceId,
          expectedOccurrenceVersion: 1,
          correlationId: null,
          resolution: { kind: 'SYSTEM_ROLL', requestId: 'roll-1', rollId: crypto.randomUUID() }
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
  expect(calls).toEqual(['/live-sessions/encounter-route', '/live-sessions/encounter-command'])
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

it('reuses a recent authority capture for pointer samples on the same Scene version', async () => {
  const { scene } = doorScene(crypto.randomUUID())
  const base = await fixture(scene)
  base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
  await vi.waitFor(() =>
    expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
  )
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
    const cached = captureCalls() - before
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2_001)
    await instance.webSocketMessage(socket, pointer(6))
    return { cached, expired: captureCalls() - before }
  })
  expect(captures).toEqual({ cached: 1, expired: 2 })
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
    sceneEncounterBound: false,
    actor: { role: input.role, userId: crypto.randomUUID() },
    latestUnmatchedMove: () => null
  })
}

it.each([
  { role: 'PLAYER' as const, from: 'CLOSED' as const, to: 'OPEN' as const, outcome: 'ACCEPTED' },
  { role: 'PLAYER' as const, from: 'OPEN' as const, to: 'CLOSED' as const, outcome: 'ACCEPTED' },
  { role: 'PLAYER' as const, from: 'CLOSED' as const, to: 'LOCKED' as const, outcome: 'FORBIDDEN' },
  { role: 'PLAYER' as const, from: 'LOCKED' as const, to: 'OPEN' as const, outcome: 'FORBIDDEN' },
  { role: 'OWNER' as const, from: 'CLOSED' as const, to: 'LOCKED' as const, outcome: 'ACCEPTED' },
  { role: 'OWNER' as const, from: 'LOCKED' as const, to: 'OPEN' as const, outcome: 'ACCEPTED' }
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
      sceneEncounterBound: false,
      actor: { role: 'OWNER', userId: crypto.randomUUID() },
      latestUnmatchedMove: () => null
    })
  expect(plan('OFF')).toMatchObject({ kind: 'ACCEPTED' })
  expect(plan('SHARED_PARTY')).toMatchObject({ code: 'UNAVAILABLE' })
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

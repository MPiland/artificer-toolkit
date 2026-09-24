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

import { DurableCommandJournal } from '../src/durableCommandJournal.js'
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

async function fixture(scene: CampaignSceneStateDto | null = null) {
  const campaignId = scene?.campaignId ?? crypto.randomUUID()
  const authorityEpoch = crypto.randomUUID()
  const activationFingerprint = 'a'.repeat(64)
  const userId = crypto.randomUUID()
  const playerId = crypto.randomUUID()
  const issuedAt = Math.floor(Date.now() / 1_000)
  const ticket = await new SignJWT({
    authorityEpoch,
    campaignId,
    role: 'OWNER',
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60)
    .sign(new TextEncoder().encode(secret))
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
  const ticket = await new SignJWT({
    authorityEpoch: base.authorityEpoch,
    campaignId: base.capture.campaignId,
    role: 'PLAYER',
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setSubject(base.playerId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(base.issuedAt)
    .setExpirationTime(base.issuedAt + 60)
    .sign(new TextEncoder().encode(secret))
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
    player.socket.send(JSON.stringify(doorCommand(value.scene, value.doorId, playerCommandId)))
    await vi.waitFor(() =>
      expect(player.messages).toContainEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
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
  await expect(closed).resolves.toMatchObject({ code: 1008, reason: 'The Campaign live table closed.' })
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

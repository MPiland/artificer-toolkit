import type { AddressInfo } from 'node:net'

import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_TICKET_VERSION,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  applySceneEvent,
  materializeEncounterScene,
  type EncounterSceneState
} from '@artificer-toolkit/shared/vtt'
import { SignJWT } from 'jose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket, type RawData } from 'ws'

import { createSessionHostServer, getSessionHostHealth } from './app.js'
import {
  DEFAULT_SESSION_HOST_ALLOWED_ORIGINS,
  DEFAULT_SESSION_HOST_PORT,
  resolveSessionHostAllowedOrigins,
  resolveSessionHostPort,
  resolveSessionHostTicketSecret
} from './config.js'
import type { LiveSessionRoomDependencies } from './dependencies.js'

const TICKET_SECRET = 'local-session-host-test-secret-with-32-bytes'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const CAMPAIGN_ID = '00000000-0000-4000-8000-000000000002'
const SESSION_ID = '00000000-0000-4000-8000-000000000003'
const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000004'
const SCENE_ID = '00000000-0000-4000-8000-000000000005'
const TOKEN_ID = '00000000-0000-4000-8000-000000000006'
const PLAYER_ID = '00000000-0000-4000-8000-000000000007'
const FOGGED_PLAYER_ID = '00000000-0000-4000-8000-000000000011'
const ANNOTATION_ID = '00000000-0000-4000-8000-000000000008'
const INITIAL_ANNOTATION_ID = '00000000-0000-4000-8000-000000000009'
const HIDDEN_TOKEN_ID = '00000000-0000-4000-8000-000000000010'
const STALE_OWNER_ID = '00000000-0000-4000-8000-000000000012'
const REMOVED_PLAYER_ID = '00000000-0000-4000-8000-000000000013'

const sockets: WebSocket[] = []

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.terminate()
})

function sceneState(): EncounterSceneState {
  return materializeEncounterScene(
    {
      annotations: [
        {
          id: INITIAL_ANNOTATION_ID,
          position: { x: 1, y: 1 },
          text: 'Existing GM note',
          visibility: 'GM_ONLY'
        }
      ],
      barriers: [],
      campaignId: CAMPAIGN_ID,
      darknessZones: [],
      fogMode: 'PER_PLAYER',
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' },
      id: SCENE_ID,
      lights: [],
      map: { assetId: SCENE_ID, height: 100, tileManifestAssetId: null, width: 100 },
      name: 'Live scene',
      tokens: [
        {
          actorId: null,
          assetId: null,
          controlledByUserIds: [PLAYER_ID],
          height: 1,
          hidden: false,
          id: TOKEN_ID,
          label: 'Player token',
          locked: false,
          position: { x: 10, y: 10 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        },
        {
          actorId: null,
          assetId: null,
          controlledByUserIds: [],
          height: 1,
          hidden: true,
          id: HIDDEN_TOKEN_ID,
          label: 'Hidden GM token',
          locked: false,
          position: { x: 20, y: 20 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        }
      ],
      version: 1,
      visionRevealMode: 'ON_DRAG'
    },
    ENCOUNTER_ID,
    SCENE_ID
  )
}

function dependencies(
  overrides: Partial<LiveSessionRoomDependencies> = {}
): LiveSessionRoomDependencies {
  return {
    claimAuthority: async () => undefined,
    execute: async () => {
      throw new Error('Not used by this bootstrap test.')
    },
    loadSnapshot: async () => ({
      aggregateVersions: [],
      characterRuleSnapshots: [],
      characterVisions: [],
      encounterCharacterBindings: [],
      encounterRuleSnapshots: [],
      sceneStates: []
    }),
    releaseAuthority: async () => undefined,
    renewAuthority: async () => [],
    ...overrides
  }
}

async function issueTicket(options: {
  jti: string
  role?: 'OWNER' | 'PLAYER'
  userId?: string
}): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1_000)
  return new SignJWT({
    campaignId: CAMPAIGN_ID,
    role: options.role ?? 'OWNER',
    sessionId: SESSION_ID,
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setExpirationTime(issuedAt + 60)
    .setIssuedAt(issuedAt)
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setJti(options.jti)
    .setSubject(options.userId ?? USER_ID)
    .sign(new TextEncoder().encode(TICKET_SECRET))
}

function endpoint(port: number): string {
  return `ws://127.0.0.1:${port}/live-session/${SESSION_ID}`
}

function parseMessage(raw: RawData, binary: boolean): LiveSessionWebSocketServerMessageDto {
  if (binary) throw new Error('Expected a text WebSocket message.')
  return liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(raw.toString()) as unknown)
}

function waitForMessage(
  socket: WebSocket,
  predicate: (message: LiveSessionWebSocketServerMessageDto) => boolean,
  timeoutMs = 2_000
): Promise<LiveSessionWebSocketServerMessageDto> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for a live-session message.'))
    }, timeoutMs)
    const onMessage = (raw: RawData, binary: boolean) => {
      try {
        const message = parseMessage(raw, binary)
        if (!predicate(message)) return
        cleanup()
        resolve(message)
      } catch (error) {
        cleanup()
        reject(error)
      }
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', onMessage)
    }
    socket.on('message', onMessage)
  })
}

function waitForClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('close', onClose)
      reject(new Error('Timed out waiting for a live-session socket to close.'))
    }, 2_000)
    const onClose = (code: number) => {
      clearTimeout(timeout)
      resolve(code)
    }
    socket.once('close', onClose)
  })
}

async function expectNoMessage(
  socket: WebSocket,
  timeoutMs = 100,
  ignoredTypes: readonly string[] = []
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, timeoutMs)
    const onMessage = (raw: RawData, binary: boolean) => {
      if (
        !binary &&
        ignoredTypes.includes((JSON.parse(raw.toString()) as { type?: string }).type ?? '')
      ) {
        return
      }
      cleanup()
      reject(new Error(`Unexpected live-session message: ${binary ? '[binary]' : raw.toString()}`))
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', onMessage)
    }
    socket.on('message', onMessage)
  })
}

async function connect(port: number, ticket: string, origin = 'http://localhost:3000') {
  const socket = new WebSocket(
    endpoint(port),
    [LIVE_SESSION_WEBSOCKET_PROTOCOL, `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`],
    {
      headers: { Origin: origin }
    }
  )
  sockets.push(socket)
  const ready = waitForMessage(socket, (message) => message.type === 'READY')
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  return { ready: await ready, socket }
}

function send(socket: WebSocket, message: LiveSessionWebSocketClientMessageDto): void {
  socket.send(JSON.stringify(message))
}

async function waitFor(condition: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for a test condition.')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('native local session host', () => {
  it('uses explicit local configuration and a stable health payload', () => {
    expect(resolveSessionHostPort(undefined)).toBe(DEFAULT_SESSION_HOST_PORT)
    expect(resolveSessionHostPort('4321')).toBe(4321)
    expect(() => resolveSessionHostPort('0')).toThrow('PORT must be an integer')
    expect(resolveSessionHostAllowedOrigins(undefined)).toEqual(
      DEFAULT_SESSION_HOST_ALLOWED_ORIGINS
    )
    expect(
      resolveSessionHostAllowedOrigins('https://app.example.com,http://localhost:3000')
    ).toEqual(['https://app.example.com', 'http://localhost:3000'])
    expect(() => resolveSessionHostAllowedOrigins('https://app.example.com/')).toThrow(
      'absolute HTTP origins'
    )
    expect(resolveSessionHostTicketSecret(TICKET_SECRET)).toBe(TICKET_SECRET)
    expect(() => resolveSessionHostTicketSecret('too-short')).toThrow('at least 32 bytes')
    expect(getSessionHostHealth()).toEqual({ service: 'artificer-session-host', status: 'ok' })
  })

  it('hydrates one runtime for multiple ticket-authenticated native WebSocket clients', async () => {
    const claimAuthority = vi.fn(async () => undefined)
    const loadSnapshot = vi.fn(async () => ({
      aggregateVersions: [
        { aggregateId: ENCOUNTER_ID, aggregateKind: 'ENCOUNTER' as const, version: 7 }
      ],
      characterRuleSnapshots: [],
      characterVisions: [],
      encounterCharacterBindings: [],
      encounterRuleSnapshots: [],
      sceneStates: []
    }))
    const releaseAuthority = vi.fn(async () => undefined)
    const server = createSessionHostServer(
      dependencies({ claimAuthority, loadSnapshot, releaseAuthority }),
      { ticketSecret: TICKET_SECRET }
    )
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    try {
      const clients = await Promise.all(
        Array.from({ length: 6 }, async (_, index) =>
          connect(
            port,
            await issueTicket({
              jti: `00000000-0000-4000-8001-${String(index + 101).padStart(12, '0')}`
            })
          )
        )
      )
      const first = clients[0]!
      expect(first.ready).toEqual({
        aggregateVersions: [{ aggregateId: ENCOUNTER_ID, aggregateKind: 'ENCOUNTER', version: 7 }],
        campaignId: CAMPAIGN_ID,
        deliverySequence: 0,
        sceneSnapshots: [],
        sessionId: SESSION_ID,
        type: 'READY'
      })
      expect(clients.map((client) => client.ready)).toEqual(Array(6).fill(first.ready))
      expect(claimAuthority).toHaveBeenCalledTimes(1)
      expect(loadSnapshot).toHaveBeenCalledTimes(1)

      const health = await fetch(`http://127.0.0.1:${port}/health`)
      expect(health.status).toBe(200)
      await expect(health.json()).resolves.toEqual(getSessionHostHealth())
    } finally {
      await server.gracefullyShutdown(false)
    }
    expect(releaseAuthority).toHaveBeenCalledTimes(1)
  })

  it('projects scenes privately across six clients and recovers a reconnected player', async () => {
    let state = sceneState()
    const execute: LiveSessionRoomDependencies['execute'] = async (_userId, _options, command) => {
      if (command.aggregateKind !== 'SCENE' || command.command.type !== 'UPSERT_SCENE_ANNOTATION') {
        throw new Error('Expected an annotation scene command.')
      }
      const delta = { annotation: command.command.annotation, kind: 'ANNOTATION_UPSERTED' as const }
      state = applySceneEvent(state, {
        actorUserId: USER_ID,
        commandId: command.command.commandId,
        delta,
        sceneId: SCENE_ID,
        version: state.version + 1
      })
      return {
        aggregateId: SCENE_ID,
        aggregateKind: 'SCENE',
        commandId: command.command.commandId,
        replayed: false,
        response: {
          commandId: command.command.commandId,
          delta,
          replayed: false,
          sceneId: SCENE_ID,
          version: state.version
        },
        state,
        version: state.version
      }
    }
    const server = createSessionHostServer(
      dependencies({
        execute,
        loadSnapshot: async () => ({
          aggregateVersions: [{ aggregateId: SCENE_ID, aggregateKind: 'SCENE', version: 0 }],
          characterRuleSnapshots: [],
          characterVisions: [],
          encounterCharacterBindings: [],
          encounterRuleSnapshots: [],
          sceneStates: [state]
        })
      }),
      { ticketSecret: TICKET_SECRET }
    )
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    try {
      const owner = await connect(
        port,
        await issueTicket({ jti: '00000000-0000-4000-8000-000000000103' })
      )
      const players = await Promise.all(
        Array.from({ length: 5 }, async (_, index) =>
          connect(
            port,
            await issueTicket({
              jti: `00000000-0000-4000-8001-${String(index + 201).padStart(12, '0')}`,
              role: 'PLAYER',
              userId: PLAYER_ID
            })
          )
        )
      )
      const player = players[0]!
      expect(players).toHaveLength(5)
      for (const connected of players) {
        if (connected.ready.type !== 'READY') throw new Error('Expected a ready message.')
        expect(connected.ready.sceneSnapshots[0]?.scene.annotations).toEqual([])
      }

      const commandId = '00000000-0000-4000-8000-000000000105'
      const ownerAccepted = waitForMessage(
        owner.socket,
        (message) => message.type === 'COMMAND_ACCEPTED'
      )
      const ownerCommitted = waitForMessage(
        owner.socket,
        (message) => message.type === 'COMMAND_COMMITTED'
      )
      const playerCommitted = players.map((connected) =>
        waitForMessage(connected.socket, (message) => message.type === 'COMMAND_COMMITTED')
      )
      send(owner.socket, {
        command: {
          aggregateKind: 'SCENE',
          command: {
            annotation: {
              id: ANNOTATION_ID,
              position: { x: 2, y: 2 },
              text: 'Private note',
              visibility: 'GM_ONLY'
            },
            commandId,
            encounterId: ENCOUNTER_ID,
            expectedSceneVersion: 0,
            sceneId: SCENE_ID,
            type: 'UPSERT_SCENE_ANNOTATION'
          }
        },
        type: 'COMMAND'
      })
      await expect(ownerAccepted).resolves.toMatchObject({
        acceptedSequence: 1,
        commandId,
        type: 'COMMAND_ACCEPTED'
      })
      await expect(ownerCommitted).resolves.toMatchObject({
        aggregateKind: 'SCENE',
        deliverySequence: 1,
        delta: { annotation: { id: ANNOTATION_ID }, kind: 'ANNOTATION_UPSERTED' },
        type: 'COMMAND_COMMITTED'
      })
      for (const committed of await Promise.all(playerCommitted)) {
        expect(committed).toMatchObject({
          aggregateKind: 'SCENE',
          delta: null,
          snapshot: { scene: { annotations: [], version: 1 } },
          type: 'COMMAND_COMMITTED'
        })
      }

      const transient = [owner, ...players.slice(1)].map((connected) =>
        waitForMessage(connected.socket, (message) => message.type === 'TRANSIENT')
      )
      send(player.socket, {
        envelope: {
          baselineVersion: 1,
          kind: 'TOKEN_DRAG_PREVIEW',
          position: { x: 20, y: 20 },
          sceneId: SCENE_ID,
          sequence: 1,
          tokenId: TOKEN_ID
        },
        type: 'TRANSIENT'
      })
      for (const message of await Promise.all(transient)) {
        expect(message).toMatchObject({
          message: { userId: PLAYER_ID },
          type: 'TRANSIENT'
        })
      }

      players[4]!.socket.close(1000, 'reconnect test')
      const recovered = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8001-000000000299',
          role: 'PLAYER',
          userId: PLAYER_ID
        })
      )
      expect(recovered.ready).toMatchObject({
        aggregateVersions: [{ aggregateId: SCENE_ID, aggregateKind: 'SCENE', version: 1 }],
        sceneSnapshots: [{ scene: { annotations: [], id: SCENE_ID, version: 1 } }],
        type: 'READY'
      })
    } finally {
      await server.gracefullyShutdown(false)
    }
  })

  it('keeps owner hidden-token drag previews away from players', async () => {
    const state = sceneState()
    state.barriers = [
      {
        a: { x: 50, y: 0 },
        b: { x: 50, y: 100 },
        blocksLight: true,
        blocksMovement: true,
        id: '00000000-0000-4000-8000-000000000114',
        kind: 'WALL'
      }
    ]
    state.fogLayers = [{ chunks: [], height: 8, ownerUserId: FOGGED_PLAYER_ID, width: 8 }]
    const server = createSessionHostServer(
      dependencies({
        loadSnapshot: async () => ({
          aggregateVersions: [
            { aggregateId: SCENE_ID, aggregateKind: 'SCENE', version: state.version }
          ],
          characterRuleSnapshots: [],
          characterVisions: [],
          encounterCharacterBindings: [],
          encounterRuleSnapshots: [],
          sceneStates: [state]
        })
      }),
      { ticketSecret: TICKET_SECRET }
    )
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    try {
      const origin = await connect(
        port,
        await issueTicket({ jti: '00000000-0000-4000-8000-000000000110' })
      )
      const otherOwner = await connect(
        port,
        await issueTicket({ jti: '00000000-0000-4000-8000-000000000111' })
      )
      const player = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8000-000000000112',
          role: 'PLAYER',
          userId: PLAYER_ID
        })
      )
      const foggedPlayer = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8000-000000000113',
          role: 'PLAYER',
          userId: FOGGED_PLAYER_ID
        })
      )
      const playerTransients: LiveSessionWebSocketServerMessageDto[] = []
      const recordPlayerTransient = (raw: RawData, binary: boolean) => {
        const message = parseMessage(raw, binary)
        if (message.type === 'TRANSIENT') playerTransients.push(message)
      }
      player.socket.on('message', recordPlayerTransient)
      try {
        const hiddenPreview = waitForMessage(
          otherOwner.socket,
          (message) =>
            message.type === 'TRANSIENT' &&
            message.message.envelope.kind === 'TOKEN_DRAG_PREVIEW' &&
            message.message.envelope.tokenId === HIDDEN_TOKEN_ID
        )
        const pointerPreview = waitForMessage(
          player.socket,
          (message) =>
            message.type === 'TRANSIENT' && message.message.envelope.kind === 'POINTER_PREVIEW'
        )
        const foggedPointerPreview = waitForMessage(
          foggedPlayer.socket,
          (message) =>
            message.type === 'TRANSIENT' && message.message.envelope.kind === 'POINTER_PREVIEW'
        )
        send(origin.socket, {
          envelope: {
            baselineVersion: state.version,
            kind: 'TOKEN_DRAG_PREVIEW',
            position: { x: 25, y: 25 },
            sceneId: SCENE_ID,
            sequence: 1,
            tokenId: HIDDEN_TOKEN_ID
          },
          type: 'TRANSIENT'
        })
        send(origin.socket, {
          envelope: {
            baselineVersion: state.version,
            kind: 'POINTER_PREVIEW',
            position: { x: 25, y: 25 },
            sceneId: SCENE_ID,
            sequence: 1
          },
          type: 'TRANSIENT'
        })
        await expect(hiddenPreview).resolves.toMatchObject({
          message: { envelope: { tokenId: HIDDEN_TOKEN_ID }, userId: USER_ID },
          type: 'TRANSIENT'
        })
        await expect(Promise.all([pointerPreview, foggedPointerPreview])).resolves.toEqual([
          expect.objectContaining({
            message: {
              envelope: expect.objectContaining({ kind: 'POINTER_PREVIEW' }),
              userId: USER_ID
            },
            type: 'TRANSIENT'
          }),
          expect.objectContaining({
            message: {
              envelope: expect.objectContaining({ kind: 'POINTER_PREVIEW' }),
              userId: USER_ID
            },
            type: 'TRANSIENT'
          })
        ])
        expect(playerTransients).toEqual([
          expect.objectContaining({
            message: expect.objectContaining({
              envelope: expect.objectContaining({ kind: 'POINTER_PREVIEW' })
            }),
            type: 'TRANSIENT'
          })
        ])

        const controlledPreview = waitForMessage(
          player.socket,
          (message) =>
            message.type === 'TRANSIENT' &&
            message.message.envelope.kind === 'TOKEN_DRAG_PREVIEW' &&
            message.message.envelope.tokenId === TOKEN_ID
        )
        const gmPreview = waitForMessage(
          otherOwner.socket,
          (message) =>
            message.type === 'TRANSIENT' &&
            message.message.envelope.kind === 'TOKEN_DRAG_PREVIEW' &&
            message.message.envelope.tokenId === TOKEN_ID
        )
        const foggedPreview = expectNoMessage(foggedPlayer.socket)
        send(origin.socket, {
          envelope: {
            baselineVersion: state.version,
            kind: 'TOKEN_DRAG_PREVIEW',
            position: { x: 30, y: 30 },
            sceneId: SCENE_ID,
            sequence: 2,
            tokenId: TOKEN_ID
          },
          type: 'TRANSIENT'
        })
        await expect(Promise.all([controlledPreview, gmPreview])).resolves.toHaveLength(2)
        await foggedPreview

        const blockedPlayerPreview = expectNoMessage(player.socket)
        const blockedGmPreview = expectNoMessage(otherOwner.socket)
        send(origin.socket, {
          envelope: {
            baselineVersion: state.version,
            kind: 'TOKEN_DRAG_PREVIEW',
            position: { x: 70, y: 30 },
            sceneId: SCENE_ID,
            sequence: 3,
            tokenId: TOKEN_ID
          },
          type: 'TRANSIENT'
        })
        await Promise.all([blockedPlayerPreview, blockedGmPreview])

        const ownerFogPreview = waitForMessage(
          otherOwner.socket,
          (message) =>
            message.type === 'TRANSIENT' && message.message.envelope.kind === 'FOG_AREA_PREVIEW'
        )
        const foggedAreaPreview = waitForMessage(
          foggedPlayer.socket,
          (message) =>
            message.type === 'TRANSIENT' && message.message.envelope.kind === 'FOG_AREA_PREVIEW'
        )
        const noOtherPlayerFogPreview = expectNoMessage(player.socket)
        send(origin.socket, {
          envelope: {
            baselineVersion: state.version,
            explored: true,
            kind: 'FOG_AREA_PREVIEW',
            ownerUserId: FOGGED_PLAYER_ID,
            rectangle: { a: { x: 10, y: 10 }, b: { x: 40, y: 40 } },
            sceneId: SCENE_ID,
            sequence: 1
          },
          type: 'TRANSIENT'
        })
        await expect(Promise.all([ownerFogPreview, foggedAreaPreview])).resolves.toHaveLength(2)
        await noOtherPlayerFogPreview
      } finally {
        player.socket.off('message', recordPlayerTransient)
      }
    } finally {
      await server.gracefullyShutdown(false)
    }
  })

  it('rotates away from a removed first connector and revokes stale-role sockets', async () => {
    const state = sceneState()
    let changedMemberships = false
    const renewAuthority = vi.fn(async (renewingUserId: string) => {
      if (changedMemberships && renewingUserId === REMOVED_PLAYER_ID) {
        throw new Error('Campaign membership changed.')
      }
      return changedMemberships
        ? [
            { role: 'OWNER' as const, userId: USER_ID },
            { role: 'PLAYER' as const, userId: STALE_OWNER_ID },
            { role: 'PLAYER' as const, userId: PLAYER_ID }
          ]
        : [
            { role: 'OWNER' as const, userId: USER_ID },
            { role: 'OWNER' as const, userId: STALE_OWNER_ID },
            { role: 'PLAYER' as const, userId: REMOVED_PLAYER_ID },
            { role: 'PLAYER' as const, userId: PLAYER_ID }
          ]
    })
    const server = createSessionHostServer(
      dependencies({
        loadSnapshot: async () => ({
          aggregateVersions: [
            { aggregateId: SCENE_ID, aggregateKind: 'SCENE', version: state.version }
          ],
          characterRuleSnapshots: [],
          characterVisions: [],
          encounterCharacterBindings: [],
          encounterRuleSnapshots: [],
          sceneStates: [state]
        }),
        renewAuthority
      }),
      { authorityRenewalMs: 10, ticketSecret: TICKET_SECRET }
    )
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    try {
      const removedPlayer = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8000-000000000132',
          role: 'PLAYER',
          userId: REMOVED_PLAYER_ID
        })
      )
      const owner = await connect(
        port,
        await issueTicket({ jti: '00000000-0000-4000-8000-000000000130' })
      )
      const staleOwner = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8000-000000000131',
          userId: STALE_OWNER_ID
        })
      )
      const retainedPlayer = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8000-000000000133',
          role: 'PLAYER',
          userId: PLAYER_ID
        })
      )
      const renewalsBeforeChange = renewAuthority.mock.calls.length
      changedMemberships = true
      const staleOwnerRejected = waitForMessage(
        staleOwner.socket,
        (message) => message.type === 'COMMAND_REJECTED'
      )
      const removedPlayerRejected = waitForMessage(
        removedPlayer.socket,
        (message) => message.type === 'COMMAND_REJECTED'
      )
      const staleOwnerClosed = waitForClose(staleOwner.socket)
      const removedPlayerClosed = waitForClose(removedPlayer.socket)
      await waitFor(() => renewAuthority.mock.calls.length > renewalsBeforeChange)
      for (const rejection of await Promise.all([staleOwnerRejected, removedPlayerRejected])) {
        expect(rejection).toEqual({
          code: 'UNAUTHORIZED',
          commandId: null,
          message: 'Campaign membership changed. Reconnect with a new ticket.',
          type: 'COMMAND_REJECTED'
        })
      }
      await expect(Promise.all([staleOwnerClosed, removedPlayerClosed])).resolves.toEqual([
        1008, 1008
      ])
      expect(
        renewAuthority.mock.calls
          .slice(renewalsBeforeChange, renewalsBeforeChange + 2)
          .map(([renewingUserId]) => renewingUserId)
      ).toEqual([REMOVED_PLAYER_ID, USER_ID])

      const retainedPreview = waitForMessage(
        retainedPlayer.socket,
        (message) => message.type === 'TRANSIENT'
      )
      send(owner.socket, {
        envelope: {
          baselineVersion: state.version,
          kind: 'POINTER_PREVIEW',
          position: { x: 25, y: 25 },
          sceneId: SCENE_ID,
          sequence: 1
        },
        type: 'TRANSIENT'
      })
      await expect(retainedPreview).resolves.toMatchObject({
        message: { userId: USER_ID },
        type: 'TRANSIENT'
      })
    } finally {
      await server.gracefullyShutdown(false)
    }
  })

  it('resumes command receipts only for their original user', async () => {
    const state = sceneState()
    const committedState = { ...state, version: state.version + 1 }
    const commandId = '00000000-0000-4000-8000-000000000114'
    const server = createSessionHostServer(
      dependencies({
        execute: async (_userId, _options, command) => {
          if (command.aggregateKind !== 'SCENE') throw new Error('Expected Scene command.')
          return {
            aggregateId: SCENE_ID,
            aggregateKind: 'SCENE',
            commandId: command.command.commandId,
            replayed: false,
            response: null,
            state: committedState,
            version: committedState.version
          }
        },
        loadSnapshot: async () => ({
          aggregateVersions: [
            { aggregateId: SCENE_ID, aggregateKind: 'SCENE', version: state.version }
          ],
          characterRuleSnapshots: [],
          characterVisions: [],
          encounterCharacterBindings: [],
          encounterRuleSnapshots: [],
          sceneStates: [state]
        })
      }),
      { ticketSecret: TICKET_SECRET }
    )
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    try {
      const owner = await connect(
        port,
        await issueTicket({ jti: '00000000-0000-4000-8000-000000000115' })
      )
      const otherPlayer = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8000-000000000116',
          role: 'PLAYER',
          userId: FOGGED_PLAYER_ID
        })
      )
      const ownerCommitted = waitForMessage(
        owner.socket,
        (message) => message.type === 'COMMAND_COMMITTED' && message.originCommandId === commandId
      )
      const observedBroadcast = waitForMessage(
        otherPlayer.socket,
        (message) => message.type === 'COMMAND_COMMITTED' && message.originCommandId === commandId
      )
      send(owner.socket, {
        command: {
          aggregateKind: 'SCENE',
          command: {
            commandId,
            encounterId: ENCOUNTER_ID,
            expectedSceneVersion: state.version,
            path: [
              { x: state.tokens[0]!.position.x, y: state.tokens[0]!.position.y },
              { x: 15, y: 15 }
            ],
            sceneId: SCENE_ID,
            tokenId: TOKEN_ID,
            type: 'MOVE_SCENE_TOKEN'
          }
        },
        type: 'COMMAND'
      })
      await expect(ownerCommitted).resolves.toMatchObject({ originCommandId: commandId })
      await expect(observedBroadcast).resolves.toMatchObject({ originCommandId: commandId })

      const otherReady = waitForMessage(otherPlayer.socket, (message) => message.type === 'READY')
      const otherReceipt = expectNoMessage(otherPlayer.socket, 100, ['READY'])
      send(otherPlayer.socket, {
        lastSeenDeliverySequence: 0,
        pendingCommandIds: [commandId],
        type: 'RESUME'
      })
      await expect(otherReady).resolves.toMatchObject({ type: 'READY' })
      await otherReceipt

      const ownerReconnect = await connect(
        port,
        await issueTicket({ jti: '00000000-0000-4000-8000-000000000117' })
      )
      const replay = waitForMessage(
        ownerReconnect.socket,
        (message) => message.type === 'COMMAND_COMMITTED' && message.originCommandId === commandId
      )
      send(ownerReconnect.socket, {
        lastSeenDeliverySequence: 0,
        pendingCommandIds: [commandId],
        type: 'RESUME'
      })
      await expect(replay).resolves.toMatchObject({ originCommandId: commandId, replayed: true })
    } finally {
      await server.gracefullyShutdown(false)
    }
  })

  it('attaches a scene once and broadcasts a private full snapshot', async () => {
    const state = sceneState()
    const execute: LiveSessionRoomDependencies['execute'] = async (_userId, _options, command) => {
      if (command.aggregateKind !== 'SCENE' || command.command.type !== 'ATTACH_SCENE') {
        throw new Error('Expected an attach scene command.')
      }
      return {
        aggregateId: SCENE_ID,
        aggregateKind: 'SCENE',
        commandId: command.command.commandId,
        replayed: false,
        response: null,
        state,
        version: state.version
      }
    }
    const server = createSessionHostServer(
      dependencies({
        execute,
        loadSnapshot: async () => ({
          aggregateVersions: [],
          characterRuleSnapshots: [],
          characterVisions: [],
          encounterCharacterBindings: [],
          encounterRuleSnapshots: [],
          sceneStates: []
        })
      }),
      { ticketSecret: TICKET_SECRET }
    )
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    try {
      const owner = await connect(
        port,
        await issueTicket({ jti: '00000000-0000-4000-8000-000000000120' })
      )
      const player = await connect(
        port,
        await issueTicket({
          jti: '00000000-0000-4000-8000-000000000121',
          role: 'PLAYER',
          userId: PLAYER_ID
        })
      )
      expect(owner.ready).toMatchObject({ sceneSnapshots: [], type: 'READY' })
      expect(player.ready).toMatchObject({ sceneSnapshots: [], type: 'READY' })

      const commandId = '00000000-0000-4000-8000-000000000122'
      const ownerAccepted = waitForMessage(
        owner.socket,
        (message) => message.type === 'COMMAND_ACCEPTED'
      )
      const ownerCommitted = waitForMessage(
        owner.socket,
        (message) => message.type === 'COMMAND_COMMITTED'
      )
      const playerCommitted = waitForMessage(
        player.socket,
        (message) => message.type === 'COMMAND_COMMITTED'
      )
      send(owner.socket, {
        command: {
          aggregateKind: 'SCENE',
          command: {
            commandId,
            encounterId: ENCOUNTER_ID,
            sceneDefinitionId: SCENE_ID,
            type: 'ATTACH_SCENE'
          }
        },
        type: 'COMMAND'
      })

      await expect(ownerAccepted).resolves.toMatchObject({ commandId, type: 'COMMAND_ACCEPTED' })
      const ownerResult = await ownerCommitted
      const playerResult = await playerCommitted
      expect(ownerResult).toMatchObject({
        aggregateKind: 'SCENE',
        delta: null,
        snapshot: { scene: { id: SCENE_ID, version: 0 } },
        type: 'COMMAND_COMMITTED'
      })
      expect(playerResult).toMatchObject({
        aggregateKind: 'SCENE',
        delta: null,
        snapshot: { scene: { annotations: [], id: SCENE_ID, version: 0 } },
        type: 'COMMAND_COMMITTED'
      })
      if (ownerResult.aggregateKind !== 'SCENE' || playerResult.aggregateKind !== 'SCENE') {
        throw new Error('Expected Scene commit messages.')
      }
      expect(ownerResult.snapshot?.scene.annotations).toHaveLength(1)
      expect(playerResult.snapshot?.scene.annotations).toEqual([])
    } finally {
      await server.gracefullyShutdown(false)
    }
  })

  it('requires an allowed origin and rejects repeated single-use tickets', async () => {
    const server = createSessionHostServer(dependencies(), { ticketSecret: TICKET_SECRET })
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    const ticket = await issueTicket({ jti: '00000000-0000-4000-8000-000000000106' })
    try {
      await expect(
        new Promise<number>((resolve, reject) => {
          const socket = new WebSocket(endpoint(port), [
            LIVE_SESSION_WEBSOCKET_PROTOCOL,
            `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`
          ])
          sockets.push(socket)
          socket.once('unexpected-response', (_request, response) =>
            resolve(response.statusCode ?? 0)
          )
          socket.once('error', reject)
        })
      ).resolves.toBe(403)

      await expect(
        new Promise<number>((resolve, reject) => {
          const socket = new WebSocket(
            endpoint(port),
            [LIVE_SESSION_WEBSOCKET_PROTOCOL, `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`],
            { headers: { Origin: 'https://evil.example' } }
          )
          sockets.push(socket)
          socket.once('unexpected-response', (_request, response) =>
            resolve(response.statusCode ?? 0)
          )
          socket.once('error', reject)
        })
      ).resolves.toBe(403)

      const admitted = await connect(port, ticket)
      admitted.socket.close()
      await waitFor(() => admitted.socket.readyState === WebSocket.CLOSED)
      await expect(
        new Promise<number>((resolve, reject) => {
          const socket = new WebSocket(
            endpoint(port),
            [LIVE_SESSION_WEBSOCKET_PROTOCOL, `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`],
            { headers: { Origin: 'http://localhost:3000' } }
          )
          sockets.push(socket)
          socket.once('unexpected-response', (_request, response) =>
            resolve(response.statusCode ?? 0)
          )
          socket.once('error', reject)
        })
      ).resolves.toBe(409)
    } finally {
      await server.gracefullyShutdown(false)
    }
  })

  it('releases authority when a native socket disconnects during hydration', async () => {
    let finishHydration: (() => void) | undefined
    const hydrationGate = new Promise<void>((resolve) => {
      finishHydration = resolve
    })
    const claimed = vi.fn(async () => undefined)
    const released = vi.fn(async () => undefined)
    const loadSnapshot = vi.fn(async () => {
      await hydrationGate
      return {
        aggregateVersions: [],
        characterRuleSnapshots: [],
        characterVisions: [],
        encounterCharacterBindings: [],
        encounterRuleSnapshots: [],
        sceneStates: []
      }
    })
    const server = createSessionHostServer(
      dependencies({ claimAuthority: claimed, loadSnapshot, releaseAuthority: released }),
      { reconnectGraceMs: 10, ticketSecret: TICKET_SECRET }
    )
    await server.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port
    try {
      const socket = new WebSocket(
        endpoint(port),
        [
          LIVE_SESSION_WEBSOCKET_PROTOCOL,
          `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${await issueTicket({
            jti: '00000000-0000-4000-8000-000000000107'
          })}`
        ],
        { headers: { Origin: 'http://localhost:3000' } }
      )
      sockets.push(socket)
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve)
        socket.once('error', reject)
      })
      await waitFor(() => claimed.mock.calls.length === 1)
      socket.terminate()
      finishHydration?.()
      await waitFor(() => released.mock.calls.length === 1)
    } finally {
      finishHydration?.()
      await server.gracefullyShutdown(false)
    }
    expect(loadSnapshot).toHaveBeenCalledTimes(1)
  })
})

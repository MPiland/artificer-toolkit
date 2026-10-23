import {
  liveSessionCommandDtoSchema,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionTransientBroadcastDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  campaignSceneStateDtoSchema,
  sceneTransientEnvelopeDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorMessage } from '#app/lib/errorMessage'
import { validated } from '../../../test/validatedFixture'
import { tabletopGmEncounter } from './CampaignTabletop.stories.fixtures'
import { createLiveSessionConnection, resolveLiveSessionWebSocketUrl } from './liveSessionClient'

const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneId = '00000000-0000-4000-8000-000000000003'
const userId = '00000000-0000-4000-8000-000000000004'
const authorityEpoch = '00000000-0000-4000-8000-000000000006'
const commandId = '00000000-0000-4000-8000-000000000007'

const door = {
  a: { x: 10, y: 10 },
  b: { x: 20, y: 10 },
  blocksLightWhenClosed: true,
  blocksMovementWhenClosed: true,
  id: '00000000-0000-4000-8000-000000000012',
  initialState: 'CLOSED',
  kind: 'DOOR',
  openAngleDegrees: 90
} as const
const sceneState = validated(campaignSceneStateDtoSchema)({
  annotations: [],
  ambientIllumination: 'BRIGHT',
  daylight: false,
  barriers: [door],
  campaignId,
  darknessZones: [],
  definitionId: '00000000-0000-4000-8000-000000000013',
  definitionVersion: 1,
  doorStates: { [door.id]: 'CLOSED' as const },
  fogLayers: [],
  fogMode: 'SHARED_PARTY',
  grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
  id: sceneId,
  lights: [],
  map: {
    assetId: '00000000-0000-4000-8000-000000000014',
    height: 64,
    tileManifestAssetId: null,
    width: 64
  },
  measurements: [],
  name: 'Scene',
  tokens: [],
  version: 4,
  visionRevealMode: 'ON_DRAG'
})

const recipientState = {
  presentationVersion: 11,
  recipientRole: 'PLAYER',
  scene: null
}

const command = validated(liveSessionCommandDtoSchema)({
  scope: 'SCENE',
  command: {
    barrierId: door.id,
    commandId,
    expectedSceneVersion: sceneState.version,
    sceneId,
    state: 'OPEN',
    type: 'SET_SCENE_DOOR_STATE'
  }
})

const envelope = validated(sceneTransientEnvelopeDtoSchema)({
  baselineVersion: 1,
  audience: 'TABLE',
  kind: 'PING',
  position: { x: 4, y: 8 },
  sceneId,
  sequence: 2
})

class FakeSocket extends EventTarget {
  static readonly instances: FakeSocket[] = []
  closedWith: { code: number; reason: string } | null = null
  readonly sent: string[] = []
  readyState = 0

  constructor(
    readonly url: string,
    readonly protocols: string[]
  ) {
    super()
    FakeSocket.instances.push(this)
  }

  open(): void {
    this.readyState = 1
    this.dispatchEvent(new Event('open'))
  }

  receive(message: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
  }

  receiveRaw(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return
    this.closedWith = { code, reason }
    this.readyState = 3
    this.dispatchEvent(new CloseEvent('close', { code, reason }))
  }
}

afterEach(() => {
  FakeSocket.instances.length = 0
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('live-session browser connection', () => {
  it('authenticates once the host is ready and exchanges transients', async () => {
    const statuses: string[] = []
    const transients: LiveSessionTransientBroadcastDto[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({
        expiresAt: '2026-08-15T12:01:00.000Z',
        ticket: 'ticket-1'
      }),
      onError: (error) => {
        throw error
      },
      onStatus: (status) => statuses.push(status),
      onTransient: (message) => transients.push(message),
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    expect(socket.url).toBe(`wss://live.example.test/live-session/${campaignId}`)
    expect(socket.protocols).toEqual(['artificer.live-session.v1', 'artificer.ticket.ticket-1'])
    socket.open()
    await vi.waitFor(() =>
      expect(socket.sent).toEqual(['{"accessToken":"access-token","type":"AUTHENTICATE"}'])
    )
    expect(statuses).not.toContain('CONNECTED')
    expect(connection.sendTransient(envelope)).toBe(false)
    expect(socket.sent).toHaveLength(1)

    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    expect(statuses.at(-1)).toBe('CONNECTED')
    expect(connection.sendTransient(envelope)).toBe(true)
    expect(JSON.parse(socket.sent[1]!) as unknown).toEqual({ envelope, type: 'TRANSIENT' })

    const broadcast = { envelope, userId }
    socket.receive({ message: broadcast, type: 'TRANSIENT' })
    expect(transients).toEqual([broadcast])
    connection.close()
  })

  it('follows the room Encounter session only while subscribed, as the socket becomes ready', async () => {
    const sessions: unknown[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket-1' }),
      onEncounterSession: (session) => sessions.push(session),
      onError: (error) => {
        throw error
      },
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    const lastSent = () => JSON.parse(socket.sent.at(-1)!) as unknown
    connection.subscribeEncounterSession({ timeline: true })
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    expect(socket.sent.map((message) => JSON.parse(message) as unknown)).not.toContainEqual({
      timeline: true,
      type: 'SUBSCRIBE_ENCOUNTER_SESSION'
    })

    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    expect(lastSent()).toEqual({ timeline: true, type: 'SUBSCRIBE_ENCOUNTER_SESSION' })
    socket.receive({ session: { held: false }, type: 'ENCOUNTER_SESSION' })
    expect(sessions).toEqual([{ held: false }])

    connection.subscribeEncounterSession({ timeline: false })
    expect(lastSent()).toEqual({ timeline: false, type: 'SUBSCRIBE_ENCOUNTER_SESSION' })
    const sentCount = socket.sent.length
    connection.subscribeEncounterSession({ timeline: false })
    expect(socket.sent).toHaveLength(sentCount)

    connection.subscribeEncounterSession(null)
    expect(lastSent()).toEqual({ type: 'UNSUBSCRIBE_ENCOUNTER_SESSION' })
    socket.receive({ session: { held: false }, type: 'ENCOUNTER_SESSION' })
    expect(sessions).toHaveLength(1)
    connection.close()
  })

  it('follows the live Campaign summary independently and resends it after a reconnect', async () => {
    vi.useFakeTimers()
    const summaries: unknown[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket-1' }),
      onCampaignSummary: (summary) => summaries.push(summary),
      onError: () => undefined,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const first = FakeSocket.instances[0]!
    const sentTypes = (socket: FakeSocket) =>
      socket.sent.map((message) => (JSON.parse(message) as { type: string }).type)
    const summary = { characters: [], encounter: null }
    connection.subscribeCampaignSummary(true)
    first.open()
    await vi.waitFor(() => expect(first.sent).toHaveLength(1))
    expect(sentTypes(first)).not.toContain('SUBSCRIBE_CAMPAIGN_SUMMARY')

    first.receive({ campaignId, type: 'TRANSIENT_READY' })
    expect(sentTypes(first)).toContain('SUBSCRIBE_CAMPAIGN_SUMMARY')
    first.receive({ summary, type: 'CAMPAIGN_SUMMARY' })
    expect(summaries).toEqual([summary])

    first.close(1012, 'restart')
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
    const second = FakeSocket.instances[1]!
    second.open()
    await vi.waitFor(() => expect(second.sent).toHaveLength(1))
    second.receive({ campaignId, type: 'TRANSIENT_READY' })
    expect(sentTypes(second)).toContain('SUBSCRIBE_CAMPAIGN_SUMMARY')

    connection.subscribeCampaignSummary(false)
    expect(JSON.parse(second.sent.at(-1)!) as unknown).toEqual({
      type: 'UNSUBSCRIBE_CAMPAIGN_SUMMARY'
    })
    second.receive({ summary, type: 'CAMPAIGN_SUMMARY' })
    expect(summaries).toHaveLength(1)
    connection.close()
  })

  it('answers each Encounter read by its request id and fails the pending ones when the socket drops', async () => {
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket-1' }),
      onError: () => undefined,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    const read = {
      input: { encounterId: tabletopGmEncounter.id },
      kind: 'LATEST_EVIDENCE_ROLLS'
    } as const
    await expect(connection.readEncounter(read)).rejects.toThrow('Live play is not connected.')

    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    const answered = connection.readEncounter(read)
    const refused = connection.readEncounter(read)
    const requests = socket.sent
      .slice(1)
      .map((message) => liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(message)))
    const [first, second] = requests
    if (first?.type !== 'ENCOUNTER_READ' || second?.type !== 'ENCOUNTER_READ')
      throw new Error('Expected two Encounter reads.')
    expect(first.read).toEqual(read)
    expect(first.requestId).not.toBe(second.requestId)

    socket.receive({
      requestId: first.requestId,
      result: { kind: 'LATEST_EVIDENCE_ROLLS', result: [] },
      type: 'ENCOUNTER_READ_RESULT',
      version: 9
    })
    await expect(answered).resolves.toEqual({
      result: { kind: 'LATEST_EVIDENCE_ROLLS', result: [] },
      version: 9
    })
    socket.receive({
      code: 'DOMAIN_REJECTED',
      message: 'Not your turn.',
      reason: 'NOT_CURRENT_ACTOR',
      requestId: second.requestId,
      type: 'ENCOUNTER_READ_REJECTED'
    })
    await expect(refused).rejects.toMatchObject({
      code: 'DOMAIN_REJECTED',
      message: 'Not your turn.'
    })

    const dropped = connection.readEncounter(read)
    socket.close()
    await expect(dropped).rejects.toThrow()
    connection.close()
  })

  it('sends each preview stream at most 10 times a second and pings at most twice', async () => {
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket-1' }),
      onError: (error) => {
        throw error
      },
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    const drag = validated(sceneTransientEnvelopeDtoSchema)({
      ...envelope,
      kind: 'TOKEN_DRAG_PREVIEW',
      tokenId: '00000000-0000-4000-8000-000000000015'
    })
    const sentAt: Record<string, number[]> = {}
    socket.send = (data) => {
      const message = liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(data))
      if (message.type === 'TRANSIENT') (sentAt[message.envelope.kind] ??= []).push(now)
    }

    // Pings and token-drag samples are offered together at 31 Hz for one second.
    for (let frame = 1; frame <= 31; frame += 1) {
      connection.sendTransient({ ...envelope, sequence: frame })
      connection.sendTransient({ ...drag, sequence: frame })
      now += 32
    }
    const tenHertz = [1_000, 1_128, 1_256, 1_384, 1_512, 1_640, 1_768, 1_896]
    expect(sentAt).toEqual({ PING: [1_000, 1_512], TOKEN_DRAG_PREVIEW: tenHertz })
    connection.close()
  })

  it('uses STATE_SYNC as command readiness, applies ordered commits, and surfaces rejection', async () => {
    const durableStates: unknown[] = []
    const errors: Error[] = []
    const rejections: unknown[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onCommandRejected: (rejection) => rejections.push(rejection),
      onDurableState: (state) => durableStates.push(state),
      onError: (error) => errors.push(error),
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    expect(connection.sendCommand(command)).toBe(false)

    socket.receive({
      authorityEpoch,
      sequence: 4,
      state: { ...recipientState, recipientRole: 'OWNER', scene: sceneState },
      type: 'STATE_SYNC'
    })
    expect(durableStates.at(-1)).toMatchObject({
      commandReady: true,
      recipientState: {
        recipientRole: 'OWNER',
        scene: { id: sceneId, version: 4 }
      },
      sequence: 4
    })

    const committed = connection.submitCommand(command)
    expect(JSON.parse(socket.sent.at(-1)!) as unknown).toEqual({
      command,
      expectedSessionSequence: 4,
      type: 'COMMAND'
    })
    socket.receive({
      commandId,
      delta: {
        result: {
          commandId,
          delta: { barrierId: door.id, kind: 'DOOR_STATE_SET', state: 'OPEN' },
          occurrence: null,
          replayed: false,
          sceneId,
          version: 5
        },
        scope: 'SCENE'
      },
      sequence: 5,
      type: 'COMMAND_COMMITTED'
    })
    await expect(committed).resolves.toMatchObject({ commandId, sequence: 5 })
    expect(durableStates.at(-1)).toMatchObject({
      commandReady: true,
      recipientState: { scene: { doorStates: { [door.id]: 'OPEN' }, version: 5 } },
      sequence: 5
    })

    const rejectedCommand = {
      ...command,
      command: { ...command.command, commandId: '00000000-0000-4000-8000-000000000008' }
    }
    const rejected = connection.submitCommand(rejectedCommand)
    socket.receive({
      code: 'STALE_STATE',
      commandId: rejectedCommand.command.commandId,
      currentSequence: 5,
      message: 'Scene state changed.',
      reason: null,
      warnings: null,
      type: 'COMMAND_REJECTED'
    })
    await expect(rejected).rejects.toThrow('Scene state changed.')
    expect(rejections).toHaveLength(1)
    expect(durableStates.at(-1)).toMatchObject({ sequence: 5 })

    socket.receive({
      commandId: '00000000-0000-4000-8000-000000000009',
      delta: { sceneId, scope: 'SCENE_VERSION', version: 7 },
      sequence: 7,
      type: 'COMMAND_COMMITTED'
    })
    expect(errors.at(-1)?.message).toBe('Live play received commands out of order.')
    expect(durableStates.at(-1)).toMatchObject({ commandReady: false, sequence: 5 })
    expect(JSON.parse(socket.sent.at(-1)!) as unknown).toEqual({
      lastAppliedSequence: 5,
      type: 'RESUME'
    })
    connection.close()
  })

  it('stages a fog patch in bounded batches, then publishes it as one Scene command', async () => {
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onError: (error) => {
        throw error
      },
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    socket.receive({
      authorityEpoch,
      sequence: 4,
      state: { ...recipientState, recipientRole: 'OWNER', scene: sceneState },
      type: 'STATE_SYNC'
    })
    const saveId = '00000000-0000-4000-8000-000000000020'
    const chunks = Array.from({ length: 10 }, (_, index) => ({
      data: 'AA==',
      height: 1,
      index,
      width: 1,
      x: index,
      y: 0
    }))
    const sentMessages = () =>
      socket.sent.map((data) => liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(data)))
    const progress = (receivedChunks: number) =>
      socket.receive({
        progress: {
          commandId,
          receivedChunks,
          saveId,
          sceneId,
          status: 'RECEIVING',
          totalChunks: 10
        },
        type: 'SCENE_FOG_PROGRESS'
      })

    const published = connection.submitSceneFog({
      commandId,
      expectedSceneVersion: sceneState.version,
      layer: { chunks, height: 1, ownerUserId: null, width: 10 },
      sceneId,
      type: 'PATCH_SCENE_FOG'
    })
    expect(sentMessages().at(-1)).toMatchObject({
      input: { chunkManifest: expect.any(Array), commandId, type: 'PATCH_SCENE_FOG' },
      type: 'SCENE_FOG_BEGIN'
    })
    progress(0)
    await vi.waitFor(() =>
      expect(sentMessages().at(-1)).toMatchObject({
        commandId,
        input: { offset: 0, saveId },
        type: 'SCENE_FOG_APPEND'
      })
    )
    progress(8)
    await vi.waitFor(() =>
      expect(sentMessages().at(-1)).toMatchObject({
        input: { offset: 8 },
        type: 'SCENE_FOG_APPEND'
      })
    )
    expect(
      sentMessages().flatMap((message) =>
        message.type === 'SCENE_FOG_APPEND' ? [message.input.chunks.length] : []
      )
    ).toEqual([8, 2])
    progress(10)
    await vi.waitFor(() =>
      expect(sentMessages().at(-1)).toEqual({
        command: {
          command: {
            commandId,
            expectedSceneVersion: sceneState.version,
            saveId,
            sceneId,
            type: 'PUBLISH_SCENE_FOG_PATCH'
          },
          scope: 'SCENE'
        },
        expectedSessionSequence: 4,
        type: 'COMMAND'
      })
    )
    socket.receive({ commandId, delta: null, sequence: 5, type: 'COMMAND_COMMITTED' })
    await expect(published).resolves.toMatchObject({ commandId, sequence: 5 })

    // A refused step rejects the upload with the room's reason.
    const refusedId = '00000000-0000-4000-8000-000000000021'
    const refused = connection.submitSceneFog({
      commandId: refusedId,
      expectedSceneVersion: sceneState.version,
      layer: { chunks, height: 1, ownerUserId: null, width: 10 },
      sceneId,
      type: 'PATCH_SCENE_FOG'
    })
    socket.receive({
      code: 'RATE_LIMITED',
      commandId: refusedId,
      currentSequence: 5,
      message: 'Finish or wait out your other fog changes first.',
      reason: null,
      warnings: null,
      type: 'COMMAND_REJECTED'
    })
    await expect(refused).rejects.toThrow('Finish or wait out your other fog changes first.')
    connection.close()
  })

  it('advances contiguous native Encounter receipts, settles same-sequence replay, and resumes gaps', async () => {
    const durableStates: unknown[] = []
    const errors: Error[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onDurableState: (state) => durableStates.push(state),
      onError: (error) => errors.push(error),
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    socket.receive({
      authorityEpoch,
      sequence: 4,
      state: { ...recipientState, recipientRole: 'OWNER', scene: sceneState },
      type: 'STATE_SYNC'
    })
    const encounterCommand = validated(liveSessionCommandDtoSchema)({
      command: {
        commandId,
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        type: 'ADVANCE_TURN'
      },
      scope: 'ENCOUNTER'
    })
    const committed = connection.submitCommand(encounterCommand)
    const result = {
      occurrence: null,
      projection: tabletopGmEncounter,
      roll: null
    }
    socket.receive(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        commandId,
        delta: { result, scope: 'ENCOUNTER' },
        sequence: 5,
        type: 'COMMAND_COMMITTED'
      })
    )
    await expect(committed).resolves.toMatchObject({ delta: { result, scope: 'ENCOUNTER' } })
    expect(errors).toEqual([])
    expect(durableStates.at(-1)).toMatchObject({
      commandReady: true,
      sequence: 5,
      recipientState: { ...recipientState, recipientRole: 'OWNER', scene: sceneState }
    })
    const nextCommand = {
      ...encounterCommand,
      command: { ...encounterCommand.command, commandId: '00000000-0000-4000-8000-000000000008' }
    }
    const replayed = connection.submitCommand(nextCommand)
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(socket.sent.at(-1)!))
    ).toEqual({ command: nextCommand, expectedSessionSequence: 5, type: 'COMMAND' })
    socket.receive(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        commandId: nextCommand.command.commandId,
        delta: { result, scope: 'ENCOUNTER' },
        sequence: 5,
        type: 'COMMAND_COMMITTED'
      })
    )
    await expect(replayed).resolves.toMatchObject({
      delta: { result, scope: 'ENCOUNTER' },
      sequence: 5
    })
    expect(durableStates.at(-1)).toMatchObject({
      commandReady: true,
      sequence: 5,
      recipientState: { ...recipientState, recipientRole: 'OWNER', scene: sceneState }
    })
    socket.receive(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        commandId: '00000000-0000-4000-8000-000000000009',
        delta: { result, scope: 'ENCOUNTER' },
        sequence: 7,
        type: 'COMMAND_COMMITTED'
      })
    )
    expect(errors.at(-1)?.message).toBe('Live play received commands out of order.')
    expect(durableStates.at(-1)).toMatchObject({ commandReady: false, sequence: 5 })
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(socket.sent.at(-1)!))
    ).toEqual({ lastAppliedSequence: 5, type: 'RESUME' })
    connection.close()
  })

  it('advances a private-history-free Sheet acknowledgement and waits for its own same-sequence receipt', async () => {
    const durableStates: unknown[] = []
    const errors: Error[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onDurableState: (state) => durableStates.push(state),
      onError: (error) => errors.push(error),
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    const state = { ...recipientState, recipientRole: 'OWNER', scene: sceneState }
    socket.receive({ authorityEpoch, sequence: 4, state, type: 'STATE_SYNC' })
    const characterId = '00000000-0000-4000-8000-000000000015'
    const sheetCommand = validated(liveSessionCommandDtoSchema)({
      scope: 'CHARACTER_SHEET',
      characterId,
      encounterId: tabletopGmEncounter.id,
      command: { type: 'SET_INSPIRATION', commandId, expectedVersion: 8, inspired: true }
    })
    let settled = false
    const committed = connection.submitCommand(sheetCommand)
    void committed.then(() => {
      settled = true
    })
    socket.receive(
      validated(liveSessionWebSocketServerMessageDtoSchema)({
        commandId,
        delta: null,
        sequence: 5,
        type: 'COMMAND_COMMITTED'
      })
    )
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(durableStates.at(-1)).toMatchObject({
      commandReady: true,
      recipientState: state,
      sequence: 5
    })
    // A different surface's result cannot settle the pending private Sheet command.
    socket.receive(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        commandId,
        delta: {
          scope: 'ENCOUNTER',
          result: { occurrence: null, projection: tabletopGmEncounter, roll: null }
        },
        sequence: 5,
        type: 'COMMAND_COMMITTED'
      })
    )
    await Promise.resolve()
    expect(settled).toBe(false)
    const result = {
      characterId,
      streamVersion: 9,
      historyEntry: {
        eventId: '00000000-0000-4000-8000-000000000016',
        occurredAt: '2026-08-15T12:00:00.000Z',
        actorId: userId,
        eventType: 'SET_INSPIRATION',
        summary: 'Gained inspiration.'
      }
    }
    const receipt = validated(liveSessionWebSocketServerMessageDtoSchema)({
      commandId,
      delta: { scope: 'CHARACTER_SHEET', result },
      sequence: 5,
      type: 'COMMAND_COMMITTED'
    })
    socket.receive(receipt)
    await expect(committed).resolves.toEqual(receipt)
    expect(settled).toBe(true)
    expect(errors).toEqual([])
    expect(durableStates.at(-1)).toMatchObject({
      commandReady: true,
      recipientState: state,
      sequence: 5
    })
    connection.close()
  })

  it('settles an Encounter binding with the next room sequence and an unchanged Scene (D47)', async () => {
    const durableStates: unknown[] = []
    const errors: Error[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onDurableState: (state) => durableStates.push(state),
      onError: (error) => errors.push(error),
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    const state = { ...recipientState, recipientRole: 'OWNER', scene: sceneState }
    socket.receive({ authorityEpoch, sequence: 4, state, type: 'STATE_SYNC' })
    const committed = connection.submitCommand({
      command: {
        commandId,
        encounterId: tabletopGmEncounter.id,
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE'
      },
      scope: 'ENCOUNTER_BINDING'
    })
    const delta = {
      result: { commandId, encounterId: tabletopGmEncounter.id, replayed: false, sceneId },
      scope: 'ENCOUNTER_BINDING'
    }
    socket.receive({ commandId, delta, sequence: 5, type: 'COMMAND_COMMITTED' })
    await expect(committed).resolves.toMatchObject({ delta, sequence: 5 })
    expect(errors).toEqual([])
    expect(durableStates.at(-1)).toMatchObject({
      commandReady: true,
      recipientState: state,
      sequence: 5
    })
    connection.close()
  })

  it('settles a movement decision only with its Encounter result after its Scene change', async () => {
    const errors: Error[] = []
    const durableStates: unknown[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onDurableState: (state) => durableStates.push(state),
      onError: (error) => errors.push(error),
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    socket.receive({
      authorityEpoch,
      sequence: 4,
      state: { ...recipientState, recipientRole: 'OWNER', scene: sceneState },
      type: 'STATE_SYNC'
    })
    const decision = validated(liveSessionCommandDtoSchema)({
      command: {
        commandId,
        correlationId: null,
        encounterId: tabletopGmEncounter.id,
        expectedOccurrenceVersion: 1,
        expectedVersion: tabletopGmEncounter.version,
        occurrenceId: '00000000-0000-4000-8000-000000000021',
        resolution: { kind: 'DECLINE' },
        type: 'RESOLVE_RULE_OCCURRENCE'
      },
      scope: 'ENCOUNTER'
    })
    let settled = false
    const committed = connection.submitCommand(decision)
    void committed.then(() => {
      settled = true
    })
    // The room commits the decision with its Scene first (D27); the Scene advances the sequence.
    socket.receive({
      commandId,
      delta: { scope: 'SCENE_VERSION', sceneId, version: sceneState.version + 1 },
      sequence: 5,
      type: 'COMMAND_COMMITTED'
    })
    await vi.waitFor(() => expect(durableStates.at(-1)).toMatchObject({ sequence: 5 }))
    expect(settled).toBe(false)
    const result = { occurrence: null, projection: tabletopGmEncounter, roll: null }
    socket.receive({
      commandId,
      delta: { result, scope: 'ENCOUNTER' },
      sequence: 5,
      type: 'COMMAND_COMMITTED'
    })
    await expect(committed).resolves.toMatchObject({ delta: { result, scope: 'ENCOUNTER' } })
    expect(errors).toEqual([])
    connection.close()
  })

  it('resends a pending command once per sequence after the room re-admits the socket', async () => {
    const durableStates: unknown[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onDurableState: (state) => durableStates.push(state),
      onError: (error) => {
        throw error
      },
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    socket.receive({
      authorityEpoch,
      sequence: 4,
      state: { ...recipientState, recipientRole: 'OWNER', scene: sceneState },
      type: 'STATE_SYNC'
    })

    const doorCommand = validated(liveSessionCommandDtoSchema)({
      command: {
        barrierId: door.id,
        commandId: '00000000-0000-4000-8000-000000000008',
        expectedSceneVersion: sceneState.version,
        sceneId,
        state: 'OPEN',
        type: 'SET_SCENE_DOOR_STATE'
      },
      scope: 'SCENE'
    })
    const committed = connection.submitCommand(doorCommand)
    expect(JSON.parse(socket.sent.at(-1)!) as unknown).toEqual({
      command: doorCommand,
      expectedSessionSequence: 4,
      type: 'COMMAND'
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    socket.receive({ type: 'AUTHENTICATION_REQUIRED' })
    await vi.waitFor(() =>
      expect(JSON.parse(socket.sent.at(-1)!) as unknown).toEqual({
        accessToken: 'access-token',
        type: 'AUTHENTICATE'
      })
    )
    const beforeRenewedReadiness = socket.sent.length
    expect(connection.sendTransient(envelope)).toBe(false)
    expect(socket.sent).toHaveLength(beforeRenewedReadiness)
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    expect(connection.sendTransient(envelope)).toBe(true)
    expect(JSON.parse(socket.sent.at(-1)!) as unknown).toEqual({ envelope, type: 'TRANSIENT' })

    const newerSceneState = { ...sceneState, version: 5 }
    socket.receive({
      authorityEpoch,
      sequence: 5,
      state: { ...recipientState, recipientRole: 'OWNER', scene: newerSceneState },
      type: 'STATE_SYNC'
    })
    expect(durableStates.at(-1)).toMatchObject({ commandReady: true, sequence: 5 })
    expect(JSON.parse(socket.sent.at(-1)!) as unknown).toEqual({
      command: doorCommand,
      expectedSessionSequence: 4,
      type: 'COMMAND'
    })
    const afterResend = socket.sent.length

    socket.receive({
      authorityEpoch,
      sequence: 5,
      state: { ...recipientState, recipientRole: 'OWNER', scene: newerSceneState },
      type: 'STATE_SYNC'
    })
    expect(socket.sent).toHaveLength(afterResend)

    socket.receive({
      commandId: doorCommand.command.commandId,
      delta: {
        result: {
          commandId: doorCommand.command.commandId,
          delta: { barrierId: door.id, kind: 'DOOR_STATE_SET', state: 'OPEN' },
          occurrence: null,
          replayed: false,
          sceneId,
          version: 5
        },
        scope: 'SCENE'
      },
      sequence: 5,
      type: 'COMMAND_COMMITTED'
    })
    await expect(committed).resolves.toMatchObject({ sequence: 5 })
    expect(durableStates.at(-1)).toMatchObject({
      recipientState: { scene: { doorStates: { [door.id]: 'CLOSED' }, version: 5 } },
      sequence: 5
    })
    connection.close()
  })
  it('applies visible and hidden Scene commits and resumes for stale or gapped versions', async () => {
    const durableStates: unknown[] = []
    const errors: Error[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onDurableState: (state) => durableStates.push(state),
      onError: (error) => errors.push(error),
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    socket.receive({
      authorityEpoch,
      sequence: 4,
      state: { ...recipientState, recipientRole: 'OWNER', scene: sceneState },
      type: 'STATE_SYNC'
    })

    socket.receive({
      commandId,
      delta: {
        result: {
          commandId,
          delta: { barrierId: door.id, kind: 'DOOR_STATE_SET', state: 'OPEN' },
          occurrence: null,
          replayed: false,
          sceneId,
          version: 5
        },
        scope: 'SCENE'
      },
      sequence: 5,
      type: 'COMMAND_COMMITTED'
    })
    expect(durableStates.at(-1)).toMatchObject({
      recipientState: { scene: { doorStates: { [door.id]: 'OPEN' }, version: 5 } },
      sequence: 5
    })

    socket.receive({
      commandId: '00000000-0000-4000-8000-000000000008',
      delta: { sceneId, scope: 'SCENE_VERSION', version: 6 },
      sequence: 6,
      type: 'COMMAND_COMMITTED'
    })
    expect(durableStates.at(-1)).toMatchObject({
      recipientState: { scene: { doorStates: { [door.id]: 'OPEN' }, version: 6 } },
      sequence: 6
    })

    const correctedScene = { ...sceneState, version: 9 }
    socket.receive({
      code: 'STALE_STATE',
      commandId: '00000000-0000-4000-8000-000000000009',
      correction: { scope: 'SCENE', state: correctedScene },
      currentSequence: 6,
      message: 'Scene state changed.',
      reason: null,
      warnings: null,
      type: 'COMMAND_REJECTED'
    })
    expect(durableStates.at(-1)).toMatchObject({
      recipientState: { scene: { doorStates: { [door.id]: 'CLOSED' }, version: 9 } },
      sequence: 6
    })

    socket.receive({
      commandId: '00000000-0000-4000-8000-000000000010',
      delta: { sceneId, scope: 'SCENE_VERSION', version: 11 },
      sequence: 7,
      type: 'COMMAND_COMMITTED'
    })
    expect(errors.at(-1)?.message).toBe('Live play could not apply the next command.')
    expect(durableStates.at(-1)).toMatchObject({ commandReady: false, sequence: 6 })
    expect(JSON.parse(socket.sent.at(-1)!) as unknown).toEqual({
      lastAppliedSequence: 6,
      type: 'RESUME'
    })

    socket.receive({
      authorityEpoch,
      sequence: 6,
      state: { ...recipientState, recipientRole: 'OWNER', scene: correctedScene },
      type: 'STATE_SYNC'
    })
    socket.receive({
      commandId: '00000000-0000-4000-8000-000000000011',
      delta: { sceneId, scope: 'SCENE_VERSION', version: 9 },
      sequence: 7,
      type: 'COMMAND_COMMITTED'
    })
    expect(errors.at(-1)?.message).toBe('Live play could not apply the next command.')
    expect(durableStates.at(-1)).toMatchObject({ commandReady: false, sequence: 6 })
    connection.close()
  })
  it('fetches a new token when authentication is requested', async () => {
    const getAccessToken = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('initial-token')
      .mockResolvedValueOnce('refreshed-token')
    const statuses: string[] = []
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken,
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onError: (error) => {
        throw error
      },
      onStatus: (status) => statuses.push(status),
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    await Promise.resolve()
    socket.receive({ type: 'AUTHENTICATION_REQUIRED' })
    await vi.waitFor(() => expect(getAccessToken).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2))
    expect(JSON.parse(socket.sent[1]!) as unknown).toEqual({
      accessToken: 'refreshed-token',
      type: 'AUTHENTICATE'
    })
    expect(statuses.at(-1)).toBe('RECONNECTING')
    connection.close()
  })

  it('waits for a server challenge before refreshing authentication', async () => {
    vi.useFakeTimers()
    const getAccessToken = vi.fn(async () => 'access-token')
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken,
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onError: (error) => {
        throw error
      },
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(socket.sent).toHaveLength(1)
    expect(getAccessToken).toHaveBeenCalledOnce()
    connection.close()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(socket.sent).toHaveLength(1)
  })

  it.each(['CAMPAIGN_NOT_FOUND', 'CAMPAIGN_NOT_ACTIVE'] as const)(
    'shows a %s ticket refusal and does not retry it',
    async (reason) => {
      vi.useFakeTimers()
      const getTicket = vi.fn(() =>
        Promise.reject(
          new ConvexError({
            code: 'DOMAIN_REJECTED',
            message: DOMAIN_REJECTION_MESSAGES[reason],
            reason
          })
        )
      )
      const errors: string[] = []
      const statuses: string[] = []
      const connection = createLiveSessionConnection({
        createSocket: (url, protocols) => new FakeSocket(url, protocols),
        getAccessToken: async () => 'access-token',
        getTicket,
        onError: (error) => errors.push(errorMessage(error)),
        onStatus: (status) => statuses.push(status),
        onTransient: () => undefined,
        url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
      })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(getTicket).toHaveBeenCalledTimes(1)
      expect(errors).toEqual([DOMAIN_REJECTION_MESSAGES[reason]])
      expect(statuses.at(-1)).toBe('DISCONNECTED')
      expect(FakeSocket.instances).toHaveLength(0)
      connection.close()
    }
  )

  it('keeps retrying a ticket failure that is not a terminal refusal', async () => {
    vi.useFakeTimers()
    const getTicket = vi.fn(() => Promise.reject(new Error('Server Error')))
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket,
      onError: () => undefined,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(getTicket.mock.calls.length).toBeGreaterThan(1)
    connection.close()
  })

  it('reconnects with a fresh one-use ticket and resets backoff after transient readiness', async () => {
    vi.useFakeTimers()
    const getTicket = vi.fn(async () => ({
      expiresAt: '2026-08-15T12:01:00.000Z',
      ticket: `ticket-${getTicket.mock.calls.length}`
    }))
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket,
      onError: () => undefined,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const first = FakeSocket.instances[0]!
    first.open()
    await vi.waitFor(() => expect(first.sent).toHaveLength(1))
    first.receive({ campaignId, type: 'TRANSIENT_READY' })
    first.receive({ authorityEpoch, sequence: 4, state: recipientState, type: 'STATE_SYNC' })
    const committed = connection.submitCommand(command)
    expect(JSON.parse(first.sent.at(-1)!) as unknown).toEqual({
      command,
      expectedSessionSequence: 4,
      type: 'COMMAND'
    })
    first.close(1012, 'restart')
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
    const second = FakeSocket.instances[1]!
    expect(second.protocols[1]).toBe('artificer.ticket.ticket-2')
    second.open()
    await vi.waitFor(() => expect(second.sent).toHaveLength(1))
    second.receive({ campaignId, type: 'TRANSIENT_READY' })
    second.receive({
      authorityEpoch,
      sequence: 5,
      state: recipientState,
      type: 'STATE_SYNC'
    })
    expect(JSON.parse(second.sent.at(-1)!) as unknown).toEqual({
      command,
      expectedSessionSequence: 4,
      type: 'COMMAND'
    })
    second.receive({ commandId, delta: null, sequence: 5, type: 'COMMAND_COMMITTED' })
    await expect(committed).resolves.toMatchObject({ commandId, sequence: 5 })
    second.receive({ authorityEpoch, sequence: 8, state: recipientState, type: 'STATE_SYNC' })

    second.close(1012, 'restart')
    await vi.advanceTimersByTimeAsync(999)
    expect(FakeSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(3))
    const third = FakeSocket.instances[2]!
    expect(third.protocols[1]).toBe('artificer.ticket.ticket-3')
    third.open()
    await vi.waitFor(() => expect(third.sent).toHaveLength(1))
    third.receive({ campaignId, type: 'TRANSIENT_READY' })
    expect(JSON.parse(third.sent[1]!) as unknown).toEqual({
      lastAppliedSequence: 8,
      type: 'RESUME'
    })
    expect(getTicket).toHaveBeenCalledTimes(3)
    connection.close()
  })

  it('closes invalid messages and reports a generic authentication failure', async () => {
    const onError = vi.fn()
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => Promise.reject(new Error('upstream secret')),
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket' }),
      onError,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unable to authenticate live play.' })
      )
    )
    expect(onError).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'upstream secret' })
    )
    expect(socket.sent).toEqual([])
    expect(socket.closedWith).toEqual({
      code: 4001,
      reason: 'Live-session authentication failed.'
    })
    connection.close()

    const invalidError = vi.fn()
    const invalidConnection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getAccessToken: async () => 'access-token',
      getTicket: async () => ({ expiresAt: '2026-08-15T12:01:00.000Z', ticket: 'ticket-2' }),
      onError: invalidError,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', campaignId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
    const invalidSocket = FakeSocket.instances[1]!
    invalidSocket.open()
    await vi.waitFor(() => expect(invalidSocket.sent).toHaveLength(1))
    invalidSocket.receiveRaw('{invalid')
    expect(invalidError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'The live-session host returned an invalid message.' })
    )
    expect(invalidSocket.closedWith).toEqual({
      code: 4002,
      reason: 'Invalid live-session message.'
    })
    invalidConnection.close()
  })

  it('rejects unsupported endpoint protocols before connecting', () => {
    expect(() => resolveLiveSessionWebSocketUrl('ftp://live.example.test', campaignId)).toThrow(
      'Live-session URL must use ws, wss, http, or https.'
    )
  })
})

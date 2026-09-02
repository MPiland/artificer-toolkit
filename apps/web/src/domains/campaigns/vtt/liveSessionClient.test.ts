import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveSessionConnection, resolveLiveSessionWebSocketUrl } from './liveSessionClient'

const campaignId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const sceneDefinitionId = '00000000-0000-4000-8000-000000000004'
const commandId = '00000000-0000-4000-8000-000000000005'

class FakeSocket extends EventTarget {
  static readonly instances: FakeSocket[] = []
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

  receive(message: LiveSessionWebSocketServerMessageDto): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return
    this.readyState = 3
    this.dispatchEvent(new CloseEvent('close', { code, reason }))
  }
}

const readyMessage: LiveSessionWebSocketServerMessageDto = {
  aggregateVersions: [],
  campaignId,
  deliverySequence: 0,
  encounterActorTokenBindings: [],
  encounterSceneBindings: [],
  sceneSnapshots: [],
  sessionId,
  type: 'READY'
}

afterEach(() => {
  FakeSocket.instances.length = 0
  vi.useRealTimers()
})

describe('live-session browser connection', () => {
  it('uses a fresh ticket and resumes pending commands after reconnect', async () => {
    vi.useFakeTimers()
    const statuses: string[] = []
    const messages: LiveSessionWebSocketServerMessageDto[] = []
    const getTicket = vi.fn(async () => ({
      expiresAt: '2026-08-15T12:01:00.000Z',
      ticket: `ticket-${getTicket.mock.calls.length}`
    }))
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getTicket,
      onError: (error) => {
        throw error
      },
      onMessage: (message) => messages.push(message),
      onStatus: (status) => statuses.push(status),
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', sessionId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const first = FakeSocket.instances[0]
    expect(first?.url).toBe(`wss://live.example.test/live-session/${sessionId}`)
    expect(first?.protocols).toEqual(['artificer.live-session.v1', 'artificer.ticket.ticket-1'])
    first?.open()
    first?.receive(readyMessage)
    const pending = connection.executeCommand({
      aggregateKind: 'SESSION',
      command: {
        commandId,
        expectedPresentationVersion: null,
        sceneId: sceneDefinitionId,
        sessionId,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      }
    })

    first?.close(1012, 'restart')
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
    const second = FakeSocket.instances[1]
    expect(second?.protocols[1]).toBe('artificer.ticket.ticket-2')
    second?.open()
    second?.receive(readyMessage)

    expect(second?.sent.map((message) => JSON.parse(message) as unknown)).toEqual([
      {
        lastSeenDeliverySequence: 0,
        pendingCommandIds: [commandId],
        type: 'RESUME'
      },
      {
        command: {
          aggregateKind: 'SESSION',
          command: {
            commandId,
            expectedPresentationVersion: null,
            sceneId: sceneDefinitionId,
            sessionId,
            type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
          }
        },
        type: 'COMMAND'
      }
    ])
    second?.receive({
      acceptedSequence: 1,
      aggregateId: sessionId,
      aggregateKind: 'SESSION',
      changedAggregates: [{ aggregateId: sessionId, aggregateKind: 'SESSION', version: 1 }],
      deliverySequence: 1,
      originCommandId: commandId,
      replayed: true,
      response: {
        commandId,
        replayed: true,
        sceneId: sceneDefinitionId,
        sessionId,
        version: 1
      },
      type: 'COMMAND_COMMITTED',
      version: 1
    })
    await expect(pending).resolves.toMatchObject({ originCommandId: commandId, replayed: true })
    expect(messages.map(({ type }) => type)).toEqual(['READY', 'READY', 'COMMAND_COMMITTED'])
    expect(statuses).toContain('RECONNECTING')
    connection.close()
  })

  it('backs off failed admission attempts and resets only after an authoritative READY', async () => {
    vi.useFakeTimers()
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getTicket: vi.fn(async () => ({
        expiresAt: '2026-08-15T12:01:00.000Z',
        ticket: `ticket-${FakeSocket.instances.length + 1}`
      })),
      onError: () => undefined,
      onMessage: () => undefined,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', sessionId)
    })

    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const delays = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]
    for (const [index, delay] of delays.entries()) {
      FakeSocket.instances.at(-1)?.close(1012, 'unavailable')
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(FakeSocket.instances).toHaveLength(index + 1)
      await vi.advanceTimersByTimeAsync(1)
      await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(index + 2))
    }

    const admitted = FakeSocket.instances.at(-1)!
    admitted.open()
    admitted.receive(readyMessage)
    admitted.close(1012, 'restart')
    await vi.advanceTimersByTimeAsync(999)
    expect(FakeSocket.instances.at(-1)).toBe(admitted)
    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => expect(FakeSocket.instances.at(-1)).not.toBe(admitted))
    connection.close()
  })

  it('resolves authoritative command responses and rejects terminal command failures', async () => {
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getTicket: async () => ({
        expiresAt: '2026-08-15T12:01:00.000Z',
        ticket: 'ticket'
      }),
      onError: (error) => {
        throw error
      },
      onMessage: () => undefined,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', sessionId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    socket.receive(readyMessage)

    const committed = connection.executeCommand({
      aggregateKind: 'SESSION',
      command: {
        commandId,
        expectedPresentationVersion: null,
        sceneId: sceneDefinitionId,
        sessionId,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      }
    })
    socket.receive({
      acceptedSequence: 1,
      aggregateId: sessionId,
      aggregateKind: 'SESSION',
      changedAggregates: [{ aggregateId: sessionId, aggregateKind: 'SESSION', version: 1 }],
      deliverySequence: 1,
      originCommandId: commandId,
      replayed: false,
      response: {
        commandId,
        replayed: false,
        sceneId: sceneDefinitionId,
        sessionId,
        version: 1
      },
      type: 'COMMAND_COMMITTED',
      version: 1
    })
    await expect(committed).resolves.toMatchObject({
      aggregateKind: 'SESSION',
      originCommandId: commandId,
      version: 1
    })

    const rejectedCommandId = '00000000-0000-4000-8000-000000000006'
    const rejected = connection.executeCommand({
      aggregateKind: 'SESSION',
      command: {
        commandId: rejectedCommandId,
        expectedPresentationVersion: 1,
        sceneId: sceneDefinitionId,
        sessionId,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      }
    })
    socket.receive({
      code: 'STALE_VERSION',
      commandId: rejectedCommandId,
      message: 'The scene changed before this command committed.',
      type: 'COMMAND_REJECTED'
    })
    await expect(rejected).rejects.toThrow('The scene changed before this command committed.')
    connection.close()
  })

  it('rejects pending commands when connection authorization is revoked', async () => {
    const connection = createLiveSessionConnection({
      createSocket: (url, protocols) => new FakeSocket(url, protocols),
      getTicket: async () => ({
        expiresAt: '2026-08-15T12:01:00.000Z',
        ticket: 'ticket'
      }),
      onError: (error) => {
        throw error
      },
      onMessage: () => undefined,
      onStatus: () => undefined,
      onTransient: () => undefined,
      url: resolveLiveSessionWebSocketUrl('https://live.example.test/', sessionId)
    })
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    socket.open()
    socket.receive(readyMessage)

    const first = connection.executeCommand({
      aggregateKind: 'SESSION',
      command: {
        commandId,
        expectedPresentationVersion: null,
        sceneId: sceneDefinitionId,
        sessionId,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      }
    })
    const second = connection.executeCommand({
      aggregateKind: 'SESSION',
      command: {
        commandId: '00000000-0000-4000-8000-000000000007',
        expectedPresentationVersion: null,
        sceneId: sceneDefinitionId,
        sessionId,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      }
    })
    const firstRejection = expect(first).rejects.toThrow('Campaign membership changed.')
    const secondRejection = expect(second).rejects.toThrow('Campaign membership changed.')

    socket.receive({
      code: 'UNAUTHORIZED',
      commandId: null,
      message: 'Campaign membership changed.',
      type: 'COMMAND_REJECTED'
    })

    await Promise.all([firstRejection, secondRejection])
    connection.close()
  })

  it('rejects unsupported endpoint protocols before connecting', () => {
    expect(() => resolveLiveSessionWebSocketUrl('ftp://live.example.test', sessionId)).toThrow(
      'Live-session URL must use ws, wss, http, or https.'
    )
  })
})

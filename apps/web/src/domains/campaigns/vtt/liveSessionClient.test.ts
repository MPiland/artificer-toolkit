import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveSessionConnection, resolveLiveSessionWebSocketUrl } from './liveSessionClient'

const campaignId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const encounterId = '00000000-0000-4000-8000-000000000003'
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
    expect(
      connection.sendCommand({
        aggregateKind: 'SCENE',
        command: { commandId, encounterId, sceneDefinitionId, type: 'ATTACH_SCENE' }
      })
    ).toBe(true)

    first?.close(1012, 'restart')
    await vi.advanceTimersByTimeAsync(250)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
    const second = FakeSocket.instances[1]
    expect(second?.protocols[1]).toBe('artificer.ticket.ticket-2')
    second?.open()
    second?.receive(readyMessage)

    expect(second?.sent.map((message) => JSON.parse(message) as unknown)).toContainEqual({
      lastSeenDeliverySequence: 0,
      pendingCommandIds: [commandId],
      type: 'RESUME'
    })
    expect(messages).toEqual([readyMessage, readyMessage])
    expect(statuses).toContain('RECONNECTING')
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
      aggregateKind: 'SCENE',
      command: { commandId, encounterId, sceneDefinitionId, type: 'ATTACH_SCENE' }
    })
    socket.receive({
      acceptedSequence: 1,
      aggregateId: encounterId,
      aggregateKind: 'SCENE',
      deliverySequence: 1,
      delta: null,
      originCommandId: commandId,
      replayed: false,
      snapshot: null,
      type: 'COMMAND_COMMITTED',
      version: 1
    })
    await expect(committed).resolves.toMatchObject({
      aggregateKind: 'SCENE',
      originCommandId: commandId,
      version: 1
    })

    const rejectedCommandId = '00000000-0000-4000-8000-000000000006'
    const rejected = connection.executeCommand({
      aggregateKind: 'SCENE',
      command: {
        commandId: rejectedCommandId,
        encounterId,
        sceneDefinitionId,
        type: 'ATTACH_SCENE'
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

  it('rejects unsupported endpoint protocols before connecting', () => {
    expect(() => resolveLiveSessionWebSocketUrl('ftp://live.example.test', sessionId)).toThrow(
      'Live-session URL must use ws, wss, http, or https.'
    )
  })
})

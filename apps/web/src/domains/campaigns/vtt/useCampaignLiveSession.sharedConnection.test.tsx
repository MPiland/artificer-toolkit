import { liveSessionTicketDtoSchema } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import {
  liveSessionCommandDtoSchema,
  liveSessionWebSocketClientMessageDtoSchema
} from '@artificer-toolkit/schema/api/liveSessions'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validated } from '../../../test/validatedFixture'
import { useCampaignLiveSession } from './useCampaignLiveSession'

const campaignId = '00000000-0000-4000-8000-000000000001'
const otherCampaignId = '00000000-0000-4000-8000-000000000002'
const sceneId = '00000000-0000-4000-8000-000000000003'
const authorityEpoch = '00000000-0000-4000-8000-000000000006'
const liveTicket = validated(liveSessionTicketDtoSchema)({
  expiresAt: '2099-08-15T23:59:00.000Z',
  ticket: 'test-live-session-ticket'
})
const summary = { characters: [], encounter: null }

const doorCommand = (commandId: string) =>
  validated(liveSessionCommandDtoSchema)({
    scope: 'SCENE',
    command: {
      barrierId: '00000000-0000-4000-8000-000000000005',
      commandId,
      expectedSceneVersion: 4,
      sceneId,
      state: 'OPEN',
      type: 'SET_SCENE_DOOR_STATE'
    }
  })
const firstCommandId = '00000000-0000-4000-8000-000000000011'
const secondCommandId = '00000000-0000-4000-8000-000000000012'

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  issueTicket: vi.fn(),
  useConvex: vi.fn()
}))

vi.mock('#app/auth/betterAuthClient', () => ({
  betterAuthClient: { convex: { token: mocks.getAccessToken } }
}))

vi.mock('convex/react', () => ({ useConvex: mocks.useConvex }))

/** The browser's WebSocket, the one platform piece faked: every socket the product opens lands here. */
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

  send(data: string): void {
    this.sent.push(data)
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return
    this.closedWith = { code, reason }
    this.readyState = 3
    this.dispatchEvent(new CloseEvent('close', { code, reason }))
  }

  sentMessages() {
    return this.sent.map((data) =>
      liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(data) as unknown)
    )
  }
}

/** Authenticates the socket and walks it to `STATE_SYNC`, as the room does for a joined member. */
async function admit(socket: FakeSocket, sequence = 4) {
  socket.open()
  await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
  act(() => {
    socket.receive({ campaignId, type: 'TRANSIENT_READY' })
    socket.receive({
      authorityEpoch,
      sequence,
      state: { presentationVersion: 11, recipientRole: 'PLAYER', scene: null },
      type: 'STATE_SYNC'
    })
  })
}

interface CommandOutcome {
  error: unknown
  settled: boolean
}

/** Records how a command's promise ends, so a test can assert who it settled for. */
function outcomeOf(command: Promise<unknown>): CommandOutcome {
  const outcome: CommandOutcome = { error: null, settled: false }
  command.then(
    () => {
      outcome.settled = true
    },
    (error: unknown) => {
      outcome.settled = true
      outcome.error = error
    }
  )
  return outcome
}

const countOf = (socket: FakeSocket, type: string) =>
  socket.sentMessages().filter((message) => message.type === type).length

describe('useCampaignLiveSession shared connection', () => {
  beforeEach(() => {
    FakeSocket.instances.length = 0
    vi.stubGlobal('WebSocket', FakeSocket)
    mocks.getAccessToken.mockReset()
    mocks.getAccessToken.mockResolvedValue({ data: { token: 'test-access-token' } })
    mocks.issueTicket.mockReset()
    mocks.issueTicket.mockResolvedValue(liveTicket)
    mocks.useConvex.mockReturnValue({ action: mocks.issueTicket })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens one socket for every panel on a Campaign and follows the union of their feeds', async () => {
    const panels = [
      renderHook(() => useCampaignLiveSession({ campaignId, enabled: true })),
      renderHook(() =>
        useCampaignLiveSession({ campaignId, enabled: true, encounterSession: { timeline: false } })
      ),
      renderHook(() =>
        useCampaignLiveSession({ campaignId, enabled: true, encounterSession: { timeline: true } })
      ),
      renderHook(() =>
        useCampaignLiveSession({ campaignId, campaignSummary: true, enabled: true })
      ),
      renderHook(() => useCampaignLiveSession({ campaignId, enabled: true, onTransient: vi.fn() }))
    ]
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const [socket] = FakeSocket.instances
    await admit(socket!)

    expect(FakeSocket.instances).toHaveLength(1)
    expect(mocks.issueTicket).toHaveBeenCalledTimes(1)
    expect(socket!.sentMessages()).toContainEqual({
      timeline: true,
      type: 'SUBSCRIBE_ENCOUNTER_SESSION'
    })
    expect(countOf(socket!, 'SUBSCRIBE_ENCOUNTER_SESSION')).toBe(1)
    expect(countOf(socket!, 'SUBSCRIBE_CAMPAIGN_SUMMARY')).toBe(1)
    for (const panel of panels)
      await waitFor(() => expect(panel.result.current.status).toBe('CONNECTED'))
    expect(panels.every((panel) => panel.result.current.commandReady)).toBe(true)
  })

  it('opens a separate socket for another Campaign', async () => {
    renderHook(() => useCampaignLiveSession({ campaignId, enabled: true }))
    renderHook(() => useCampaignLiveSession({ campaignId: otherCampaignId, enabled: true }))
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
    expect(FakeSocket.instances.map((socket) => new URL(socket.url).pathname).sort()).toEqual(
      [campaignId, otherCampaignId].map((id) => `/live-session/${id}`).sort()
    )
  })

  it('gives each panel its own events and acks, and closes with the last panel', async () => {
    const onTransientA = vi.fn()
    const onTransientB = vi.fn()
    const a = renderHook(() =>
      useCampaignLiveSession({
        campaignId,
        campaignSummary: true,
        enabled: true,
        onTransient: onTransientA
      })
    )
    const b = renderHook(() =>
      useCampaignLiveSession({ campaignId, enabled: true, onTransient: onTransientB })
    )
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    await admit(socket)
    await waitFor(() => expect(b.result.current.commandReady).toBe(true))

    // A feed reaches only the panels that follow it.
    act(() => socket.receive({ summary, type: 'CAMPAIGN_SUMMARY' }))
    expect(a.result.current.campaignSummary).toEqual(summary)
    expect(b.result.current.campaignSummary).toBeNull()

    // Transients reach every panel's handler.
    const transient = {
      envelope: {
        audience: 'TABLE',
        baselineVersion: 1,
        kind: 'PING',
        position: { x: 4, y: 8 },
        sceneId,
        sequence: 2
      },
      userId: '00000000-0000-4000-8000-000000000004'
    }
    act(() => socket.receive({ message: transient, type: 'TRANSIENT' }))
    expect(onTransientA).toHaveBeenCalledWith(transient)
    expect(onTransientB).toHaveBeenCalledWith(transient)

    // A command settles only for its sender; the other panel's stays pending.
    const sent: { a?: CommandOutcome; b?: CommandOutcome } = {}
    act(() => {
      sent.a = outcomeOf(a.result.current.sendCommand(doorCommand(firstCommandId)))
      sent.b = outcomeOf(b.result.current.sendCommand(doorCommand(secondCommandId)))
    })
    expect(countOf(socket, 'COMMAND')).toBe(2)
    act(() =>
      socket.receive({
        commandId: firstCommandId,
        delta: null,
        sequence: 5,
        type: 'COMMAND_COMMITTED'
      })
    )
    await waitFor(() => expect(sent.a).toMatchObject({ error: null, settled: true }))
    expect(sent.b).toMatchObject({ settled: false })
    act(() =>
      socket.receive({
        code: 'STALE_STATE',
        commandId: secondCommandId,
        currentSequence: 5,
        message: 'Scene state changed.',
        reason: null,
        type: 'COMMAND_REJECTED',
        warnings: null
      })
    )
    await waitFor(() => expect(sent.b).toMatchObject({ settled: true }))
    expect(sent.b?.error).toBeInstanceOf(Error)
    // The refusal shows on the sender only.
    expect(b.result.current.rejection).toMatchObject({ commandId: secondCommandId })
    expect(a.result.current.rejection).toBeNull()

    // The socket outlives a panel and closes with the last one.
    a.unmount()
    expect(socket.closedWith).toBeNull()
    act(() => socket.receive({ message: transient, type: 'TRANSIENT' }))
    expect(onTransientA).toHaveBeenCalledTimes(1)
    expect(onTransientB).toHaveBeenCalledTimes(2)
    b.unmount()
    expect(socket.closedWith).toEqual({ code: 1000, reason: 'Live session closed.' })
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('hands a panel that mounts later the frames the room already pushed', async () => {
    const early = renderHook(() =>
      useCampaignLiveSession({ campaignId, campaignSummary: true, enabled: true })
    )
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]!
    await admit(socket)
    act(() => socket.receive({ summary, type: 'CAMPAIGN_SUMMARY' }))
    expect(early.result.current.campaignSummary).toEqual(summary)

    const late = renderHook(() =>
      useCampaignLiveSession({ campaignId, campaignSummary: true, enabled: true })
    )
    expect(late.result.current.status).toBe('CONNECTED')
    expect(late.result.current.commandReady).toBe(true)
    expect(late.result.current.campaignSummary).toEqual(summary)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('resubscribes every remaining panel on the one new socket after a forced close', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const summaryPanel = renderHook(() =>
      useCampaignLiveSession({ campaignId, campaignSummary: true, enabled: true })
    )
    const encounterPanel = renderHook(() =>
      useCampaignLiveSession({ campaignId, enabled: true, encounterSession: { timeline: true } })
    )
    const leavingPanel = renderHook(() => useCampaignLiveSession({ campaignId, enabled: true }))
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const first = FakeSocket.instances[0]!
    await admit(first)
    leavingPanel.unmount()
    expect(first.closedWith).toBeNull()

    act(() => first.close(1012, 'restart'))
    expect(summaryPanel.result.current.status).toBe('RECONNECTING')
    expect(encounterPanel.result.current.status).toBe('RECONNECTING')
    await act(() => vi.advanceTimersByTimeAsync(1_000))
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
    const second = FakeSocket.instances[1]!
    await admit(second, 9)

    expect(FakeSocket.instances).toHaveLength(2)
    expect(second.sentMessages()).toContainEqual({ type: 'SUBSCRIBE_CAMPAIGN_SUMMARY' })
    expect(second.sentMessages()).toContainEqual({
      timeline: true,
      type: 'SUBSCRIBE_ENCOUNTER_SESSION'
    })
    expect(summaryPanel.result.current.status).toBe('CONNECTED')
    expect(encounterPanel.result.current.sequence).toBe(9)
  })
})

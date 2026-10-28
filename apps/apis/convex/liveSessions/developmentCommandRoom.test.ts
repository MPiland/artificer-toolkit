import { afterEach, expect, it, vi } from 'vitest'
import { openCommandRoom } from '../../tests/developmentHttpClient'

const campaignId = '00000000-0000-4000-8000-000000000001'
const encounterId = '00000000-0000-4000-8000-000000000002'
const commandId = '00000000-0000-4000-8000-000000000004'

class FakeSocket extends EventTarget {
  closedWith: number | null = null

  send() {}

  close(code = 1000) {
    if (this.closedWith !== null) return
    this.closedWith = code
    this.dispatchEvent(new CloseEvent('close', { code }))
  }

  receive(message: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))
const stateSync = (sequence: number) => ({
  authorityEpoch: '00000000-0000-4000-8000-000000000003',
  sequence,
  state: { presentationVersion: null, recipientRole: 'OWNER', scene: null },
  type: 'STATE_SYNC'
})

afterEach(() => {
  vi.useRealTimers()
})

// RELIABILITY-21.T21: disarm-browser failed with "The Session room connection is closed." when the
// idle close fired while the driver waited for the room to admit it again (run 40753133858).
it('keeps an idle room open while a caller waits out a re-authentication', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const sockets: FakeSocket[] = []
  const room = openCommandRoom({
    url: `ws://127.0.0.1:8787/live-session/${campaignId}`,
    origin: 'http://localhost:3000',
    issueTicket: async () => ({ expiresAt: '2026-09-24T12:01:00.000Z', ticket: 'signed-ticket' }),
    accessToken: async () => 'token',
    onClosed: () => {},
    openSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    }
  })

  // A settled command leaves the room idle, which arms the idle close.
  const rejected = room.executeEncounter({
    type: 'ADVANCE_TURN',
    encounterId,
    commandId,
    expectedVersion: 4
  })
  await settle()
  const [socket] = sockets
  socket.dispatchEvent(new Event('open'))
  await settle()
  socket.receive({ campaignId, type: 'TRANSIENT_READY' })
  socket.receive(stateSync(3))
  socket.receive({
    code: 'STALE_STATE',
    commandId,
    currentSequence: 3,
    message: 'The Encounter changed; review the current state and try again.',
    reason: null,
    warnings: null,
    type: 'COMMAND_REJECTED'
  })
  await expect(rejected).rejects.toThrow(/STALE_STATE/)

  // The room asks again; the caller's wait outlasts the idle close.
  socket.receive({ type: 'AUTHENTICATION_REQUIRED' })
  await settle()
  const ready = room.whenReady()
  vi.advanceTimersByTime(10_000)
  expect(socket.closedWith).toBeNull()

  socket.receive({ campaignId, type: 'TRANSIENT_READY' })
  socket.receive(stateSync(4))
  await expect(ready).resolves.toBeUndefined()
})

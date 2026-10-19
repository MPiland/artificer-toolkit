import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeTrackedSockets, fixture, ROOM_REPLY_WAIT } from './liveRoomFixture.js'
import { clearRoomAlarms } from './roomTeardown.js'

/** A new stub for the room, since teardown resets the instance the old one was bound to. */
const current = (stub: DurableObjectStub) => env.LIVE_SESSION_ROOMS.get(stub.id)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('room teardown', () => {
  it('cancels the idle-release alarm a closed room scheduled', async () => {
    const base = await fixture()
    base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
    await vi.waitFor(
      () => expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true),
      ROOM_REPLY_WAIT
    )
    const alarm = () =>
      runInDurableObject(current(base.stub), (_room, state) => state.storage.getAlarm())

    closeTrackedSockets()
    await vi.waitFor(async () => expect(await alarm()).not.toBeNull(), ROOM_REPLY_WAIT)

    await clearRoomAlarms()
    expect(await alarm()).toBeNull()
  })

  it('waits for a socket that closes late, so its close cannot re-arm the idle release', async () => {
    const base = await fixture()
    base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
    await vi.waitFor(
      () => expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true),
      ROOM_REPLY_WAIT
    )

    // A loaded runner can deliver the close well after teardown starts.
    setTimeout(closeTrackedSockets, 2_500)
    await clearRoomAlarms()

    const roomState = () =>
      runInDurableObject(current(base.stub), async (_room, state) => ({
        sockets: state.getWebSockets().length,
        alarm: await state.storage.getAlarm()
      }))
    await vi.waitFor(async () => expect((await roomState()).sockets).toBe(0), ROOM_REPLY_WAIT)
    expect((await roomState()).alarm).toBeNull()
  })

  it('leaves nothing to re-arm the idle release for a close the room handles after teardown', async () => {
    const base = await fixture()
    base.socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: base.accessToken }))
    await vi.waitFor(
      () => expect(base.messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true),
      ROOM_REPLY_WAIT
    )
    closeTrackedSockets()
    await clearRoomAlarms()

    // The runtime drops a closing socket from the room before it delivers the close, so teardown
    // can finish first; the late delivery then reaches the room with no socket left.
    await runInDurableObject(current(base.stub), (room) =>
      room.webSocketClose(new WebSocketPair()[1])
    )
    expect(
      await runInDurableObject(current(base.stub), (_room, state) => state.storage.getAlarm())
    ).toBeNull()
  })
})

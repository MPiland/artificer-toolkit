import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeTrackedSockets, connectPlayer, fixture, ROOM_REPLY_WAIT } from './liveRoomFixture.js'
import { clearRoomAlarms } from './roomTeardown.js'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('room teardown', () => {
  it('cancels the idle-release alarm a closed room scheduled', async () => {
    const base = await fixture()
    await connectPlayer(base)
    const alarm = () => runInDurableObject(base.stub, (_room, state) => state.storage.getAlarm())

    closeTrackedSockets()
    await vi.waitFor(async () => expect(await alarm()).not.toBeNull(), ROOM_REPLY_WAIT)

    await clearRoomAlarms()
    expect(await alarm()).toBeNull()
  })
})

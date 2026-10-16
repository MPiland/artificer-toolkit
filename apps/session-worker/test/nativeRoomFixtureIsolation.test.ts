import { runInDurableObject } from 'cloudflare:test'
import { afterEach, expect, it, vi } from 'vitest'

import {
  closeTrackedSockets,
  doorScene,
  fixture,
  ROOM_REPLY_WAIT,
  routeEncounterRequests,
  secret,
  synchronizeScene
} from './liveRoomFixture.js'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * RELIABILITY-17: every room in a test file shares one `fetch`, so a room an earlier test left
 * draining still checkpoints through the next test's Convex fixture. That checkpoint must not
 * become the persisted authority the next room bootstraps from, or the room never activates.
 */
it("keeps an earlier room's checkpoint out of the next room's persisted authority", async () => {
  const earlierScene = doorScene(crypto.randomUUID()).scene
  const earlier = await fixture(earlierScene)
  const checkpoints: string[] = []
  await routeEncounterRequests(earlier, async (pathname, request) => {
    if (pathname === '/live-sessions/checkpoint') checkpoints.push(await request.text())
    return undefined
  })
  await synchronizeScene(earlier, earlierScene)
  await vi.waitFor(() => expect(checkpoints.length).toBeGreaterThan(0), ROOM_REPLY_WAIT)

  const nextScene = doorScene(crypto.randomUUID()).scene
  const next = await fixture(nextScene)
  await expect(
    runInDurableObject(next.stub, () =>
      fetch('https://native.test/live-sessions/checkpoint', {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': secret },
        body: checkpoints[0]
      })
    )
  ).rejects.toThrow()

  await synchronizeScene(next, nextScene)
})

import { runInDurableObject } from 'cloudflare:test'
import { afterEach, expect, it, vi } from 'vitest'

import { closeTrackedSockets, doorScene, fixture, secret, synchronizeScene } from './liveRoomFixture.js'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const checksum = (digit: string) => digit.repeat(64)

/**
 * RELIABILITY-17: every room in a test file shares one `fetch`, so a room an earlier test left
 * draining still checkpoints through the next test's Convex fixture. That checkpoint must not
 * become the persisted authority the next room bootstraps from, or the room never activates.
 */
it("keeps another room's checkpoint out of the next room's persisted authority", async () => {
  const scene = doorScene(crypto.randomUUID()).scene
  const next = await fixture(scene)
  const leaked = await runInDurableObject(next.stub, () =>
    fetch('https://native.test/live-sessions/checkpoint', {
      method: 'POST',
      headers: { 'x-artificer-live-session-secret': secret },
      body: JSON.stringify({
        campaignId: crypto.randomUUID(),
        epoch: crypto.randomUUID(),
        checkpointId: crypto.randomUUID(),
        fromSequence: 0,
        fromChecksum: checksum('b'),
        sequence: 3,
        checksum: checksum('c'),
        payloadChecksum: checksum('d'),
        records: { changes: [], history: [], scenes: [] },
        knownAuthorization: null,
        reason: 'DRAIN'
      })
    }).then(
      () => 'ACCEPTED',
      () => 'REFUSED'
    )
  )

  await synchronizeScene(next, scene)
  expect(leaked).toBe('REFUSED')
})

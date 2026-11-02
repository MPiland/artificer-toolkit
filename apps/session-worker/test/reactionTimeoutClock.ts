import { runInDurableObject } from 'cloudflare:test'
import { vi } from 'vitest'

import type { LiveRoomFixture } from './liveRoomFixture.js'

/** Past the 15 s the room fixtures give a reaction offer (D207), inside the authorization lease. */
const PAST_REACTION_TIME_MS = 16_000

/** Runs the room's alarm with its clock past the pending reaction offer's time, as the runtime would. */
export function expireReactionOffer(stub: LiveRoomFixture['stub']) {
  return runInDurableObject(stub, async (instance) => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + PAST_REACTION_TIME_MS)
    try {
      await instance.alarm()
    } finally {
      clock.mockRestore()
    }
  })
}

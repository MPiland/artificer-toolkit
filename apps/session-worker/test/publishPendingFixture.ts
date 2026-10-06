import { expect } from 'vitest'
import { LIVE_SESSION_CHECKPOINT_BARRIER_PATH } from '@artificer-toolkit/schema/api/liveSessions'

/**
 * Saves everything the room holds, as a save point would (no timer saves it, ADR 0035 Amendment 25),
 * and expects it to end with the given status.
 */
export async function publishPending(stub: DurableObjectStub, expectedStatus = 200) {
  const response = await stub.fetch(
    new Request(`https://live-session.internal${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}`, {
      method: 'POST'
    })
  )
  await response.arrayBuffer()
  expect(response.status).toBe(expectedStatus)
}

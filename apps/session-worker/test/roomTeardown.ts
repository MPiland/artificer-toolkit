import { runInDurableObject } from 'cloudflare:test'
import { vi } from 'vitest'

const rooms: DurableObjectStub[] = []

/** Remembers a room a test created so `clearRoomAlarms` cancels its alarm after the test. */
export function trackRoom(stub: DurableObjectStub) {
  rooms.push(stub)
}

/**
 * Cancels the alarm of every room the test created, once its sockets have closed. A closed room
 * schedules its idle release five minutes out; the suite outlasts that, so a leaked room would wake
 * during a later test, after the fetch mock is gone, and log its failed release into that test.
 */
export async function clearRoomAlarms(): Promise<void> {
  for (const stub of rooms.splice(0)) {
    // The room schedules its alarm when it handles a socket's close, so wait for that to finish.
    await vi
      .waitFor(
        () =>
          runInDurableObject(stub, async (_room, state) => {
            if (state.getWebSockets().some((socket) => socket.readyState === WebSocket.OPEN))
              throw new Error('A room socket is still open.')
          }),
        { timeout: 2_000 }
      )
      .catch(() => undefined)
    await runInDurableObject(stub, (_room, state) => state.storage.deleteAlarm())
  }
}

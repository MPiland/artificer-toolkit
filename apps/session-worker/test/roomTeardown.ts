import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { vi } from 'vitest'

const rooms: DurableObjectStub[] = []

/** How long teardown waits for a room to handle the closes of the sockets the test opened. */
const SOCKET_DETACH_MS = 5_000

/** Why teardown resets a room's instance, so it can tell that reset from a real failure. */
const TEARDOWN_RESET = 'Room teardown reset.'

/** The Live Session room named `name`; `clearRoomAlarms` cancels its alarm after the test. */
export function roomStub(name: string) {
  const stub = env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(name))
  rooms.push(stub)
  return stub
}

/**
 * Cancels the alarm of every room the test created and empties the room, once it holds no socket.
 * A closed room schedules its idle release five minutes out; the suite outlasts that, so a leaked
 * room would wake during a later test and send its release through that test's fetch mock, or log
 * its failure into that test's console spy.
 */
export async function clearRoomAlarms(): Promise<void> {
  for (const stub of rooms.splice(0)) {
    // Handling a close schedules the alarm, so deleting it before the room lets go of every socket
    // would leave a later close to re-arm it. A room still holding one fails the test instead.
    await vi.waitFor(
      () =>
        runInDurableObject(stub, (_room, state) => {
          if (state.getWebSockets().length > 0)
            throw new Error('A room still holds a socket after the test closed its sockets.')
        }),
      { timeout: SOCKET_DETACH_MS }
    )
    // The runtime drops a closing socket from `getWebSockets` before it delivers the close, so a
    // close can still reach the room after this and re-arm the idle release. Emptying storage and
    // resetting the instance leaves that close a room with no authority, which arms nothing.
    await runInDurableObject(stub, async (_room, state) => {
      await state.storage.deleteAlarm()
      await state.storage.deleteAll()
      state.abort(TEARDOWN_RESET)
    }).catch((error: unknown) => {
      if (!(error instanceof Error && error.message.includes(TEARDOWN_RESET))) throw error
    })
  }
}

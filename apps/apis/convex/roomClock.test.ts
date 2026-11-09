// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { useRealTimeClock } from '../tests/fixtures/localRoomWorker'

useRealTimeClock()

/** A real delay: the clock fixture fakes `setTimeout` per test, so keep the platform's own timer. */
const realSetTimeout = globalThis.setTimeout
const sleep = (ms: number) => new Promise<void>((resolve) => realSetTimeout(resolve, ms))

const realNow = () => performance.timeOrigin + performance.now()

// A Live-session ticket lasts 60 s on the Worker's real clock; the fake clock that stamps it must not lag.
it('keeps the fake clock on real time after the event loop stalls or the clock falls behind', async () => {
  vi.setSystemTime(realNow() - 61_000)
  await sleep(80)
  expect(Math.abs(Date.now() - realNow())).toBeLessThan(1_000)

  const stallUntil = performance.now() + 300
  while (performance.now() < stallUntil);
  await sleep(80)
  expect(Math.abs(Date.now() - realNow())).toBeLessThan(250)
})

/** Real time passes while the event loop keeps stalling, as it does under a busy convex-test build. */
async function stallFor(ms: number) {
  const until = performance.now() + ms
  while (performance.now() < until) {
    const stallUntil = Math.min(until, performance.now() + 100)
    while (performance.now() < stallUntil);
    await sleep(1)
  }
}

// fetch's connection pool times its keep-alive with this clock while servers close idle sockets on real
// time; a late timer reuses a socket the server already closed (`fetch failed`, or a room closed with 1006).
it('fires a timer on real time after the event loop stalls', async () => {
  const fired = vi.fn()
  setTimeout(fired, 500)
  await stallFor(1_000)
  expect(fired).toHaveBeenCalledOnce()
})

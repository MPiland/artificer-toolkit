// @vitest-environment node
import { setTimeout as sleep } from 'node:timers/promises'
import { expect, it, vi } from 'vitest'
import { useRealTimeClock } from '../tests/fixtures/localRoomWorker'

useRealTimeClock()

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

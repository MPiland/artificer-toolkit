import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

import { describe, expect, it, vi } from 'vitest'

setFlagsFromString('--expose-gc')
const collectGarbage = runInNewContext('gc') as () => void

function heapUsedAfterCollection(): number {
  collectGarbage()
  return process.memoryUsage().heapUsed
}

// A Convex isolate refuses its next request (IsolateNotClean) when less than 64 MiB of its 99 MiB
// heap is free, so a sign-up's username check must not leave a large structure behind.
describe('validateUsernameOnServer memory', () => {
  it('keeps no dictionary index alive after a compound check', async () => {
    vi.resetModules()
    const { validateUsernameOnServer } = await import('../domains/account/usernameServerPolicy.js')
    const before = heapUsedAfterCollection()

    expect(validateUsernameOnServer('titanslayer').message).toBeNull()
    expect(validateUsernameOnServer('assmuncher').message).not.toBeNull()

    expect(heapUsedAfterCollection() - before).toBeLessThan(1024 * 1024)
  })
})

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { startLocalEmailSink } from '../tests/localEmailSink'
import { startLocalR2 } from '../tests/localR2'

/** Holds the event loop the way a long synchronous stretch of test work does. */
function blockEventLoop(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

// The fixtures share the test's process, so a busy event loop delays the server as well as the
// client, and faked timers reach the client's connection pool.
describe.each([
  [
    'local R2',
    async () => {
      const r2 = await startLocalR2()
      return { health: `${r2.endpoint}/health`, close: r2.close }
    }
  ],
  [
    'local email sink',
    async () => {
      const sink = await startLocalEmailSink({ capacity: 1 })
      return { health: new URL('/health', sink.url).href, close: sink.close }
    }
  ]
])('the %s fixture', (_name, start) => {
  it('answers the next request after the event loop stalls past its idle time', async () => {
    const fixture = await start()
    try {
      expect((await fetch(fixture.health)).status).toBe(200)
      // Idle inside the client's reuse window, then send while the loop is held.
      await new Promise((done) => setTimeout(done, 2_500))
      const next = fetch(fixture.health).then((response) => response.status)
      await new Promise((done) => setImmediate(done))
      blockEventLoop(3_500)
      expect(await next).toBe(200)
    } finally {
      await fixture.close()
    }
  }, 30_000)

  it('answers the next request at once while the test fakes setTimeout', async () => {
    const fixture = await start()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      expect((await fetch(fixture.health)).status).toBe(200)
      const started = performance.now()
      expect((await fetch(fixture.health)).status).toBe(200)
      expect(performance.now() - started).toBeLessThan(2_000)
    } finally {
      vi.useRealTimers()
      await fixture.close()
    }
  }, 30_000)
})

// Storybook stories upload to the fixture straight from the browser, so its preflight must answer.
describe('the local R2 fixture CORS preflight', () => {
  const preflight = async (endpoint: string, origin: string) =>
    fetch(`${endpoint}/artificer-local-media/story.png`, {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'PUT' }
    })

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:6106',
    'http://localhost:6006'
  ])('allows %s', async (origin) => {
    const r2 = await startLocalR2()
    try {
      const response = await preflight(r2.endpoint, origin)
      expect(response.status).toBe(204)
      expect(response.headers.get('access-control-allow-origin')).toBe(origin)
      expect(response.headers.get('access-control-allow-methods')).toContain('PUT')
    } finally {
      await r2.close()
    }
  })

  it('does not allow another origin', async () => {
    const r2 = await startLocalR2()
    try {
      const response = await preflight(r2.endpoint, 'http://localhost:6007')
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    } finally {
      await r2.close()
    }
  })
})

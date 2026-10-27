import { afterAll, beforeAll } from 'vitest'
import { startLocalR2 } from './localR2'

/**
 * The shared test environment (`env` in vitest.config.ts) selects the product's local modes, so a
 * scheduled job finds a configured provider instead of a missing variable. The providers behind
 * those modes are answered here, per test file, so jobs that fire after the test that scheduled
 * them neither fail nor reach a real service: the local R2 fixture serves content snapshot
 * uploads, and the local email sink and the Live Session Worker's room control answer any request
 * with an empty success (204), which is all their callers read. A test that needs another answer
 * stubs the environment or `fetch` itself. Registered via `setupFiles`.
 */
const realFetch = globalThis.fetch

function originOf(value: string | URL | Request | undefined): string | null {
  try {
    return value === undefined ? null : new URL(value instanceof Request ? value.url : value).origin
  } catch {
    return null
  }
}

// The defaults the environment sets, read before any test stubs its own URL for the same variable.
const answeredOrigins = [process.env.LOCAL_EMAIL_SINK_URL, process.env.LIVE_SESSION_WORKER_URL].map(
  originOf
)

globalThis.fetch = (input, init) => {
  const target = originOf(input)
  return target !== null && answeredOrigins.includes(target)
    ? Promise.resolve(new Response(null, { status: 204 }))
    : realFetch(input, init)
}

let r2: Awaited<ReturnType<typeof startLocalR2>> | undefined

beforeAll(async () => {
  r2 = await startLocalR2()
  // Assigned, not stubbed: a test's `vi.unstubAllEnvs()` restores this value.
  process.env.LOCAL_R2_ENDPOINT = r2.endpoint
})

// A content snapshot build the file's last writes scheduled can still be reading when this runs;
// convex-test serves its queries without yielding to the event loop, so a full-SRD build delays the
// close by its remaining read phase (about 10-15 s), as it delays a test (`testTimeout`).
afterAll(async () => {
  await r2?.close()
}, 30_000)

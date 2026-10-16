/**
 * The shared test environment (`env` in vitest.config.ts) selects the product's local modes, which
 * address the local email sink and the Live Session Worker by loopback URL. Nothing listens there
 * in Vitest, so a scheduled send would fail with a connection error after the test that scheduled
 * it. This answers exactly those two origins with the success each service gives (204), and
 * passes every other request through. A test that needs another answer stubs `fetch` itself.
 * Registered via `setupFiles`.
 */
const realFetch = globalThis.fetch

function origin(value: string | URL | Request | undefined): string | null {
  try {
    return value === undefined || value === ''
      ? null
      : new URL(value instanceof Request ? value.url : value).origin
  } catch {
    return null
  }
}

globalThis.fetch = (input, init) => {
  const target = origin(input)
  const local =
    target !== null &&
    [process.env.LOCAL_EMAIL_SINK_URL, process.env.LIVE_SESSION_WORKER_URL].some(
      (configured) => origin(configured) === target
    )
  return local ? Promise.resolve(new Response(null, { status: 204 })) : realFetch(input, init)
}

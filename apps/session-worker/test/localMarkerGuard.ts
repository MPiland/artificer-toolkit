/**
 * The test runner hands the Worker the developer's ignored `.dev.vars` as bindings. The local marker
 * there turns on the local content-snapshot path, which refuses the suite's non-loopback Convex site
 * (fail closed by design), so every room activation would fail and each test wait for its timeout.
 * Names the key, never its value.
 */
export function assertNoLocalMarker(environment: { LOCAL_CONTENT_SNAPSHOT_ORIGIN?: string }) {
  if (environment.LOCAL_CONTENT_SNAPSHOT_ORIGIN === undefined) return
  throw new Error(
    'apps/session-worker/.dev.vars sets LOCAL_CONTENT_SNAPSHOT_ORIGIN, which the Session Worker tests must not inherit. Remove that key from the file (local development does not read it).'
  )
}

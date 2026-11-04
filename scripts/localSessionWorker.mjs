// The documented local Session Worker (apps/session-worker README), shared by `yarn dev:session-worker`
// and the local lifecycle. Its secrets are read in memory from the local Convex deployment, so the
// ignored .dev.vars carries none and never goes stale after a reset.
import { convexEnvironmentValue } from './convexSelfHosted.mjs'

export const localSessionWorker = { host: '127.0.0.1', port: 8787 }

const secretNames = [
  'LIVE_SESSION_TICKET_SECRET',
  'LIVE_SESSION_WORKER_SECRET',
  'CONTENT_SNAPSHOT_TOKEN_SECRET'
]

/**
 * The Worker's bindings, which Wrangler reads from process.env (CLOUDFLARE_INCLUDE_PROCESS_ENV).
 * Needs CONVEX_SELF_HOSTED_URL and a generated CONVEX_SELF_HOSTED_ADMIN_KEY; the values are never
 * logged or written.
 */
export async function localSessionWorkerBindings(convexSiteUrl) {
  const secrets = await Promise.all(
    secretNames.map(async (name) => [name, await convexEnvironmentValue(name)])
  )
  return {
    ...Object.fromEntries(secrets),
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
    CONVEX_SITE_URL: convexSiteUrl,
    // The local R2 fixture in the Convex container, where Convex writes content snapshots.
    LOCAL_CONTENT_SNAPSHOT_ORIGIN: 'http://127.0.0.1:8026',
    LIVE_SESSION_ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000'
  }
}

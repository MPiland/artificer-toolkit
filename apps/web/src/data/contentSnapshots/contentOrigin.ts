import { LOCAL_SESSION_WORKER_URL, toSessionWorkerOrigins } from '#app/lib/sessionWorkerOrigin'

const configuredWorkerUrl =
  import.meta.env.VITE_LIVE_SESSION_WEBSOCKET_URL ??
  (import.meta.env.DEV ? LOCAL_SESSION_WORKER_URL : null)

/** The session Worker origin that serves content snapshots (ADR 0036), when one is configured. */
export const contentOrigin = configuredWorkerUrl
  ? (toSessionWorkerOrigins(configuredWorkerUrl)?.http ?? null)
  : null

/** The local session Worker (`yarn dev:session-worker`), used in development when none is configured. */
export const LOCAL_SESSION_WORKER_URL = 'ws://127.0.0.1:8787'

/**
 * The session Worker's WebSocket and HTTP origins from its configured URL (`ws`, `wss`, `http` or
 * `https`). The Worker serves live play over WebSocket and content snapshots over HTTP (ADR 0036).
 */
export function toSessionWorkerOrigins(
  configured: string
): { socket: string; http: string } | null {
  try {
    const url = new URL(configured)
    const secure = url.protocol === 'wss:' || url.protocol === 'https:'
    if (!secure && url.protocol !== 'ws:' && url.protocol !== 'http:') return null
    return {
      socket: `${secure ? 'wss' : 'ws'}://${url.host}`,
      http: `${secure ? 'https' : 'http'}://${url.host}`
    }
  } catch {
    return null
  }
}

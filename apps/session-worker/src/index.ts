import {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL
} from '@artificer-toolkit/schema/api/liveSessions'

import { allowedOrigins, type SessionWorkerEnvironment } from './environment.js'
import { LiveSessionRoom } from './liveSessionRoom.js'
import { verifyLiveSessionTicket } from './ticket.js'

const INTERNAL_TICKET_HEADER = 'x-artificer-live-session-ticket'

function offeredProtocols(request: Request): string[] {
  return (request.headers.get('sec-websocket-protocol') ?? '')
    .split(',')
    .map((protocol) => protocol.trim())
    .filter(Boolean)
}

function liveSessionTicket(request: Request): string | null {
  const protocols = offeredProtocols(request)
  if (!protocols.includes(LIVE_SESSION_WEBSOCKET_PROTOCOL)) return null
  return (
    protocols
      .find((protocol) => protocol.startsWith(LIVE_SESSION_TICKET_PROTOCOL_PREFIX))
      ?.slice(LIVE_SESSION_TICKET_PROTOCOL_PREFIX.length) ?? null
  )
}

function originAllowed(request: Request, environment: SessionWorkerEnvironment): boolean {
  const origin = request.headers.get('origin')
  return origin !== null && allowedOrigins(environment).has(origin)
}

const worker: ExportedHandler<SessionWorkerEnvironment> = {
  async fetch(request, environment): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
    }
    const path = url.pathname.match(new RegExp(`^${LIVE_SESSION_PATH_PREFIX}/([^/]+)$`))
    if (!path) return new Response('Not found.', { status: 404 })
    if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade.', { status: 426 })
    }
    if (!originAllowed(request, environment)) {
      return new Response('WebSocket origin is not allowed.', { status: 403 })
    }
    const ticket = liveSessionTicket(request)
    if (!ticket) return new Response('Live-session ticket is missing.', { status: 401 })

    try {
      const claims = await verifyLiveSessionTicket(ticket, environment.LIVE_SESSION_TICKET_SECRET)
      if (claims.sessionId !== path[1]) {
        return new Response('Live-session ticket does not match the requested room.', {
          status: 403
        })
      }
      const headers = new Headers(request.headers)
      headers.set(INTERNAL_TICKET_HEADER, ticket)
      const objectId = environment.LIVE_SESSION_ROOMS.idFromName(
        `${claims.campaignId}:${claims.sessionId}`
      )
      return environment.LIVE_SESSION_ROOMS.get(objectId).fetch(new Request(request, { headers }))
    } catch {
      return new Response('Live-session ticket is invalid.', { status: 401 })
    }
  }
}

export { LiveSessionRoom }
export default worker

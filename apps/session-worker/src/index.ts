import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionControlInputSchema
} from '@artificer-toolkit/schema/api/liveSessions'

import { CONTENT_SNAPSHOT_PATH_PREFIX } from '@artificer-toolkit/schema/api/contentSnapshots'

import { serveContentSnapshot } from './contentSnapshots.js'
import { allowedOrigins, type SessionWorkerEnvironment } from './environment.js'
import { NativeLiveSessionRoom as LiveSessionRoom } from './nativeLiveSessionRoom.js'
import { ROOM_METER_PATH } from './roomMeter.js'
import { verifyLiveSessionTicket } from './ticket.js'

const INTERNAL_TICKET_HEADER = 'x-artificer-live-session-ticket'

function secretMatches(supplied: string, expected: string): boolean {
  const encoder = new TextEncoder()
  const suppliedBytes = encoder.encode(supplied)
  const expectedBytes = encoder.encode(expected)
  return (
    suppliedBytes.byteLength === expectedBytes.byteLength &&
    crypto.subtle.timingSafeEqual(suppliedBytes, expectedBytes)
  )
}

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
    if (url.pathname.startsWith(CONTENT_SNAPSHOT_PATH_PREFIX))
      return serveContentSnapshot(request, environment)
    if (request.method === 'POST' && url.pathname === LIVE_SESSION_CONTROL_PATH) {
      const secret = environment.LIVE_SESSION_WORKER_SECRET
      if (!secret || new TextEncoder().encode(secret).byteLength < 32)
        return new Response('Live Session control unavailable.', { status: 503 })
      const supplied = request.headers.get(LIVE_SESSION_CONTROL_SECRET_HEADER)
      if (!supplied || !secretMatches(supplied, secret))
        return new Response('Unauthorized.', { status: 401 })
      const parsed = liveSessionControlInputSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success)
        return new Response('Invalid live-session control request.', { status: 400 })
      const objectId = environment.LIVE_SESSION_ROOMS.idFromName(parsed.data.campaignId)
      return environment.LIVE_SESSION_ROOMS.get(objectId).fetch(
        new Request(`https://live-session.internal${LIVE_SESSION_CONTROL_PATH}`, {
          body: JSON.stringify(parsed.data),
          headers: { 'content-type': 'application/json' },
          method: 'POST'
        })
      )
    }
    const meter = url.pathname.match(new RegExp(`^${ROOM_METER_PATH}/([^/]+)$`))
    if (meter) {
      // Development only: the local-origin marker is absent from every deployed environment.
      const secret = environment.LIVE_SESSION_WORKER_SECRET
      if (
        request.method !== 'GET' ||
        environment.LOCAL_CONTENT_SNAPSHOT_ORIGIN !== 'http://127.0.0.1:8026' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      )
        return new Response('Not found.', { status: 404 })
      const supplied = request.headers.get(LIVE_SESSION_CONTROL_SECRET_HEADER)
      if (!secret || !supplied || !secretMatches(supplied, secret))
        return new Response('Unauthorized.', { status: 401 })
      const objectId = environment.LIVE_SESSION_ROOMS.idFromName(meter[1])
      return environment.LIVE_SESSION_ROOMS.get(objectId).fetch(
        new Request(`https://live-session.internal${ROOM_METER_PATH}`)
      )
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
      if (claims.campaignId !== path[1]) {
        return new Response('Live-session ticket does not match the requested room.', {
          status: 403
        })
      }
      const headers = new Headers(request.headers)
      headers.set(INTERNAL_TICKET_HEADER, ticket)
      const objectId = environment.LIVE_SESSION_ROOMS.idFromName(claims.campaignId)
      return environment.LIVE_SESSION_ROOMS.get(objectId).fetch(new Request(request, { headers }))
    } catch {
      return new Response('Live-session ticket is invalid.', { status: 401 })
    }
  }
}

export { LiveSessionRoom }
export default worker

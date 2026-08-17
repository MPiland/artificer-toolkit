import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http'
import type { Duplex } from 'node:stream'

import { verifyLiveSessionTicket } from '@artificer-toolkit/functions/services'
import {
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  type LiveSessionTicketClaimsDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { WebSocketServer } from 'ws'

import {
  createLiveSessionRoomDependencies,
  type LiveSessionRoomDependencies
} from './dependencies.js'
import {
  LiveSessionRuntimeManager,
  liveSessionAuthFromTicket,
  type LiveSessionClient
} from './liveSessionRoom.js'
import { resolveSessionHostAllowedOrigins, resolveSessionHostTicketSecret } from './config.js'

export const SESSION_HOST_HEALTH_PATH = '/health'

const MAX_MESSAGE_BYTES = 256 * 1024

export function getSessionHostHealth() {
  return {
    service: 'artificer-session-host',
    status: 'ok'
  } as const
}

function closeHttpServer(server: HttpServer): Promise<void> {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function protocols(request: IncomingMessage): string[] {
  const raw = request.headers['sec-websocket-protocol']
  return (Array.isArray(raw) ? raw.join(',') : (raw ?? ''))
    .split(',')
    .map((protocol) => protocol.trim())
    .filter(Boolean)
}

function ticketFrom(request: IncomingMessage): string | null {
  const offered = protocols(request)
  if (!offered.includes(LIVE_SESSION_WEBSOCKET_PROTOCOL)) return null
  return (
    offered
      .find((protocol) => protocol.startsWith(LIVE_SESSION_TICKET_PROTOCOL_PREFIX))
      ?.slice(LIVE_SESSION_TICKET_PROTOCOL_PREFIX.length) ?? null
  )
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  if (!socket.writable) return
  socket.end(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`
  )
}

function sessionIdFrom(request: IncomingMessage): string | null {
  const path = new URL(request.url ?? '/', 'http://session-host.local').pathname.match(
    new RegExp(`^${LIVE_SESSION_PATH_PREFIX}/([^/]+)$`)
  )
  return path?.[1] ?? null
}

export function createSessionHostServer(
  dependencies: LiveSessionRoomDependencies = createLiveSessionRoomDependencies(),
  options: {
    allowedOrigins?: string[]
    authorityRenewalMs?: number
    reconnectGraceMs?: number
    ticketSecret?: string
  } = {}
) {
  const allowedOrigins = new Set(options.allowedOrigins ?? resolveSessionHostAllowedOrigins())
  const ticketSecret = options.ticketSecret ?? resolveSessionHostTicketSecret()
  const consumedTickets = new Map<string, number>()
  const runtimeManager = new LiveSessionRuntimeManager(dependencies, {
    ...(options.authorityRenewalMs === undefined
      ? {}
      : { authorityRenewalMs: options.authorityRenewalMs }),
    ...(options.reconnectGraceMs === undefined
      ? {}
      : { reconnectGraceMs: options.reconnectGraceMs })
  })
  const httpServer = createServer((request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8')
    if (request.method === 'GET' && request.url === SESSION_HOST_HEALTH_PATH) {
      response.statusCode = 200
      response.end(JSON.stringify(getSessionHostHealth()))
      return
    }
    response.statusCode = 404
    response.end(JSON.stringify({ error: 'Not found.' }))
  })
  const webSocketServer = new WebSocketServer({
    handleProtocols(offered) {
      return offered.has(LIVE_SESSION_WEBSOCKET_PROTOCOL) ? LIVE_SESSION_WEBSOCKET_PROTOCOL : false
    },
    maxPayload: MAX_MESSAGE_BYTES,
    noServer: true,
    perMessageDeflate: false
  })
  let closing = false

  async function authenticateUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): Promise<void> {
    if (closing) {
      rejectUpgrade(socket, 503, 'Service unavailable.')
      return
    }
    const sessionId = sessionIdFrom(request)
    if (!sessionId) {
      rejectUpgrade(socket, 404, 'Not found.')
      return
    }
    const origin = request.headers.origin
    if (!origin || !allowedOrigins.has(origin)) {
      rejectUpgrade(socket, 403, 'WebSocket origin is not allowed.')
      return
    }
    const ticket = ticketFrom(request)
    if (!ticket) {
      rejectUpgrade(socket, 401, 'Live-session ticket is missing.')
      return
    }

    let claims: LiveSessionTicketClaimsDto
    try {
      claims = await verifyLiveSessionTicket(ticket, ticketSecret)
    } catch {
      rejectUpgrade(socket, 401, 'Live-session ticket is invalid.')
      return
    }
    if (claims.sessionId !== sessionId) {
      rejectUpgrade(socket, 403, 'Live-session ticket does not match the requested room.')
      return
    }

    const now = Math.floor(Date.now() / 1_000)
    for (const [ticketId, expiresAt] of consumedTickets) {
      if (expiresAt <= now) consumedTickets.delete(ticketId)
    }
    if (consumedTickets.has(claims.jti)) {
      rejectUpgrade(socket, 409, 'Live-session ticket was already used.')
      return
    }
    consumedTickets.set(claims.jti, claims.exp)

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      const client: LiveSessionClient = {
        auth: liveSessionAuthFromTicket(claims),
        id: randomUUID(),
        socket: webSocket
      }
      void runtimeManager.join(client).catch(() => {
        webSocket.close(1011, 'Live-session admission failed.')
      })
    })
  }

  httpServer.on('upgrade', (request, socket, head) => {
    void authenticateUpgrade(request, socket, head).catch(() => {
      rejectUpgrade(socket, 500, 'Live-session upgrade failed.')
    })
  })

  let shutdown: Promise<void> | null = null
  return {
    httpServer,
    webSocketServer,
    listen(port: number): Promise<void> {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject)
        httpServer.listen(port, () => {
          httpServer.off('error', reject)
          resolve()
        })
      })
    },
    gracefullyShutdown(_exitProcess = false): Promise<void> {
      shutdown ??= (async () => {
        closing = true
        await runtimeManager.dispose()
        await new Promise<void>((resolve) => webSocketServer.close(() => resolve()))
        await closeHttpServer(httpServer)
        await dependencies.dispose?.()
      })()
      return shutdown
    }
  }
}

export type SessionHostServer = ReturnType<typeof createSessionHostServer>

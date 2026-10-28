import { LIVE_SESSION_REAUTHENTICATION_LEAD_MS } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import {
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { expect as playwrightExpect, type Page } from '@playwright/test'
import { isDeepStrictEqual } from 'node:util'

const expect = playwrightExpect.configure({ timeout: 30_000 })

type NativeLiveSessionSocketTrace = {
  expectedOrigin: string
  connections: NativeLiveSessionConnectionTrace[]
  framesReceived: string[]
  framesSent: string[]
  opened: number
  closed: number
  observedEndpoints: string[]
  urls: string[]
}

type NativeLiveSessionFrame = {
  atMs: number
  direction: 'received' | 'sent'
  payload: string
}

type NativeLiveSessionConnectionTrace = {
  frames: NativeLiveSessionFrame[]
}

type NativeLiveSessionAuthenticationRefreshEvidence = {
  authenticationCount: number
  initialExpiresAt: number
  messageOrder: ['AUTHENTICATION_REQUIRED', 'AUTHENTICATE', 'TRANSIENT_READY']
  refreshedExpiresAt: number
}

function socketOrigin(endpoint: string): string {
  const value = new URL(endpoint)
  value.protocol = value.protocol === 'https:' || value.protocol === 'wss:' ? 'wss:' : 'ws:'
  return value.origin
}

/** Observe the browser's real Worker WebSocket; this deliberately does not route or mock it. */
export function traceNativeLiveSessionSockets(
  page: Page,
  endpoint: string
): NativeLiveSessionSocketTrace {
  const trace: NativeLiveSessionSocketTrace = {
    expectedOrigin: socketOrigin(endpoint),
    connections: [],
    framesReceived: [],
    framesSent: [],
    opened: 0,
    closed: 0,
    observedEndpoints: [],
    urls: []
  }
  page.on('websocket', (socket) => {
    const url = new URL(socket.url())
    trace.observedEndpoints.push(`${url.origin}/${url.pathname.split('/')[1] ?? ''}`)
    if (url.origin !== trace.expectedOrigin || !url.pathname.startsWith('/live-session/')) return
    trace.opened += 1
    trace.urls.push(socket.url())
    const connection: NativeLiveSessionConnectionTrace = { frames: [] }
    trace.connections.push(connection)
    socket.on('framereceived', ({ payload }) => {
      const frame = payload.toString()
      trace.framesReceived.push(frame)
      connection.frames.push({ atMs: Date.now(), direction: 'received', payload: frame })
    })
    socket.on('framesent', ({ payload }) => {
      const frame = payload.toString()
      trace.framesSent.push(frame)
      connection.frames.push({ atMs: Date.now(), direction: 'sent', payload: frame })
    })
    socket.on('close', () => {
      trace.closed += 1
    })
  })
  return trace
}

export async function expectNativeLiveSessionTraffic(
  trace: NativeLiveSessionSocketTrace
): Promise<void> {
  await expect
    .poll(() => trace.framesReceived.length, { message: 'Received Worker WebSocket frames' })
    .toBeGreaterThan(0)
  await expect
    .poll(() => trace.framesSent.length, { message: 'Sent Worker WebSocket frames' })
    .toBeGreaterThan(0)
}

export async function expectNativeLiveSessionMessage(
  trace: NativeLiveSessionSocketTrace,
  type: LiveSessionWebSocketServerMessageDto['type']
): Promise<void> {
  await expect
    .poll(() =>
      trace.framesReceived.some((frame) => {
        try {
          return liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(frame)).type === type
        } catch {
          return false
        }
      })
    )
    .toBe(true)
}

export function expectNativeLiveSessionPrivacy(
  trace: NativeLiveSessionSocketTrace,
  ...forbiddenTexts: string[]
): void {
  for (const forbiddenText of forbiddenTexts)
    expect(trace.framesReceived.some((frame) => frame.includes(forbiddenText))).toBe(false)
}

export async function expectNativeLiveSessionAuthenticationRefresh(
  trace: NativeLiveSessionSocketTrace
): Promise<NativeLiveSessionAuthenticationRefreshEvidence> {
  await expect.poll(() => trace.connections.length).toBeGreaterThan(0)
  let initial: InitialLiveSessionAuthentication | undefined
  await expect
    .poll(() => {
      initial = trace.connections.flatMap(initialLiveSessionAuthentication)[0]
      return initial !== undefined
    })
    .toBe(true)
  const waitMs = initial!.expiresAt - Date.now() + 30_000
  if (waitMs < 0 || waitMs > 16 * 60_000)
    throw new Error('Live-session authentication expiry was outside the expected bounded window.')
  let evidence: NativeLiveSessionAuthenticationRefreshEvidence | undefined
  await expect
    .poll(
      () => {
        evidence = refreshedAuthenticationEvidence(
          initial!.connection,
          initial!.token,
          initial!.expiresAt
        )
        return evidence !== undefined
      },
      { intervals: [1_000, 5_000, 10_000], timeout: waitMs }
    )
    .toBe(true)
  return evidence!
}

function initialLiveSessionAuthentication(
  connection: NativeLiveSessionConnectionTrace
): InitialLiveSessionAuthentication[] {
  const authentication = connection.frames.find(
    (frame) => frame.direction === 'sent' && authenticatedToken(frame.payload) !== null
  )
  if (!authentication) return []
  const token = authenticatedToken(authentication.payload)
  if (token === null) return []
  const ready = connection.frames.findIndex(
    (frame, index) =>
      index > connection.frames.indexOf(authentication) &&
      frame.direction === 'received' &&
      serverMessageType(frame.payload) === 'TRANSIENT_READY'
  )
  if (ready < 0) return []
  return [{ connection, expiresAt: jwtExpiry(token), token }]
}

type InitialLiveSessionAuthentication = {
  connection: NativeLiveSessionConnectionTrace
  expiresAt: number
  token: string
}

function refreshedAuthenticationEvidence(
  connection: NativeLiveSessionConnectionTrace,
  initialToken: string,
  initialExpiresAt: number
): NativeLiveSessionAuthenticationRefreshEvidence | undefined {
  const challenge = connection.frames.findIndex(
    (frame) =>
      frame.direction === 'received' &&
      // The room challenges each socket at its own expiry minus the lead (ADR 0035 Amendment 23).
      frame.atMs >= initialExpiresAt - LIVE_SESSION_REAUTHENTICATION_LEAD_MS &&
      frame.atMs < initialExpiresAt &&
      serverMessageType(frame.payload) === 'AUTHENTICATION_REQUIRED'
  )
  if (challenge < 0) return undefined
  const refreshed = connection.frames.find(
    (frame, index) =>
      index > challenge && frame.direction === 'sent' && authenticatedToken(frame.payload) !== null
  )
  if (!refreshed) return undefined
  const refreshedToken = authenticatedToken(refreshed.payload)
  if (refreshedToken === null || refreshedToken === initialToken) return undefined
  const refreshedExpiresAt = jwtExpiry(refreshedToken)
  if (refreshedExpiresAt <= initialExpiresAt) return undefined
  const ready = connection.frames.findIndex(
    (frame, index) =>
      index > connection.frames.indexOf(refreshed) &&
      frame.direction === 'received' &&
      serverMessageType(frame.payload) === 'TRANSIENT_READY'
  )
  if (ready < 0) return undefined
  return {
    authenticationCount: connection.frames.filter(
      (frame) => frame.direction === 'sent' && authenticatedToken(frame.payload) !== null
    ).length,
    initialExpiresAt,
    messageOrder: ['AUTHENTICATION_REQUIRED', 'AUTHENTICATE', 'TRANSIENT_READY'],
    refreshedExpiresAt
  }
}

export function nativeLiveSessionMessageCount(
  trace: NativeLiveSessionSocketTrace,
  type: LiveSessionWebSocketServerMessageDto['type']
): number {
  return trace.framesReceived.filter((frame) => serverMessageType(frame) === type).length
}

/** Retain protocol timing and version evidence without tokens or user content. */
export function nativeLiveSessionFrameSummary(trace: NativeLiveSessionSocketTrace) {
  return trace.connections
    .flatMap((connection) => connection.frames)
    .slice(-40)
    .map((frame) => {
      const parsed =
        frame.direction === 'sent'
          ? liveSessionWebSocketClientMessageDtoSchema.safeParse(JSON.parse(frame.payload))
          : liveSessionWebSocketServerMessageDtoSchema.safeParse(JSON.parse(frame.payload))
      const message = parsed.success ? parsed.data : null
      const envelope =
        message?.type === 'TRANSIENT'
          ? 'envelope' in message
            ? message.envelope
            : message.message.envelope
          : null
      return {
        atMs: frame.atMs,
        direction: frame.direction,
        type: message?.type ?? 'INVALID',
        ...(envelope
          ? {
              kind: envelope.kind,
              sequence: envelope.sequence,
              baselineVersion: envelope.baselineVersion
            }
          : {})
      }
    })
}

function authenticatedToken(frame: string): string | null {
  try {
    const message = liveSessionWebSocketClientMessageDtoSchema.safeParse(JSON.parse(frame))
    return message.success && message.data.type === 'AUTHENTICATE' ? message.data.accessToken : null
  } catch {
    return null
  }
}

function serverMessageType(frame: string): LiveSessionWebSocketServerMessageDto['type'] | null {
  try {
    const message = liveSessionWebSocketServerMessageDtoSchema.safeParse(JSON.parse(frame))
    return message.success ? message.data.type : null
  } catch {
    return null
  }
}

function jwtExpiry(token: string): number {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Live-session access token did not contain a JWT payload.')
  const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (
    typeof value !== 'object' ||
    value === null ||
    !('exp' in value) ||
    typeof value.exp !== 'number' ||
    !Number.isFinite(value.exp)
  )
    throw new Error('Live-session access token did not contain a valid expiry.')
  return value.exp * 1_000
}

export async function expectNativeLiveSessionClosed(
  trace: NativeLiveSessionSocketTrace,
  minimumClosed = 1
): Promise<void> {
  await expect.poll(() => trace.closed, { timeout: 30_000 }).toBeGreaterThanOrEqual(minimumClosed)
}

export async function expectNativeLiveSessionSocket(
  trace: NativeLiveSessionSocketTrace,
  endpoint: string
): Promise<void> {
  const expectedOrigin = socketOrigin(endpoint)
  await expect
    .poll(() => trace.opened, { message: `Worker WebSocket opened at ${expectedOrigin}` })
    .toBeGreaterThan(0)
  expect(trace.urls.every((value) => new URL(value).origin === expectedOrigin)).toBe(true)
}

export async function expectNativePingFanout(
  sender: NativeLiveSessionSocketTrace,
  recipient: NativeLiveSessionSocketTrace,
  sentAfter: number,
  ping: () => Promise<void>
): Promise<void> {
  await expect
    .poll(
      async () => {
        await ping()
        const sent = sender.framesSent.slice(sentAfter).flatMap((frame) => {
          const value = liveSessionWebSocketClientMessageDtoSchema.safeParse(JSON.parse(frame))
          return value.success &&
            value.data.type === 'TRANSIENT' &&
            value.data.envelope.kind === 'PING'
            ? [value.data.envelope]
            : []
        })
        return recipient.framesReceived
          .flatMap((frame) => {
            const value = liveSessionWebSocketServerMessageDtoSchema.safeParse(JSON.parse(frame))
            return value.success && value.data.type === 'TRANSIENT'
              ? [value.data.message.envelope]
              : []
          })
          .some((received) => sent.some((envelope) => isDeepStrictEqual(received, envelope)))
      },
      { intervals: [1_000], timeout: 30_000 }
    )
    .toBe(true)
}

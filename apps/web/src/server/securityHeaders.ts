import { LOCAL_SESSION_WORKER_URL, toSessionWorkerOrigins } from '#app/lib/sessionWorkerOrigin'

interface SecurityHeaderOptions {
  nonce?: string
}

interface WithSecurityHeadersOptions extends SecurityHeaderOptions {
  preserveExisting?: boolean
}

// Vite inlines the build mode, so a deployed Worker never depends on a runtime NODE_ENV (ADR 0037).
function isDevelopment() {
  return import.meta.env.MODE === 'development'
}

// Development and local proof builds reach the loopback Convex backend and media substitute over HTTP.
function allowsLoopbackHttp() {
  return isDevelopment() || import.meta.env.MODE === 'proof'
}

function getSentryConnectSource() {
  const dsn = process.env.VITE_SENTRY_DSN ?? import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return []

  try {
    const url = new URL(dsn)
    return url.protocol === 'https:' ? [url.origin] : []
  } catch {
    return []
  }
}

function getConvexConnectSources() {
  const configured = process.env.VITE_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL
  if (!configured) return []
  try {
    const url = new URL(configured)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(allowsLoopbackHttp() && local && url.protocol === 'http:'))
      return []
    return [url.origin, `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`]
  } catch {
    return []
  }
}

/** Live play over WebSocket and content snapshot reads over HTTP, both on the session Worker. */
function getSessionWorkerConnectSources() {
  const configured =
    process.env.VITE_LIVE_SESSION_WEBSOCKET_URL ?? import.meta.env.VITE_LIVE_SESSION_WEBSOCKET_URL
  const origins = configured
    ? toSessionWorkerOrigins(configured)
    : isDevelopment()
      ? toSessionWorkerOrigins(LOCAL_SESSION_WORKER_URL)
      : null
  return origins ? [origins.socket, origins.http] : []
}

function getMediaStorageSource() {
  const configured =
    process.env.VITE_MEDIA_STORAGE_ORIGIN ?? import.meta.env.VITE_MEDIA_STORAGE_ORIGIN
  if (!configured) return []

  try {
    const url = new URL(configured)
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    const isAllowedProtocol =
      url.protocol === 'https:' || (allowsLoopbackHttp() && isLoopback && url.protocol === 'http:')
    if (
      !isAllowedProtocol ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    )
      return []
    return [url.origin]
  } catch {
    return []
  }
}

function getConnectSrc() {
  return [
    "connect-src 'self' blob:",
    ...getConvexConnectSources(),
    ...getSentryConnectSource(),
    ...getSessionWorkerConnectSources(),
    ...getMediaStorageSource()
  ].join(' ')
}

function getImgSrc() {
  return ["img-src 'self' data: blob:", ...getMediaStorageSource()].join(' ')
}

interface CspTemplate {
  environment: string
  beforeNonce: string
  afterNonce: string
}

let cspTemplate: CspTemplate | undefined

// Everything except the per-response nonce depends only on build mode and deployment variables, so
// each isolate builds it once. The key is the raw inputs, so a changed environment rebuilds it.
function getCspTemplate(): CspTemplate {
  const environment = [
    import.meta.env.MODE,
    process.env.VITE_SENTRY_DSN ?? import.meta.env.VITE_SENTRY_DSN,
    process.env.VITE_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL,
    process.env.VITE_LIVE_SESSION_WEBSOCKET_URL ?? import.meta.env.VITE_LIVE_SESSION_WEBSOCKET_URL,
    process.env.VITE_MEDIA_STORAGE_ORIGIN ?? import.meta.env.VITE_MEDIA_STORAGE_ORIGIN
  ].join('\n')
  if (cspTemplate?.environment === environment) return cspTemplate
  cspTemplate = {
    environment,
    beforeNonce: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      getImgSrc(),
      "font-src 'self' data:",
      getConnectSrc(),
      "script-src 'self'"
    ].join('; '),
    afterNonce: [
      isDevelopment() ? "'wasm-unsafe-eval' 'unsafe-eval'" : "'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:"
    ].join('; ')
  }
  return cspTemplate
}

function getCsp({ nonce }: SecurityHeaderOptions = {}) {
  const { beforeNonce, afterNonce } = getCspTemplate()
  return `${beforeNonce}${nonce ? ` 'nonce-${nonce}'` : ''} ${afterNonce}`
}

const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=(self)',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  'publickey-credentials-get=(self)',
  'usb=()',
  'xr-spatial-tracking=()'
].join(', ')

const STATIC_SECURITY_HEADERS = {
  'Permissions-Policy': PERMISSIONS_POLICY,
  'Referrer-Policy': 'strict-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
} as const

const SECURITY_HEADER_NAMES = ['Content-Security-Policy', ...Object.keys(STATIC_SECURITY_HEADERS)]

export function createSecurityHeaders(options: SecurityHeaderOptions = {}) {
  return { 'Content-Security-Policy': getCsp(options), ...STATIC_SECURITY_HEADERS } as const
}

export function withSecurityHeaders(
  response: Response,
  { preserveExisting = false, ...options }: WithSecurityHeadersOptions = {}
): Response {
  // A response that already carries every header (the request middleware set them with its nonce)
  // is final: do not rebuild the policy or copy the response.
  if (preserveExisting && SECURITY_HEADER_NAMES.every((name) => response.headers.has(name))) {
    return response
  }
  const headers = new Headers(response.headers)

  for (const [name, value] of Object.entries(createSecurityHeaders(options))) {
    if (preserveExisting && headers.has(name)) continue
    headers.set(name, value)
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  })
}

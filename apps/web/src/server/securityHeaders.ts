interface SecurityHeaderOptions {
  nonce?: string
}

interface WithSecurityHeadersOptions extends SecurityHeaderOptions {
  preserveExisting?: boolean
}

function isDevelopment() {
  return process.env.NODE_ENV !== 'production'
}

function getScriptSrc(nonce?: string) {
  return [
    "script-src 'self'",
    nonce ? `'nonce-${nonce}'` : null,
    "'wasm-unsafe-eval'",
    isDevelopment() ? "'unsafe-eval'" : null
  ]
    .filter(Boolean)
    .join(' ')
}

function getStyleSrc() {
  return "style-src 'self' 'unsafe-inline'"
}

function getSentryConnectSource() {
  const dsn = process.env.VITE_SENTRY_DSN
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
    if (url.protocol !== 'https:' && !(isDevelopment() && local && url.protocol === 'http:'))
      return []
    return [url.origin, `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`]
  } catch {
    return []
  }
}

function getLiveSessionConnectSource() {
  const configured =
    process.env.VITE_LIVE_SESSION_WEBSOCKET_URL ?? import.meta.env.VITE_LIVE_SESSION_WEBSOCKET_URL
  if (!configured) return isDevelopment() ? ['ws://127.0.0.1:8787'] : []

  try {
    const url = new URL(configured)
    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol === 'https:') url.protocol = 'wss:'
    return url.protocol === 'ws:' || url.protocol === 'wss:' ? [url.origin] : []
  } catch {
    return []
  }
}

function getMediaStorageSource() {
  const configured =
    process.env.VITE_MEDIA_STORAGE_ORIGIN ?? import.meta.env.VITE_MEDIA_STORAGE_ORIGIN
  if (!configured) return []

  try {
    const url = new URL(configured)
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    const isAllowedProtocol =
      url.protocol === 'https:' || (isDevelopment() && isLoopback && url.protocol === 'http:')
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
    ...getLiveSessionConnectSource(),
    ...getMediaStorageSource()
  ].join(' ')
}

function getImgSrc() {
  return ["img-src 'self' data: blob:", ...getMediaStorageSource()].join(' ')
}

function getCsp({ nonce }: SecurityHeaderOptions = {}) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    getImgSrc(),
    "font-src 'self' data:",
    getConnectSrc(),
    getScriptSrc(nonce),
    getStyleSrc(),
    "worker-src 'self' blob:"
  ].join('; ')
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

export function createSecurityHeaders(options: SecurityHeaderOptions = {}) {
  return {
    'Content-Security-Policy': getCsp(options),
    'Permissions-Policy': PERMISSIONS_POLICY,
    'Referrer-Policy': 'strict-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  } as const
}

export const SECURITY_HEADERS = createSecurityHeaders()

export function withSecurityHeaders(
  response: Response,
  { preserveExisting = false, ...options }: WithSecurityHeadersOptions = {}
): Response {
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

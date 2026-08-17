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

const SUPABASE_CONNECT_SOURCES = ['https://*.supabase.co', 'wss://*.supabase.co'] as const

const LOCAL_SUPABASE_CONNECT_SOURCES = [
  'http://127.0.0.1:54321',
  'http://localhost:54321',
  'ws://127.0.0.1:54321',
  'ws://localhost:54321'
] as const

function getDevelopmentConnectSources() {
  if (!isDevelopment()) return []

  const sources = new Set<string>(LOCAL_SUPABASE_CONNECT_SOURCES)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      sources.add(url.origin)

      if (url.protocol === 'http:') {
        sources.add(`ws://${url.host}`)
      } else if (url.protocol === 'https:') {
        sources.add(`wss://${url.host}`)
      }
    } catch {
      // Ignore invalid local env values; Supabase client config owns surfacing that error.
    }
  }

  return [...sources]
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

function getLiveSessionConnectSource() {
  const configured =
    process.env.VITE_LIVE_SESSION_WEBSOCKET_URL ?? import.meta.env.VITE_LIVE_SESSION_WEBSOCKET_URL
  if (!configured) return isDevelopment() ? ['ws://127.0.0.1:2567'] : []

  try {
    const url = new URL(configured)
    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol === 'https:') url.protocol = 'wss:'
    return url.protocol === 'ws:' || url.protocol === 'wss:' ? [url.origin] : []
  } catch {
    return []
  }
}

function getConnectSrc() {
  return [
    "connect-src 'self' blob:",
    ...SUPABASE_CONNECT_SOURCES,
    ...getSentryConnectSource(),
    ...getLiveSessionConnectSource(),
    ...getDevelopmentConnectSources()
  ].join(' ')
}

function getImgSrc() {
  return [
    "img-src 'self' data: blob:",
    'https://*.supabase.co',
    ...getDevelopmentConnectSources().filter((source) => source.startsWith('http'))
  ].join(' ')
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

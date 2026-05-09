const ENFORCED_CSP = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ')

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
    isDevelopment() ? "'unsafe-eval'" : null
  ].filter(Boolean).join(' ')
}

function getStyleSrc() {
  return "style-src 'self' 'unsafe-inline'"
}

function getReportOnlyCsp({ nonce }: SecurityHeaderOptions = {}) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    getScriptSrc(nonce),
    getStyleSrc(),
    "worker-src 'self' blob:"
  ].join('; ')
}

const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=()',
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
    'Content-Security-Policy': ENFORCED_CSP,
    'Content-Security-Policy-Report-Only': getReportOnlyCsp(options),
    'Permissions-Policy': PERMISSIONS_POLICY,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
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

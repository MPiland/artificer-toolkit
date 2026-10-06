import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSecurityHeaders, withSecurityHeaders } from './securityHeaders'

describe('security headers', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('allows only the configured secure Convex endpoint and development loopback', () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_CONVEX_URL', 'https://example.convex.cloud')
    const secure = createSecurityHeaders()['Content-Security-Policy']
    expect(secure).toContain('https://example.convex.cloud wss://example.convex.cloud')
    expect(secure).not.toContain('*.convex.cloud')
    vi.stubEnv('VITE_CONVEX_URL', 'http://127.0.0.1:3220')
    expect(createSecurityHeaders()['Content-Security-Policy']).not.toContain(':3220')
    vi.stubEnv('MODE', 'development')
    expect(createSecurityHeaders()['Content-Security-Policy']).toContain(
      'http://127.0.0.1:3220 ws://127.0.0.1:3220'
    )
    vi.stubEnv('VITE_CONVEX_URL', 'http://public.example')
    expect(createSecurityHeaders()['Content-Security-Policy']).not.toContain('public.example')
  })

  it('lets a local proof build reach loopback HTTP without development eval', () => {
    vi.stubEnv('MODE', 'proof')
    vi.stubEnv('VITE_CONVEX_URL', 'http://127.0.0.1:3210')
    vi.stubEnv('VITE_MEDIA_STORAGE_ORIGIN', 'http://127.0.0.1:9000')
    const csp = createSecurityHeaders()['Content-Security-Policy']
    expect(csp).toContain('http://127.0.0.1:3210 ws://127.0.0.1:3210')
    expect(csp).toContain('http://127.0.0.1:9000')
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it.each([
    { mode: 'production', nodeEnv: undefined },
    { mode: 'production', nodeEnv: 'development' },
    { mode: 'staging', nodeEnv: undefined },
    { mode: 'test', nodeEnv: 'development' }
  ])(
    'serves the production policy for a $mode build whatever NODE_ENV is ($nodeEnv)',
    ({ mode, nodeEnv }) => {
      vi.stubEnv('MODE', mode)
      vi.stubEnv('NODE_ENV', nodeEnv)
      vi.stubEnv('VITE_CONVEX_URL', 'http://127.0.0.1:3210')
      vi.stubEnv('VITE_LIVE_SESSION_WEBSOCKET_URL', '')
      vi.stubEnv('VITE_MEDIA_STORAGE_ORIGIN', 'http://127.0.0.1:9000')
      const csp = createSecurityHeaders({ nonce: 'test-nonce' })['Content-Security-Policy']
      expect(csp).toContain("script-src 'self' 'nonce-test-nonce' 'wasm-unsafe-eval'; ")
      expect(csp).not.toContain("'unsafe-eval'")
      expect(csp).not.toContain('127.0.0.1')
    }
  )

  it('adds portable browser hardening headers without HSTS', () => {
    const response = withSecurityHeaders(new Response('ok'))

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Strict-Transport-Security')).toBeNull()
  })

  it('enforces the complete browser content policy', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_LIVE_SESSION_WEBSOCKET_URL', '')
    vi.stubEnv('VITE_MEDIA_STORAGE_ORIGIN', '')

    try {
      const response = withSecurityHeaders(new Response('ok'))
      const csp = response.headers.get('Content-Security-Policy') ?? ''

      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("base-uri 'self'")
      expect(csp).toContain("form-action 'self'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("style-src 'self'")
      expect(csp).toContain("img-src 'self' data: blob:")
      expect(csp).toContain("connect-src 'self' blob:")
      expect(csp).not.toContain('novu.co')
      expect(csp).not.toContain('supabase.co')
      expect(csp).not.toContain(':54321')
      expect(csp).toContain('ws://127.0.0.1:8787')
      expect(csp).toContain('http://127.0.0.1:8787')
      expect(response.headers.get('Content-Security-Policy-Report-Only')).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('allows the configured session Worker WebSocket and content origins', () => {
    const originalUrl = process.env.VITE_LIVE_SESSION_WEBSOCKET_URL
    process.env.VITE_LIVE_SESSION_WEBSOCKET_URL = 'https://live.example.com/live-session'

    try {
      const csp = createSecurityHeaders()['Content-Security-Policy']
      expect(csp).toContain('wss://live.example.com')
      expect(csp).toContain('https://live.example.com')
    } finally {
      if (originalUrl === undefined) {
        delete process.env.VITE_LIVE_SESSION_WEBSOCKET_URL
      } else {
        process.env.VITE_LIVE_SESSION_WEBSOCKET_URL = originalUrl
      }
    }
  })

  it('keeps retired Supabase origins out of production CSP', () => {
    vi.stubEnv('MODE', 'production')
    const csp = createSecurityHeaders()['Content-Security-Policy']

    expect(csp).not.toContain('supabase.co')
    expect(csp).not.toContain(':54321')
  })

  it('allows the configured Sentry ingest origin in CSP', () => {
    const originalDsn = process.env.VITE_SENTRY_DSN
    process.env.VITE_SENTRY_DSN = 'https://public@example.ingest.sentry.io/123'

    try {
      const csp = createSecurityHeaders()['Content-Security-Policy']

      expect(csp).toContain('https://example.ingest.sentry.io')
      expect(csp).not.toContain('public@')
    } finally {
      if (originalDsn === undefined) {
        delete process.env.VITE_SENTRY_DSN
      } else {
        process.env.VITE_SENTRY_DSN = originalDsn
      }
    }
  })

  it('ignores invalid or non-HTTPS Sentry DSNs', () => {
    const originalDsn = process.env.VITE_SENTRY_DSN

    try {
      process.env.VITE_SENTRY_DSN = 'http://public@example.ingest.sentry.io/123'
      expect(createSecurityHeaders()['Content-Security-Policy']).not.toContain(
        'example.ingest.sentry.io'
      )

      process.env.VITE_SENTRY_DSN = 'not-a-url'
      expect(createSecurityHeaders()['Content-Security-Policy']).not.toContain('not-a-url')
    } finally {
      if (originalDsn === undefined) {
        delete process.env.VITE_SENTRY_DSN
      } else {
        process.env.VITE_SENTRY_DSN = originalDsn
      }
    }
  })

  it('allows eval only in development script CSP and enforces the nonce', () => {
    vi.stubEnv('MODE', 'development')
    const developmentCsp = createSecurityHeaders({ nonce: 'test-nonce' })['Content-Security-Policy']

    expect(developmentCsp).toContain(
      "script-src 'self' 'nonce-test-nonce' 'wasm-unsafe-eval' 'unsafe-eval'"
    )

    vi.stubEnv('MODE', 'production')
    const productionCsp = createSecurityHeaders({ nonce: 'test-nonce' })['Content-Security-Policy']

    expect(productionCsp).toContain("script-src 'self' 'nonce-test-nonce' 'wasm-unsafe-eval'")
    expect(productionCsp).not.toContain("'unsafe-eval'")
    expect(productionCsp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('preserves middleware-set security headers when requested', () => {
    const response = withSecurityHeaders(
      new Response('ok', {
        headers: {
          'Content-Security-Policy': "script-src 'nonce-existing'"
        }
      }),
      { preserveExisting: true }
    )

    expect(response.headers.get('Content-Security-Policy')).toBe("script-src 'nonce-existing'")
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('denies unused browser capabilities by default', () => {
    const response = withSecurityHeaders(new Response('ok'))
    const policy = response.headers.get('Permissions-Policy') ?? ''

    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('geolocation=()')
    expect(policy).toContain('payment=()')
    expect(policy).not.toContain('ambient-light-sensor')
  })
})

describe('media storage CSP source', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('adds the configured exact HTTPS origin to upload and image directives', () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_MEDIA_STORAGE_ORIGIN', 'https://bucket.account.r2.cloudflarestorage.com')

    const csp = createSecurityHeaders()['Content-Security-Policy']
    const connectSrc = csp.split('; ').find((directive) => directive.startsWith('connect-src'))
    const imgSrc = csp.split('; ').find((directive) => directive.startsWith('img-src'))
    expect(connectSrc).toContain('https://bucket.account.r2.cloudflarestorage.com')
    expect(imgSrc).toContain('https://bucket.account.r2.cloudflarestorage.com')
    expect(csp).not.toContain('*.r2.cloudflarestorage.com')
  })

  it('allows HTTP loopback media storage only in development', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_MEDIA_STORAGE_ORIGIN', 'http://[::1]:9000')
    expect(createSecurityHeaders()['Content-Security-Policy']).toContain('http://[::1]:9000')

    vi.stubEnv('MODE', 'production')
    expect(createSecurityHeaders()['Content-Security-Policy']).not.toContain('http://[::1]:9000')
  })

  it.each([
    'http://storage.example.com',
    'ftp://storage.example.com',
    'https://user:pass@storage.example.com',
    'https://storage.example.com/path',
    'https://storage.example.com/?query=value',
    'https://storage.example.com/#fragment',
    'https://*.r2.cloudflarestorage.com',
    'not-a-url'
  ])('rejects malformed or unsafe origin %s', (origin) => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_MEDIA_STORAGE_ORIGIN', origin)

    const csp = createSecurityHeaders()['Content-Security-Policy']
    expect(csp).not.toContain(origin)
    expect(csp).not.toContain('storage.example.com')
    expect(csp).not.toContain('r2.cloudflarestorage.com')
  })
})

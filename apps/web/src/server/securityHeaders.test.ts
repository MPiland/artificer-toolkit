import { describe, expect, it } from 'vitest'
import { createSecurityHeaders, withSecurityHeaders } from './securityHeaders'

describe('security headers', () => {
  it('adds portable browser hardening headers without HSTS', () => {
    const response = withSecurityHeaders(new Response('ok'))

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Strict-Transport-Security')).toBeNull()
  })

  it('enforces the complete browser content policy', () => {
    const originalUrl = process.env.VITE_LIVE_SESSION_WEBSOCKET_URL
    delete process.env.VITE_LIVE_SESSION_WEBSOCKET_URL

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
      expect(csp).toContain(
        "img-src 'self' data: blob: https://*.supabase.co http://127.0.0.1:54321 http://localhost:54321"
      )
      expect(csp).toContain("connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co")
      expect(csp).not.toContain('novu.co')
      expect(csp).toContain('http://127.0.0.1:54321')
      expect(csp).toContain('ws://127.0.0.1:54321')
      expect(csp).toContain('ws://127.0.0.1:2567')
      expect(response.headers.get('Content-Security-Policy-Report-Only')).toBeNull()
    } finally {
      if (originalUrl === undefined) {
        delete process.env.VITE_LIVE_SESSION_WEBSOCKET_URL
      } else {
        process.env.VITE_LIVE_SESSION_WEBSOCKET_URL = originalUrl
      }
    }
  })

  it('allows the configured live-session WebSocket origin', () => {
    const originalUrl = process.env.VITE_LIVE_SESSION_WEBSOCKET_URL
    process.env.VITE_LIVE_SESSION_WEBSOCKET_URL = 'https://live.example.com/live-session'

    try {
      expect(createSecurityHeaders()['Content-Security-Policy']).toContain('wss://live.example.com')
    } finally {
      if (originalUrl === undefined) {
        delete process.env.VITE_LIVE_SESSION_WEBSOCKET_URL
      } else {
        process.env.VITE_LIVE_SESSION_WEBSOCKET_URL = originalUrl
      }
    }
  })

  it('allows the configured R2 map origin', () => {
    const originalAccountId = process.env.R2_ACCOUNT_ID
    process.env.R2_ACCOUNT_ID = '0123456789abcdef0123456789abcdef'

    try {
      const csp = createSecurityHeaders()['Content-Security-Policy']

      expect(csp).toContain('https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com')
    } finally {
      if (originalAccountId === undefined) {
        delete process.env.R2_ACCOUNT_ID
      } else {
        process.env.R2_ACCOUNT_ID = originalAccountId
      }
    }
  })

  it('keeps local Supabase origins out of production CSP', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    try {
      const csp = createSecurityHeaders()['Content-Security-Policy']

      expect(csp).toContain("img-src 'self' data: blob: https://*.supabase.co")
      expect(csp).toContain("connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co")
      expect(csp).not.toContain('http://127.0.0.1:54321')
      expect(csp).not.toContain('ws://127.0.0.1:54321')
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = originalNodeEnv
      }
    }
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
    const originalNodeEnv = process.env.NODE_ENV

    try {
      process.env.NODE_ENV = 'development'
      const developmentCsp = createSecurityHeaders({ nonce: 'test-nonce' })[
        'Content-Security-Policy'
      ]

      expect(developmentCsp).toContain(
        "script-src 'self' 'nonce-test-nonce' 'wasm-unsafe-eval' 'unsafe-eval'"
      )

      process.env.NODE_ENV = 'production'
      const productionCsp = createSecurityHeaders({ nonce: 'test-nonce' })[
        'Content-Security-Policy'
      ]

      expect(productionCsp).toContain("script-src 'self' 'nonce-test-nonce' 'wasm-unsafe-eval'")
      expect(productionCsp).not.toContain("'unsafe-eval'")
      expect(productionCsp).toContain("style-src 'self' 'unsafe-inline'")
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = originalNodeEnv
      }
    }
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

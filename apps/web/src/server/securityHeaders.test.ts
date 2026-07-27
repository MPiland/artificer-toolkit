import { describe, expect, it } from 'vitest'
import { createSecurityHeaders, withSecurityHeaders } from './securityHeaders'

describe('security headers', () => {
  it('adds portable browser hardening headers without HSTS', () => {
    const response = withSecurityHeaders(new Response('ok'))

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Strict-Transport-Security')).toBeNull()
  })

  it('enforces framing, object, base-uri, and form-action CSP protections', () => {
    const response = withSecurityHeaders(new Response('ok'))
    const csp = response.headers.get('Content-Security-Policy') ?? ''

    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it('ships script and style CSP as report-only first', () => {
    const response = withSecurityHeaders(new Response('ok'))
    const reportOnlyCsp = response.headers.get('Content-Security-Policy-Report-Only') ?? ''

    expect(reportOnlyCsp).toContain("script-src 'self'")
    expect(reportOnlyCsp).toContain("style-src 'self'")
    expect(reportOnlyCsp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co")
    expect(reportOnlyCsp).toContain('http://127.0.0.1:54321')
    expect(reportOnlyCsp).toContain('ws://127.0.0.1:54321')
  })

  it('keeps local Supabase origins out of production report-only CSP', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    try {
      const reportOnlyCsp = createSecurityHeaders()['Content-Security-Policy-Report-Only']

      expect(reportOnlyCsp).toContain(
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
      )
      expect(reportOnlyCsp).not.toContain('http://127.0.0.1:54321')
      expect(reportOnlyCsp).not.toContain('ws://127.0.0.1:54321')
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = originalNodeEnv
      }
    }
  })

  it('allows the configured Sentry ingest origin in report-only CSP', () => {
    const originalDsn = process.env.VITE_SENTRY_DSN
    process.env.VITE_SENTRY_DSN = 'https://public@example.ingest.sentry.io/123'

    try {
      const reportOnlyCsp = createSecurityHeaders()['Content-Security-Policy-Report-Only']

      expect(reportOnlyCsp).toContain('https://example.ingest.sentry.io')
      expect(reportOnlyCsp).not.toContain('public@')
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
      expect(createSecurityHeaders()['Content-Security-Policy-Report-Only']).not.toContain(
        'example.ingest.sentry.io'
      )

      process.env.VITE_SENTRY_DSN = 'not-a-url'
      expect(createSecurityHeaders()['Content-Security-Policy-Report-Only']).not.toContain(
        'not-a-url'
      )
    } finally {
      if (originalDsn === undefined) {
        delete process.env.VITE_SENTRY_DSN
      } else {
        process.env.VITE_SENTRY_DSN = originalDsn
      }
    }
  })

  it('allows eval only in development report-only script CSP', () => {
    const originalNodeEnv = process.env.NODE_ENV

    try {
      process.env.NODE_ENV = 'development'
      const developmentCsp = createSecurityHeaders({ nonce: 'test-nonce' })[
        'Content-Security-Policy-Report-Only'
      ]

      expect(developmentCsp).toContain("script-src 'self' 'nonce-test-nonce' 'unsafe-eval'")

      process.env.NODE_ENV = 'production'
      const productionCsp = createSecurityHeaders({ nonce: 'test-nonce' })[
        'Content-Security-Policy-Report-Only'
      ]

      expect(productionCsp).toContain("script-src 'self' 'nonce-test-nonce'")
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
          'Content-Security-Policy-Report-Only': "script-src 'nonce-existing'"
        }
      }),
      { preserveExisting: true }
    )

    expect(response.headers.get('Content-Security-Policy-Report-Only')).toBe(
      "script-src 'nonce-existing'"
    )
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

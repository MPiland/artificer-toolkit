import { describe, expect, it } from 'vitest'
import { withSecurityHeaders } from './securityHeaders'

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
  })

  it('adds nonce directives and dev eval support to report-only script CSP when provided', () => {
    const response = withSecurityHeaders(new Response('ok'), { nonce: 'test-nonce' })
    const reportOnlyCsp = response.headers.get('Content-Security-Policy-Report-Only') ?? ''

    expect(reportOnlyCsp).toContain("script-src 'self' 'nonce-test-nonce' 'unsafe-eval'")
    expect(reportOnlyCsp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('preserves middleware-set security headers when requested', () => {
    const response = withSecurityHeaders(new Response('ok', {
      headers: {
        'Content-Security-Policy-Report-Only': "script-src 'nonce-existing'"
      }
    }), { preserveExisting: true })

    expect(response.headers.get('Content-Security-Policy-Report-Only')).toBe("script-src 'nonce-existing'")
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

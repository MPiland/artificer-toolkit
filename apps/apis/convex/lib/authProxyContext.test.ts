import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'
import {
  AUTH_PROXY_CONTEXT_HEADER,
  signAuthProxyContext,
  verifyAuthProxyContext
} from './authProxyContext'

const audience = 'https://deployment.convex.site'
const context = { ip: '203.0.113.10', method: 'POST' as const, path: '/api/auth/sign-in/email' }
const secret = 'local-test-only-proxy-secret-'.repeat(4)
const request = (token?: string, path = context.path, method = context.method) =>
  new Request(`${audience}${path}`, {
    method,
    headers: token ? { [AUTH_PROXY_CONTEXT_HEADER]: token } : {}
  })

describe('server-only auth proxy context', () => {
  beforeEach(() => vi.stubEnv('AUTH_PROXY_SECRET', secret))
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('accepts the exact signed request and never trusts unsigned IP headers', async () => {
    expect(await verifyAuthProxyContext(request(), audience)).toBeNull()
    const token = await signAuthProxyContext(context, audience)
    expect(await verifyAuthProxyContext(request(token), audience)).toEqual(context)
    const unsigned = request()
    unsigned.headers.set('x-artificer-client-ip', '192.0.2.1')
    unsigned.headers.set('x-forwarded-for', '192.0.2.1')
    expect(await verifyAuthProxyContext(unsigned, audience)).toBeNull()
  })

  it('rejects tampering, wrong deployment, endpoint, method, and expired context', async () => {
    const token = await signAuthProxyContext(context, audience)
    await expect(verifyAuthProxyContext(request(`${token}x`), audience)).rejects.toThrow()
    await expect(
      verifyAuthProxyContext(request(token), 'https://other.convex.site')
    ).rejects.toThrow()
    await expect(
      verifyAuthProxyContext(request(token, '/api/auth/sign-up/email'), audience)
    ).rejects.toThrow()
    await expect(
      verifyAuthProxyContext(
        new Request(`${audience}${context.path}`, {
          headers: { [AUTH_PROXY_CONTEXT_HEADER]: token }
        }),
        audience
      )
    ).rejects.toThrow()
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 31_000)
    await expect(verifyAuthProxyContext(request(token), audience)).rejects.toThrow()
  })

  it('rejects malformed signed facts and missing/weak configuration', async () => {
    const malformed = await new SignJWT({ ...context, ip: 'not-an-ip' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('artificer-auth-proxy')
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('30s')
      .sign(new TextEncoder().encode(secret))
    await expect(verifyAuthProxyContext(request(malformed), audience)).rejects.toThrow()
    vi.stubEnv('AUTH_PROXY_SECRET', 'weak')
    await expect(signAuthProxyContext(context, audience)).rejects.toThrow('AUTH_PROXY_SECRET')
  })
})

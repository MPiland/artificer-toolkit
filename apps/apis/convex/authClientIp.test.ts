import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { describe, expect, it, vi } from 'vitest'
import { convexTest } from '../tests/convexTest'
import authSchema from './betterAuth/schema'
import { AUTH_PROXY_CONTEXT_HEADER, signAuthProxyContext } from './lib/authProxyContext'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.CONVEX_SITE_URL = 'http://127.0.0.1:3211'
process.env.AUTH_PROXY_SECRET = 'auth-client-ip-test-proxy-secret-'.repeat(3)
process.env.BETTER_AUTH_SECRET = 'auth-client-ip-test-secret-with-sufficient-length'

const path = '/api/auth/sign-in/email'
// Better Auth allows three sign-in attempts per ten-second window for one client.
const SIGN_IN_LIMIT = 3

// Drives the registered auth HTTP routes; only the platform's connecting IP is set by the test.
function backend() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  return async (
    client: { platformIp: string | null; proxiedIp?: string },
    headers: Record<string, string> = {}
  ) => {
    const proxyContext = client.proxiedIp
      ? {
          [AUTH_PROXY_CONTEXT_HEADER]: await signAuthProxyContext(
            { method: 'POST', path, ip: client.proxiedIp },
            process.env.CONVEX_SITE_URL!
          )
        }
      : {}
    const response = await t.withRequestMetadata({ ip: client.platformIp }).fetch(path, {
      method: 'POST',
      headers: {
        origin: process.env.SITE_URL!,
        'content-type': 'application/json',
        ...proxyContext,
        ...headers
      },
      body: JSON.stringify({
        email: 'absent@example.invalid',
        password: 'Client-ip-proof-password-718!'
      })
    })
    return response.status
  }
}

async function exhaustSignIn(signIn: ReturnType<typeof backend>, client: Parameters<typeof signIn>[0]) {
  const statuses: number[] = []
  for (let attempt = 0; attempt <= SIGN_IN_LIMIT; attempt++) statuses.push(await signIn(client))
  expect(statuses).toEqual([401, 401, 401, 429])
}

describe('auth rate limiting keys on the client IP', () => {
  it('gives direct callers on different platform IPs separate sign-in buckets', async () => {
    const signIn = backend()
    await exhaustSignIn(signIn, { platformIp: '198.51.100.1' })
    expect(await signIn({ platformIp: '198.51.100.2' })).toBe(401)
  })

  it('gives web clients the IP the proxy signed, not the shared proxy egress IP', async () => {
    const signIn = backend()
    const proxyEgress = '192.0.2.10'
    await exhaustSignIn(signIn, { platformIp: proxyEgress, proxiedIp: '203.0.113.1' })
    expect(await signIn({ platformIp: proxyEgress, proxiedIp: '203.0.113.2' })).toBe(401)
    expect(await signIn({ platformIp: proxyEgress, proxiedIp: '2001:db8::1' })).toBe(401)
  })

  it('ignores a caller-supplied client IP header', async () => {
    const signIn = backend()
    await exhaustSignIn(signIn, { platformIp: '198.51.100.1' })
    for (const spoofed of ['198.51.100.9', '203.0.113.9']) {
      expect(
        await signIn(
          { platformIp: '198.51.100.1' },
          { 'x-artificer-client-ip': spoofed, 'x-forwarded-for': spoofed }
        )
      ).toBe(429)
    }
  })

  it('refuses and reports a request with no client IP instead of sharing one bucket', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const signIn = backend()
    expect(await signIn({ platformIp: null })).toBe(503)
    expect(await signIn({ platformIp: 'unknown' })).toBe(503)
    expect(logged).toHaveBeenCalledWith(
      'Auth request refused: no valid client IP, so rate limiting cannot key on the client.'
    )
    logged.mockRestore()
  })
})

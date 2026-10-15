import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { describe, expect, it, vi } from 'vitest'
import { convexTest } from '../tests/convexTest'
import authSchema from './betterAuth/schema'
import { AUTH_PROXY_CONTEXT_HEADER, signAuthProxyContext } from './lib/authProxyContext'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.CONVEX_SITE_URL = 'http://127.0.0.1:3211'
process.env.AUTH_PROXY_SECRET = 'auth-proxy-rejection-test-proxy-secret-'.repeat(3)
process.env.BETTER_AUTH_SECRET = 'auth-proxy-rejection-test-secret-with-sufficient-length'

const path = '/api/auth/get-session'

function fetchSession(token: string) {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  return t.fetch(path, { method: 'GET', headers: { [AUTH_PROXY_CONTEXT_HEADER]: token } })
}

describe('auth HTTP proxy context rejection', () => {
  it('accepts a context signed for this deployment', async () => {
    const token = await signAuthProxyContext(
      { method: 'GET', path, ip: '127.0.0.1' },
      process.env.CONVEX_SITE_URL!
    )
    expect((await fetchSession(token)).status).toBe(200)
  })

  it('refuses a context signed for another deployment and logs which claim failed', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const token = await signAuthProxyContext(
      { method: 'GET', path, ip: '127.0.0.1' },
      'https://other.convex.site'
    )
    const response = await fetchSession(token)
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid authentication request.')
    expect(logged).toHaveBeenCalledWith(
      'Auth proxy context rejected:',
      expect.stringContaining('"aud" claim')
    )
    expect(JSON.stringify(logged.mock.calls)).not.toContain(token)
    logged.mockRestore()
  })
})

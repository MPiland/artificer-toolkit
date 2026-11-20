import { convexTest } from '../tests/convexTest'
import { afterEach, expect, it, vi } from 'vitest'
import { components } from './_generated/api'
import authSchema from './betterAuth/schema'
import schema from './schema'

afterEach(() => vi.unstubAllEnvs())

it('validates tokens against the default remote JWKS, which no rate limit can exhaust', async () => {
  vi.stubEnv('SITE_URL', 'http://localhost:3000')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('BETTER_AUTH_SECRET', 'local-jwks-proof-secret-with-sufficient-length')
  vi.resetModules()
  const { createAuth } = await import('./authFactory.helper')
  const config = (await import('./auth.config')).default
  expect(config.providers[0]!.jwks).toBe('http://127.0.0.1:3221/api/auth/convex/jwks')

  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  const request = (path: string, init?: RequestInit) => {
    const handle: Parameters<typeof t.action>[0] = async (ctx) => {
      const auth = createAuth({
        ...ctx,
        meta: {
          ...ctx.meta,
          getRequestMetadata: async () => ({
            ip: '127.0.0.1',
            userAgent: null,
            requestId: crypto.randomUUID(),
            scheduledFunctionId: null,
            authToken: null
          })
        }
      })
      const response = await auth.handler(
        new Request(`http://localhost:3000/api/auth${path}`, init)
      )
      return { status: response.status, body: await response.text() }
    }
    return t.action(handle)
  }
  const rateLimitKeys = async (): Promise<string[]> => {
    const rows = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'rateLimit',
        paginationOpts: { cursor: null, numItems: 50 }
      })
    )
    return (rows.page as { key?: unknown }[]).map((row) => String(row.key))
  }

  // Convex's own fetches carry no proxy context, so they all key on one IP. Far more than the
  // default 100 per 10 s must still succeed, and must leave no counter to exhaust.
  for (let attempt = 0; attempt < 150; attempt++) {
    const jwks = await request('/convex/jwks')
    expect(jwks.status).toBe(200)
    expect(jwks.body).not.toMatch(/"(?:privateKey|d|p|q|dp|dq|qi)"\s*:/)
  }
  expect((await rateLimitKeys()).filter((key) => key.includes('/convex/jwks'))).toEqual([])

  // Every other limit stays: a forced-exhausted token bucket still refuses, and credentials keep
  // their 3 per 10 s sign-in limit.
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'rateLimit',
        data: { key: '127.0.0.1|/convex/token', count: 10_000, lastRequest: Date.now() }
      }
    })
  )
  expect((await request('/convex/token')).status).toBe(429)
  expect((await request('/convex/jwks')).status).toBe(200)
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await request('/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'absent@example.invalid',
        password: 'Local-proof-password-718!'
      })
    })
    expect(response.status).toBe(attempt < 3 ? 401 : 429)
  }
}, 60_000)

import { convexTest } from '../tests/convexTest'
import { createPublicJwks } from '@convex-dev/better-auth/auth-config'
import { createLocalJWKSet, jwtVerify } from 'jose'
import { afterEach, expect, it, vi } from 'vitest'
import { components } from './_generated/api'
import authSchema from './betterAuth/schema'
import schema from './schema'

afterEach(() => vi.unstubAllEnvs())

it('pins existing signing keys without HTTP verification fetches and preserves credential and public-key limits', async () => {
  vi.stubEnv('SITE_URL', 'http://localhost:3000')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('BETTER_AUTH_SECRET', 'local-jwks-proof-secret-with-sufficient-length')
  vi.stubEnv('JWKS', '')
  vi.resetModules()
  let createAuth = (await import('./authFactory.helper')).createAuth
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  const request = (path: string, init?: RequestInit) =>
    t.action(async (ctx) => {
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
      const body: unknown = await response.json()
      return { status: response.status, body }
    })
  const initial = await request('/convex/jwks')
  expect(initial.status).toBe(200)
  expect(initial.body).toMatchObject({
    keys: [expect.objectContaining({ kty: 'RSA', kid: expect.any(String) })]
  })
  expect(JSON.stringify(initial.body)).not.toMatch(/"(?:privateKey|d|p|q|dp|dq|qi)"\s*:/)
  const stored = await t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'jwks',
      paginationOpts: { cursor: null, numItems: 20 }
    })
  )
  expect(stored.isDone).toBe(true)
  const rows: unknown[] = stored.page
  const keys = rows.map((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      !('_id' in row) ||
      typeof row._id !== 'string' ||
      !('publicKey' in row) ||
      typeof row.publicKey !== 'string' ||
      !('privateKey' in row) ||
      typeof row.privateKey !== 'string' ||
      !('createdAt' in row) ||
      typeof row.createdAt !== 'number'
    )
      throw new Error('Unexpected local signing key document.')
    return {
      id: row._id,
      publicKey: row.publicKey,
      privateKey: row.privateKey,
      createdAt: row.createdAt,
      alg: 'RS256'
    }
  })
  const session = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Static key proof',
          email: 'static-key@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
    return ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  })
  const getToken = async () => {
    const response = await request('/convex/token', {
      headers: { authorization: `Bearer ${session.token}` }
    })
    expect(response.status).toBe(200)
    if (
      !response.body ||
      typeof response.body !== 'object' ||
      !('token' in response.body) ||
      typeof response.body.token !== 'string'
    )
      throw new Error('Missing local proof token.')
    return response.body.token
  }
  const originalToken = await getToken()
  vi.stubEnv('JWKS', JSON.stringify(keys))
  vi.resetModules()
  createAuth = (await import('./authFactory.helper')).createAuth
  const config = (await import('./auth.config')).default
  const provider = config.providers[0]!
  expect(provider.jwks).toMatch(/^data:text\/plain;charset=utf-8;base64,/)
  const publicKeys = createPublicJwks(keys)
  expect(JSON.parse(Buffer.from(provider.jwks.split(',')[1]!, 'base64').toString('utf8'))).toEqual(
    publicKeys
  )
  expect(publicKeys).toEqual(initial.body)
  const verifier = createLocalJWKSet(publicKeys)
  for (const token of [originalToken, await getToken()]) {
    const verified = await jwtVerify(token, verifier, {
      algorithms: ['RS256'],
      issuer: 'http://127.0.0.1:3221',
      audience: 'convex'
    })
    expect(verified.payload.sub).toBe(session.userId)
    expect(verified.payload.sessionId).toBe(session._id)
  }
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: {
        model: 'rateLimit',
        where: [{ field: 'key', value: '127.0.0.1|/convex/jwks' }],
        update: { count: 10_000, lastRequest: Date.now() }
      },
      paginationOpts: { cursor: null, numItems: 20 }
    })
  )
  expect((await request('/convex/jwks')).status).toBe(429)
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
}, 30_000)

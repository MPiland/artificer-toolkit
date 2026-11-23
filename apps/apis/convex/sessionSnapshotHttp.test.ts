import { createFunctionHandle } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { describe, expect, it } from 'vitest'
import { api, components, internal } from './_generated/api'
import { createAuth } from './authFactory.helper'
import authSchema from './betterAuth/schema'
import type { Doc as AuthDoc } from './betterAuth/_generated/dataModel'
import { AUTH_PROXY_CONTEXT_HEADER, signAuthProxyContext } from './lib/authProxyContext'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.CONVEX_SITE_URL = 'http://127.0.0.1:3211'
process.env.AUTH_PROXY_SECRET = 'session-snapshot-http-test-proxy-secret-value-'.repeat(3)
process.env.BETTER_AUTH_SECRET = 'session-snapshot-http-test-secret-with-sufficient-length'

const audience = process.env.CONVEX_SITE_URL
const snapshotPath = '/api/auth/session-snapshot'

async function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const password = 'Session-snapshot-password-2817!'
  const member = await t.run(async (ctx) => {
    const auth = createAuth(ctx)
    const hash = await (await auth.$context).password.hash(password)
    const create = await createFunctionHandle(internal.auth.onCreate)
    const user: AuthDoc<'user'> = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Snapshot Member',
          email: 'snapshot-member@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: create
    })
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'account',
        data: {
          accountId: user._id,
          providerId: 'credential',
          userId: user._id,
          password: hash,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
    const signed = await auth.api.signInEmail({
      body: { email: user.email, password },
      headers: new Headers({ origin: 'http://localhost:3000' }),
      returnHeaders: true
    })
    const responseHeaders: Headers = signed.headers
    const session: AuthDoc<'session'> | null = await ctx.runQuery(
      components.betterAuth.adapter.findOne,
      { model: 'session', where: [{ field: 'token', value: signed.response.token }] }
    )
    if (!session) throw new Error('Missing signed session.')
    return {
      user,
      session,
      cookie: responseHeaders
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ')
    }
  })
  const proxied = async (path: string, method: 'GET' | 'POST', cookie?: string) => ({
    ...(cookie ? { cookie } : {}),
    origin: 'http://localhost:3000',
    [AUTH_PROXY_CONTEXT_HEADER]: await signAuthProxyContext(
      { method, path, ip: '192.0.2.21' },
      audience
    )
  })
  const snapshot = async (cookie?: string) =>
    t.fetch(snapshotPath, { method: 'GET', headers: await proxied(snapshotPath, 'GET', cookie) })
  return { t, member, snapshot, proxied }
}

describe('session snapshot HTTP endpoint', () => {
  it('returns the session query result for the cookie session in one request', async () => {
    const { t, member, snapshot } = await fixture()
    const response = await snapshot(member.cookie)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.user).toMatchObject({ email: member.user.email, role: 'user' })
    expect(body).toEqual(
      await t
        .withIdentity({ subject: member.user._id, sessionId: member.session._id })
        .query(api.account.session, {})
    )
  })

  it('returns the anonymous snapshot without a cookie or with an unknown cookie', async () => {
    const { t, snapshot } = await fixture()
    const anonymous = await t.query(api.account.session, {})
    for (const cookie of [undefined, 'better-auth.session_token=forged.value']) {
      const response = await snapshot(cookie)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(anonymous)
    }
  })

  it('returns the anonymous snapshot once the session is revoked', async () => {
    const { t, member, snapshot, proxied } = await fixture()
    const signOutPath = '/api/auth/sign-out'
    const signedOut = await t.fetch(signOutPath, {
      method: 'POST',
      headers: {
        ...(await proxied(signOutPath, 'POST', member.cookie)),
        'content-type': 'application/json'
      },
      body: '{}'
    })
    expect(signedOut.status).toBe(200)
    const response = await snapshot(member.cookie)
    expect(response.status).toBe(200)
    expect((await response.json()).user).toBeNull()
  })
})

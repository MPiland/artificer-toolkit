import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { createLocalJWKSet, jwtVerify } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { authEmailDeliveryInputSchema } from '@artificer-toolkit/schema/api/auth'
import { convexTest } from '../tests/convexTest'
import { generateValidUsername } from '../tests/fixtures/generatedUsername'
import { api, components } from './_generated/api'
import authSchema from './betterAuth/schema'
import schema from './schema'

const appOrigin = 'http://localhost:3000'

beforeEach(() => {
  vi.stubEnv('SITE_URL', appOrigin)
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('BETTER_AUTH_SECRET', 'account-journey-secret-with-sufficient-length')
  vi.stubEnv('JWKS', '')
  vi.stubEnv('PUBLIC_SIGN_UP_ENABLED', undefined)
  vi.resetModules()
})
afterEach(() => vi.unstubAllEnvs())

// Drives the real Better Auth HTTP handler; only the Convex platform (JWT validation into an
// identity, email transport) is replaced by the in-memory backend.
async function backend() {
  const { createAuth } = await import('./authFactory.helper')
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const request = (path: string, init: { body?: object; bearer?: string } = {}) =>
    t.action(async function handle(ctx) {
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
        new Request(new URL(path, `${appOrigin}/api/auth/`), {
          method: init.body ? 'POST' : 'GET',
          headers: {
            origin: appOrigin,
            'content-type': 'application/json',
            ...(init.bearer ? { authorization: `Bearer ${init.bearer}` } : {})
          },
          body: init.body ? JSON.stringify(init.body) : undefined,
          redirect: 'manual'
        })
      )
      const text = await response.text()
      return {
        status: response.status,
        location: response.headers.get('location'),
        body: text ? (JSON.parse(text) as Record<string, unknown>) : null
      }
    })
  const deliveries = (recipient: string) =>
    t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect())
        .map((job) => authEmailDeliveryInputSchema.safeParse(job.args[0]))
        .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
        .filter((delivery) => delivery.recipient === recipient)
    )
  const findUser = (email: string) =>
    t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: 'email', value: email }]
      })
    )
  return { t, request, deliveries, findUser }
}

function signupInput() {
  const { username, suffix } = generateValidUsername('Journey_')
  return {
    name: 'Account journey',
    email: `journey-${suffix}@example.invalid`,
    username,
    password: 'Local-journey-password-8175!'
  }
}

describe('account journeys through the Better Auth HTTP handler', () => {
  it('rejects a real signup while the signup flag is unset and creates no account or email', async () => {
    const { t, request, deliveries, findUser } = await backend()
    const signup = signupInput()

    expect((await t.query(api.application.featureFlags, {})).publicSignUpEnabled).toBe(false)
    expect(await request('sign-up/email', { body: signup })).toMatchObject({
      status: 400,
      body: {
        code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
        message: 'Email and password sign up is not enabled'
      }
    })
    expect(await findUser(signup.email)).toBeNull()
    expect(await deliveries(signup.email)).toEqual([])
    expect((await request('sign-in/email', { body: signup })).status).toBe(401)
  })

  it('signs up, verifies the emailed link, logs in by email and username, reads with a native bearer JWT and signs out', async () => {
    vi.stubEnv('PUBLIC_SIGN_UP_ENABLED', 'true')
    const { t, request, deliveries } = await backend()
    const signup = signupInput()
    expect((await t.query(api.application.featureFlags, {})).publicSignUpEnabled).toBe(true)

    expect(await request('sign-up/email', { body: signup })).toMatchObject({
      status: 200,
      body: { token: null }
    })
    // An unverified account cannot sign in; the attempt resends the confirmation link.
    expect((await request('sign-in/email', { body: signup })).status).toBe(403)
    const links = (await deliveries(signup.email)).filter((delivery) => delivery.action === 'signup')
    expect(links.length).toBeGreaterThan(0)
    const link = new URL(links.at(-1)!.actionUrl)
    expect(link.origin).toBe(appOrigin)
    expect(link.searchParams.get('callbackURL')).toBe(`${appOrigin}/auth/confirmed`)

    expect(await request(`${link.pathname}${link.search}`)).toMatchObject({
      status: 302,
      location: `${appOrigin}/auth/confirmed`
    })

    const emailLogin = await request('sign-in/email', { body: signup })
    expect(emailLogin.status).toBe(200)
    const sessionToken = emailLogin.body?.token
    if (typeof sessionToken !== 'string') throw new Error('Email login returned no session.')
    const usernameLogin = await request('sign-in/username', {
      body: { username: signup.username.toUpperCase(), password: signup.password }
    })
    expect(usernameLogin.status).toBe(200)
    expect(usernameLogin.body).toMatchObject({ user: { email: signup.email } })

    // Native clients exchange the session for a Convex JWT with a bearer header.
    const exchanged = await request('convex/token', { bearer: sessionToken })
    expect(exchanged.status).toBe(200)
    const jwt = exchanged.body?.token
    if (typeof jwt !== 'string') throw new Error('Bearer exchange returned no JWT.')
    const jwks = z
      .object({
        keys: z.array(z.object({ kty: z.string(), kid: z.string(), n: z.string(), e: z.string() }))
      })
      .parse((await request('convex/jwks')).body)
    const { payload } = await jwtVerify(jwt, createLocalJWKSet(jwks), {
      algorithms: ['RS256'],
      issuer: 'http://127.0.0.1:3221',
      audience: 'convex'
    })
    expect(payload).not.toHaveProperty('email')
    if (typeof payload.sub !== 'string' || typeof payload.sessionId !== 'string')
      throw new Error('JWT carries no session identity.')
    const caller = t.withIdentity({ subject: payload.sub, sessionId: payload.sessionId })
    const session = await caller.query(api.account.session, {})
    expect(session.user).toMatchObject({
      email: signup.email,
      registrationCompleted: true,
      authoringExperience: 'guided'
    })
    expect(session.isSuperAdmin).toBe(false)

    expect((await request('sign-out', { body: {}, bearer: sessionToken })).status).toBe(200)
    await expect(caller.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
    expect((await request('convex/token', { bearer: sessionToken })).status).toBe(401)
  })

  it('recovers a verified account by emailed code: the new password signs in, the old one and old sessions fail', async () => {
    vi.stubEnv('PUBLIC_SIGN_UP_ENABLED', 'true')
    const { request, deliveries } = await backend()
    const signup = signupInput()
    expect((await request('sign-up/email', { body: signup })).status).toBe(200)
    const confirmation = new URL(
      (await deliveries(signup.email)).filter((delivery) => delivery.action === 'signup').at(-1)!
        .actionUrl
    )
    expect((await request(`${confirmation.pathname}${confirmation.search}`)).status).toBe(302)
    const before = await request('sign-in/email', { body: signup })
    expect(before.status).toBe(200)
    const oldSession = before.body?.token
    if (typeof oldSession !== 'string') throw new Error('Login returned no session.')

    expect(
      (await request('email-otp/request-password-reset', { body: { email: signup.email } })).status
    ).toBe(200)
    const recovery = (await deliveries(signup.email)).filter(
      (delivery) => delivery.action === 'recovery'
    )
    expect(recovery).toHaveLength(1)
    const link = new URL(recovery[0]!.actionUrl)
    expect(`${link.origin}${link.pathname}`).toBe(`${appOrigin}/verify-password-reset`)
    expect(link.searchParams.get('email')).toBe(signup.email)
    const otp = recovery[0]!.token
    if (typeof otp !== 'string') throw new Error('Recovery email carried no code.')

    const newPassword = 'Local-journey-recovered-8175!'
    expect(
      (
        await request('email-otp/reset-password', {
          body: { email: signup.email, otp, password: newPassword }
        })
      ).status
    ).toBe(200)
    expect((await request('sign-in/email', { body: signup })).status).toBe(401)
    expect((await request('convex/token', { bearer: oldSession })).status).toBe(401)
    expect(
      (await request('sign-in/email', { body: { email: signup.email, password: newPassword } }))
        .status
    ).toBe(200)
  })
})

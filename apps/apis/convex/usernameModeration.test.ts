// @vitest-environment node
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { createFunctionHandle } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { USERNAME_NOT_ALLOWED_MESSAGE } from '@artificer-toolkit/shared/account/username'
import { convexTest } from '../tests/convexTest'
import { api, components, internal } from './_generated/api'
import authSchema from './betterAuth/schema'
import schema from './schema'

const appOrigin = 'http://localhost:3000'

beforeEach(() => {
  vi.stubEnv('SITE_URL', appOrigin)
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('BETTER_AUTH_SECRET', 'username-moderation-secret-with-sufficient-length')
  vi.stubEnv('JWKS', '')
  vi.stubEnv('PUBLIC_SIGN_UP_ENABLED', 'true')
  vi.resetModules()
})
afterEach(() => vi.unstubAllEnvs())

// Drives the real Better Auth handler and the real account.updateProfile mutation; only the
// Convex platform (in-memory backend) is replaced.
async function backend() {
  const { createAuth } = await import('./authFactory.helper')
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const post = (path: 'sign-up/email' | 'sign-in/username', body: Record<string, string>) =>
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
          method: 'POST',
          headers: { origin: appOrigin, 'content-type': 'application/json' },
          body: JSON.stringify(body)
        })
      )
      const result = (await response.json()) as { code?: string }
      return { status: response.status, code: result.code }
    })
  const signUp = (body: { name: string; email: string; username: string; password: string }) =>
    post('sign-up/email', body)
  const signIn = (body: { username: string; password: string }) => post('sign-in/username', body)
  // Puts an account in a state sign-up could not create: verified, with a name a later rule refuses.
  const verifyAndRename = (email: string, username: string) =>
    t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: 'email', value: email }],
          update: {
            emailVerified: true,
            username: username.toLowerCase(),
            displayUsername: username
          }
        }
      })
    )
  const findUser = (email: string) =>
    t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: 'email', value: email }]
      })
    )
  const signedInClient = async () => {
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Moderation test',
            email: `${crypto.randomUUID()}@example.invalid`,
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const session = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: user._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 3 * 86_400_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    return t.withIdentity({ subject: user._id, sessionId: session._id })
  }
  return { signUp, signIn, verifyAndRename, findUser, signedInClient }
}

function signupInput(username: string) {
  return {
    name: 'Moderation journey',
    email: `moderation-${crypto.randomUUID()}@example.invalid`,
    username,
    password: 'Local-journey-password-8175!'
  }
}

describe('server-only username compound check (Q22)', () => {
  it('refuses an unbroken blocked compound at signup and creates no account', async () => {
    const { signUp, findUser } = await backend()
    const refused = signupInput('assmuncher')

    expect(await signUp(refused)).toEqual({ status: 400, code: 'INVALID_USERNAME' })
    expect(await findUser(refused.email)).toBeNull()
  })

  it('accepts an ordinary name the substring check used to refuse at signup', async () => {
    const { signUp, findUser } = await backend()
    const accepted = signupInput('cassandra')

    expect(await signUp(accepted)).toMatchObject({ status: 200 })
    expect(await findUser(accepted.email)).toMatchObject({ username: 'cassandra' })
  })

  it('accepts a case-split name at signup and keeps the typed casing as the display name', async () => {
    const { signUp, findUser } = await backend()
    const accepted = signupInput('TitanFall')

    expect(await signUp(accepted)).toMatchObject({ status: 200 })
    expect(await findUser(accepted.email)).toMatchObject({ displayUsername: 'TitanFall' })
  })

  // Moderation runs at sign-up and rename only; sign-in must never lock an existing account out.
  it('signs in with the lowercased name of an account registered with a mixed-case name', async () => {
    const { signUp, signIn, verifyAndRename } = await backend()
    const account = signupInput('TitanSlayer')

    expect(await signUp(account)).toMatchObject({ status: 200 })
    await verifyAndRename(account.email, 'TitanSlayer')

    expect(await signIn({ username: 'titanslayer', password: account.password })).toMatchObject({
      status: 200
    })
  })

  it('signs in to an account whose name a later rule would refuse', async () => {
    const { signUp, signIn, verifyAndRename } = await backend()
    const account = signupInput('Cassandra')

    expect(await signUp(account)).toMatchObject({ status: 200 })
    await verifyAndRename(account.email, 'AssMuncher')

    expect(await signIn({ username: 'assmuncher', password: account.password })).toMatchObject({
      status: 200
    })
  })

  it('applies the same check to a rename', async () => {
    const { signedInClient } = await backend()
    const client = await signedInClient()

    await expect(
      client.mutation(api.account.updateProfile, { username: 'assmuncher', bio: null })
    ).rejects.toThrow(USERNAME_NOT_ALLOWED_MESSAGE)
    await expect(
      client.mutation(api.account.updateProfile, { username: 'Cassandra', bio: null })
    ).resolves.toMatchObject({ username: 'Cassandra' })
  })
})

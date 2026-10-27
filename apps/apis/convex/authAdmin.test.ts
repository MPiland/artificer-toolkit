import { authIdentityDtoSchema } from '@artificer-toolkit/schema/api/authIdentity'
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { afterEach, describe, expect, it } from 'vitest'
import { api, components, internal } from './_generated/api'
import { createAuth, createAuthOptions } from './authFactory.helper'
import { setRole } from './authAdmin'
import authSchema from './betterAuth/schema'
import { requireSuperadmin } from './lib/identity'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'
afterEach(() => {
  delete process.env.PUBLIC_SIGN_UP_ENABLED
})

const setRoleReference = makeFunctionReference<
  'mutation',
  { userId: string; role: 'user' | 'superadmin' },
  null
>('authAdmin:setRole')

async function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Role proof',
          email: `${crypto.randomUUID()}@example.invalid`,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
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
  )
  const caller = t.withIdentity({ subject: user._id, sessionId: session._id, role: 'superadmin' })
  const identity = authIdentityDtoSchema.parse(await caller.query(api.account.identity, {}))
  return { t, caller, user, session, identity }
}

describe('Better Auth superadmin boundary', () => {
  it('uses an internal-only mutation and the current stored role, never token role claims', async () => {
    const { t, caller, identity } = await fixture()
    expect(setRole.isInternal).toBe(true)
    expect(identity.role).toBe('user')
    await expect(t.run(requireSuperadmin)).rejects.toThrow('Unauthenticated')
    await expect(caller.run(requireSuperadmin)).rejects.toThrow('Forbidden')
    await t.mutation(setRoleReference, { userId: identity.userId, role: 'superadmin' })
    await expect(caller.run(requireSuperadmin)).resolves.toEqual({
      ...identity,
      role: 'superadmin'
    })
    expect((await caller.query(api.account.session, {})).isSuperAdmin).toBe(true)
    await t.mutation(setRoleReference, { userId: identity.userId, role: 'user' })
    await expect(caller.run(requireSuperadmin)).rejects.toThrow('Forbidden')
    expect((await caller.query(api.account.session, {})).isSuperAdmin).toBe(false)
  })

  it('rejects unknown, unverified, banned, or invalid promotion targets', async () => {
    const { t, user, identity } = await fixture()
    for (const userId of ['invalid', crypto.randomUUID()]) {
      await expect(t.mutation(setRoleReference, { userId, role: 'superadmin' })).rejects.toThrow()
    }
    for (const update of [{ emailVerified: false }, { emailVerified: true, banned: true }]) {
      await t.run((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: { model: 'user', where: [{ field: '_id', value: user._id }], update }
        })
      )
      await expect(
        t.mutation(setRoleReference, {
          userId: identity.userId,
          role: 'superadmin'
        })
      ).rejects.toThrow('verified, active')
    }
    // Demotion remains available even when an account is disabled.
    await expect(
      t.mutation(setRoleReference, {
        userId: identity.userId,
        role: 'user'
      })
    ).resolves.toBeNull()
  })

  it('rejects a banned account or revoked session even when its stored role is superadmin', async () => {
    const { t, caller, user, session, identity } = await fixture()
    await t.mutation(setRoleReference, { userId: identity.userId, role: 'superadmin' })
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: user._id }],
          update: { banned: true }
        }
      })
    )
    await expect(caller.run(requireSuperadmin)).rejects.toThrow('Unauthenticated')
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: user._id }],
          update: { banned: false }
        }
      })
    )
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'session', where: [{ field: '_id', value: session._id }] }
      })
    )
    await expect(caller.run(requireSuperadmin)).rejects.toThrow('Unauthenticated')
  })

  it('rolls back a role change if the surrounding mutation fails', async () => {
    const { t, caller, identity } = await fixture()
    await expect(
      t.run(async (ctx) => {
        await ctx.runMutation(setRoleReference, { userId: identity.userId, role: 'superadmin' })
        throw new Error('Injected abort')
      })
    ).rejects.toThrow('Injected abort')
    await expect(caller.run(requireSuperadmin)).rejects.toThrow('Forbidden')
    expect((await caller.query(api.account.identity, {})).userId).toBe(identity.userId)
  })

  it('disables every admin HTTP endpoint, including impersonation and arbitrary user updates', async () => {
    const { t } = await fixture()
    // Auth HTTP runs in an action that knows the caller's IP, as the registered route does.
    await t.withRequestMetadata({ ip: '127.0.0.1' }).action(async function handle(ctx) {
      const options = createAuthOptions(ctx)
      const plugin = options.plugins.find((entry) => entry.id === 'admin')
      if (!plugin || !('endpoints' in plugin)) throw new Error('Admin plugin is missing')
      const paths = Object.values(plugin.endpoints).map((endpoint) => endpoint.path)
      expect(paths).toContain('/admin/impersonate-user')
      const auth = createAuth(ctx)
      for (const path of paths) {
        expect(options.disabledPaths).toContain(path)
        const response = await auth.handler(
          new Request(`http://localhost:3000/api/auth${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          })
        )
        expect(response.status).toBe(404)
      }
    })
  })

  it('does not accept a superadmin role supplied with public signup', async () => {
    const { t } = await fixture()
    process.env.PUBLIC_SIGN_UP_ENABLED = 'true'
    const body = {
      name: 'Signup proof',
      email: `${crypto.randomUUID()}@example.invalid`,
      password: 'Local-only-signup-proof-851!',
      username: 'NewRoleReader'
    }
    await expect(
      t.run(async (ctx) =>
        createAuth(ctx).api.signUpEmail({
          body: { ...body, ...{ role: 'superadmin' } }
        })
      )
    ).rejects.toThrow('role is not allowed to be set')
    await t.run(async (ctx) => {
      const result = await createAuth(ctx).api.signUpEmail({ body })
      expect(result.user.role).toBe('user')
    })
  })
})

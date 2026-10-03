import { createFunctionHandle } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { describe, expect, it } from 'vitest'
import type { AccountPasswordUpdateInput } from '@artificer-toolkit/schema/api/account'
import { api, components, internal } from './_generated/api'
import { createAuth } from './authFactory.helper'
import authSchema from './betterAuth/schema'
import type { Doc as AuthDoc } from './betterAuth/_generated/dataModel'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

async function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  const password = 'Current-account-password-5271!'
  const users = await t.run(async (ctx) => {
    const auth = createAuth(ctx)
    const hash = await (await auth.$context).password.hash(password)
    const onCreateHandle = await createFunctionHandle(internal.auth.onCreate)
    const result = []
    for (let index = 0; index < 2; index++) {
      const user: AuthDoc<'user'> = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: `Account password proof ${index}`,
            email: `${crypto.randomUUID()}@example.invalid`,
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle
      })
      const credential: AuthDoc<'account'> = await ctx.runMutation(
        components.betterAuth.adapter.create,
        {
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
        }
      )
      const signedIn = await auth.api.signInEmail({
        body: { email: user.email, password },
        headers: new Headers({ origin: 'http://localhost:3000' }),
        returnHeaders: true
      })
      const responseHeaders: Headers = signedIn.headers
      const headers = new Headers({ origin: 'http://localhost:3000' })
      headers.set(
        'cookie',
        responseHeaders
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; ')
      )
      const session: AuthDoc<'session'> | null = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        {
          model: 'session',
          where: [{ field: 'token', value: signedIn.response.token }]
        }
      )
      if (!session) throw new Error('Missing signed-in session.')
      result.push({ user, credential, cookie: headers.get('cookie')!, session })
    }
    return result
  })
  const owner = {
    ...users[0]!,
    headers: new Headers({ origin: 'http://localhost:3000', cookie: users[0]!.cookie })
  }
  const other = users[1]!
  const update = (input: AccountPasswordUpdateInput, headers = owner.headers) =>
    t.run((ctx) => createAuth(ctx).api.updateAccountPassword({ body: input, headers }))
  const snapshot = () =>
    t.run(async (ctx) => ({
      users: await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'user',
        paginationOpts: { cursor: null, numItems: 10 }
      }),
      accounts: await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'account',
        paginationOpts: { cursor: null, numItems: 10 }
      }),
      sessions: await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'session',
        paginationOpts: { cursor: null, numItems: 10 }
      }),
      profiles: await ctx.db.query('userProfiles').take(3),
      jobs: await ctx.db.system.query('_scheduled_functions').take(1)
    }))
  return {
    t,
    owner,
    other,
    password,
    update,
    snapshot,
    input: {
      email: owner.user.email,
      currentPassword: password,
      password: 'New-account-password-6392!'
    }
  }
}

describe('native account password update', () => {
  it('updates only the current credential after exact email/password confirmation and preserves every session and other account', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    for (const page of [before.users, before.accounts, before.sessions])
      expect(page.isDone).toBe(true)
    const result = await base.update({ ...base.input, email: base.input.email.toUpperCase() })
    expect(result).toBeNull()
    const after = await base.snapshot()
    const afterAccounts: AuthDoc<'account'>[] = after.accounts.page
    const beforeAccounts: AuthDoc<'account'>[] = before.accounts.page
    const changed = afterAccounts.find((entry) => entry._id === base.owner.credential._id)!
    const original = beforeAccounts.find((entry) => entry._id === base.owner.credential._id)!
    expect(changed.password).not.toBe(original.password)
    await base.t.run(async (ctx) => {
      const verify = (await createAuth(ctx).$context).password.verify
      expect(await verify({ hash: changed.password!, password: base.input.password })).toBe(true)
      expect(await verify({ hash: changed.password!, password: base.password })).toBe(false)
    })
    expect(after).toEqual({
      ...before,
      accounts: {
        ...before.accounts,
        page: beforeAccounts.map((entry) =>
          entry._id === changed._id
            ? { ...entry, password: changed.password, updatedAt: changed.updatedAt }
            : entry
        )
      }
    })
    await expect(
      base.t
        .withIdentity({ subject: base.owner.user._id, sessionId: base.owner.session._id })
        .query(api.account.identity, {})
    ).resolves.toHaveProperty('userId')
    await expect(
      base.t
        .withIdentity({ subject: base.other.user._id, sessionId: base.other.session._id })
        .query(api.account.identity, {})
    ).resolves.toHaveProperty('userId')
    await expect(base.update(base.input)).rejects.toThrow('Invalid password')
    expect(await base.snapshot()).toEqual(after)
  })

  it('refuses foreign/stale email, wrong password, extra identity and invalid inputs without changing state', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    await expect(base.update({ ...base.input, email: base.other.user.email })).rejects.toThrow(
      'Your account email has changed'
    )
    await expect(
      base.update({ ...base.input, currentPassword: 'Incorrect-current-password!' })
    ).rejects.toThrow('Invalid password')
    for (const input of [
      { ...base.input, ...{ userId: base.other.user._id } },
      { ...base.input, email: 'invalid-email' },
      { ...base.input, currentPassword: '' },
      { ...base.input, password: 'short' }
    ])
      await expect(base.update(input)).rejects.toThrow()
    await expect(
      base.update(base.input, new Headers({ origin: 'http://localhost:3000' }))
    ).rejects.toThrow('Unauthorized')
    expect(await base.snapshot()).toEqual(before)
  })

  it('reads current stored email and revoked session instead of trusting a previous browser session', async () => {
    const base = await fixture()
    const email = `${crypto.randomUUID()}@example.invalid`
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: base.owner.user._id }],
          update: { email }
        }
      })
    )
    const changedEmail = await base.snapshot()
    await expect(base.update(base.input)).rejects.toThrow('Your account email has changed')
    expect(await base.snapshot()).toEqual(changedEmail)
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'session', where: [{ field: '_id', value: base.owner.session._id }] }
      })
    )
    const revoked = await base.snapshot()
    await expect(base.update({ ...base.input, email })).rejects.toThrow('Unauthorized')
    expect(await base.snapshot()).toEqual(revoked)
  })
})

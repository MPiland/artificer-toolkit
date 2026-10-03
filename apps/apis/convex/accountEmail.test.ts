import { signJWT, verifyJWT } from 'better-auth/crypto'
import { createFunctionHandle, type PaginationResult } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { describe, expect, it } from 'vitest'
import { authEmailDeliveryInputSchema } from '@artificer-toolkit/schema/api/auth'

import { components, internal } from './_generated/api'
import { createAuth } from './authFactory.helper'
import authSchema from './betterAuth/schema'
import type { Doc as AuthDoc } from './betterAuth/_generated/dataModel'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

async function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  const password = 'Current-account-email-9472!'
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
            name: `Account email proof ${index}`,
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
      const cookie = responseHeaders
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ')
      const session: AuthDoc<'session'> | null = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        { model: 'session', where: [{ field: 'token', value: signedIn.response.token }] }
      )
      if (!session) throw new Error('Missing signed-in session.')
      result.push({ user, credential, session, cookie })
    }
    return result
  })
  const owner = {
    ...users[0]!,
    headers: new Headers({ origin: 'http://localhost:3000', cookie: users[0]!.cookie })
  }
  const other = {
    ...users[1]!,
    headers: new Headers({ origin: 'http://localhost:3000', cookie: users[1]!.cookie })
  }
  const changeEmail = (newEmail: string, headers = owner.headers) =>
    t.run((ctx) =>
      createAuth(ctx).api.changeEmail({
        body: { newEmail, callbackURL: 'http://localhost:3000/ignored-by-account-email' },
        headers
      })
    )
  const verifyEmail = (token: string, headers = owner.headers) =>
    t.run((ctx) => createAuth(ctx).api.verifyEmail({ query: { token }, headers }))
  const snapshot = async () => {
    const state = await t.run(async (ctx) => {
      const users: PaginationResult<AuthDoc<'user'>> = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        { model: 'user', paginationOpts: { cursor: null, numItems: 10 } }
      )
      const accounts: PaginationResult<AuthDoc<'account'>> = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        { model: 'account', paginationOpts: { cursor: null, numItems: 10 } }
      )
      const sessions: PaginationResult<AuthDoc<'session'>> = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        { model: 'session', paginationOpts: { cursor: null, numItems: 10 } }
      )
      return { users, accounts, sessions, profiles: await ctx.db.query('userProfiles').collect() }
    })
    for (const page of [state.users, state.accounts, state.sessions]) expect(page.isDone).toBe(true)
    return state
  }
  const deliveries = () =>
    t.run(async (ctx) => {
      const jobs = await ctx.db.system.query('_scheduled_functions').collect()
      return jobs.map((job) => authEmailDeliveryInputSchema.parse(job.args[0]))
    })
  return { t, owner, other, changeEmail, verifyEmail, snapshot, deliveries }
}

function tokenFrom(actionUrl: string): string {
  const token = new URL(actionUrl).searchParams.get('token')
  if (!token) throw new Error('Missing Better Auth verification token.')
  return token
}

describe('native account email change', () => {
  it('requires current-address then new-address confirmation and preserves profiles, credentials, sessions, and other accounts', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    const newEmail = `${crypto.randomUUID()}@example.invalid`

    await expect(base.changeEmail(newEmail)).resolves.toMatchObject({ status: true })
    const [currentAddressDelivery] = await base.deliveries()
    expect(currentAddressDelivery).toMatchObject({
      action: 'email_change',
      recipient: base.owner.user.email
    })
    expect(new URL(currentAddressDelivery!.actionUrl).searchParams.get('callbackURL')).toBe(
      'http://localhost:3000/settings/account?emailChanged=1'
    )
    const currentAddressToken = tokenFrom(currentAddressDelivery!.actionUrl)
    expect(
      await verifyJWT<unknown>(currentAddressToken, process.env.BETTER_AUTH_SECRET!)
    ).toMatchObject({ requestType: 'change-email-confirmation' })
    expect(await base.snapshot()).toEqual(before)

    await expect(base.verifyEmail(currentAddressToken)).resolves.toMatchObject({ status: true })
    const [, newAddressDelivery] = await base.deliveries()
    expect(newAddressDelivery).toMatchObject({ action: 'email_change', recipient: newEmail })
    expect(new URL(newAddressDelivery!.actionUrl).searchParams.get('callbackURL')).toBe(
      'http://localhost:3000/settings/account?emailChanged=1'
    )
    const newAddressToken = tokenFrom(newAddressDelivery!.actionUrl)
    expect(
      await verifyJWT<unknown>(newAddressToken, process.env.BETTER_AUTH_SECRET!)
    ).toMatchObject({
      requestType: 'change-email-verification'
    })
    expect(await base.snapshot()).toEqual(before)

    await expect(base.verifyEmail(newAddressToken)).resolves.toMatchObject({ status: true })
    const after = await base.snapshot()
    expect(after.accounts).toEqual(before.accounts)
    expect(after.sessions).toEqual(before.sessions)
    expect(after.profiles).toEqual(before.profiles)
    expect(after.users.page.find((user) => user._id === base.owner.user._id)).toMatchObject({
      email: newEmail,
      emailVerified: true
    })
    expect(after.users.page.find((user) => user._id === base.other.user._id)).toEqual(
      before.users.page.find((user) => user._id === base.other.user._id)
    )
  })

  it('refuses anonymous, revoked, foreign, tampered, and expired requests without changing accounts', async () => {
    const base = await fixture()
    const newEmail = `${crypto.randomUUID()}@example.invalid`
    const anonymousHeaders = new Headers({ origin: 'http://localhost:3000' })

    const beforeAnonymous = await base.snapshot()
    await expect(base.changeEmail(newEmail, anonymousHeaders)).rejects.toThrow('Unauthorized')
    expect(await base.snapshot()).toEqual(beforeAnonymous)

    await expect(base.changeEmail(newEmail)).resolves.toMatchObject({ status: true })
    const [delivery] = await base.deliveries()
    const beforeRefusals = await base.snapshot()
    const currentAddressToken = tokenFrom(delivery!.actionUrl)
    await expect(base.verifyEmail(currentAddressToken, base.other.headers)).rejects.toThrow()
    await expect(base.verifyEmail(`${currentAddressToken}x`)).rejects.toThrow()
    const expiredToken = await signJWT(
      {
        email: base.owner.user.email,
        updateTo: newEmail,
        requestType: 'change-email-verification'
      },
      process.env.BETTER_AUTH_SECRET!,
      -1
    )
    await expect(base.verifyEmail(expiredToken)).rejects.toThrow()
    expect(await base.deliveries()).toEqual([delivery])
    expect(await base.snapshot()).toEqual(beforeRefusals)

    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'session', where: [{ field: '_id', value: base.owner.session._id }] }
      })
    )
    const revoked = await base.snapshot()
    await expect(base.changeEmail(newEmail)).rejects.toThrow('Unauthorized')
    await expect(base.changeEmail(newEmail, anonymousHeaders)).rejects.toThrow('Unauthorized')
    expect(await base.snapshot()).toEqual(revoked)
  })
  it('confirms in a signed-out browser with one new owner session, retaining existing sessions and refusing replay', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    const newEmail = `${crypto.randomUUID()}@example.invalid`
    const anonymousHeaders = new Headers({ origin: 'http://localhost:3000' })

    await base.changeEmail(newEmail)
    const [currentAddressDelivery] = await base.deliveries()
    await expect(
      base.verifyEmail(tokenFrom(currentAddressDelivery!.actionUrl), anonymousHeaders)
    ).resolves.toMatchObject({ status: true })
    expect(await base.snapshot()).toEqual(before)
    const [, newAddressDelivery] = await base.deliveries()
    const token = tokenFrom(newAddressDelivery!.actionUrl)
    const confirmation = await base.t.run(async (ctx) => {
      const result = await createAuth(ctx).api.verifyEmail({
        query: { token },
        headers: anonymousHeaders,
        returnHeaders: true
      })
      const responseHeaders: Headers = result.headers
      return { body: result.response, cookies: responseHeaders.getSetCookie() }
    })
    expect(confirmation.body).toMatchObject({ status: true, user: { email: newEmail } })
    expect(confirmation.cookies).toEqual(
      expect.arrayContaining([expect.stringContaining('better-auth.session_token=')])
    )
    const after = await base.snapshot()
    expect(after.accounts).toEqual(before.accounts)
    expect(after.profiles).toEqual(before.profiles)
    for (const session of before.sessions.page)
      expect(after.sessions.page.find((row) => row._id === session._id)).toEqual(session)
    const newSessions = after.sessions.page.filter(
      (session) => !before.sessions.page.some((row) => row._id === session._id)
    )
    expect(newSessions).toHaveLength(1)
    expect(newSessions[0]).toMatchObject({ userId: base.owner.user._id })
    expect(after.users.page.find((user) => user._id === base.other.user._id)).toEqual(
      before.users.page.find((user) => user._id === base.other.user._id)
    )
    await expect(base.verifyEmail(token, anonymousHeaders)).rejects.toThrow()
    expect(await base.snapshot()).toEqual(after)
    expect(await base.deliveries()).toEqual([currentAddressDelivery, newAddressDelivery])
  })
})

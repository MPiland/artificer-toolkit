import { createFunctionHandle, type PaginationResult } from 'convex/server'
import { JWT_COOKIE_NAME } from '@convex-dev/better-auth/plugins'
import { convexTest } from '../tests/convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AccountDeleteInput } from '@artificer-toolkit/schema/api/account'
import {
  advanceAccountDeletion,
  drainScheduledWork,
  runAccountDeletionStep
} from '../tests/fixtures/accountDeletion'
import type { Doc, TableNames } from './_generated/dataModel'
import { components, internal } from './_generated/api'
import { createAuth } from './authFactory.helper'
import authSchema from './betterAuth/schema'
import type { Doc as AuthDoc } from './betterAuth/_generated/dataModel'
import { AUTH_PROXY_CONTEXT_HEADER, signAuthProxyContext } from './lib/authProxyContext'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.CONVEX_SITE_URL = 'http://127.0.0.1:3211'
process.env.AUTH_PROXY_SECRET = 'native-account-delete-http-test-proxy-secret-'.repeat(3)
process.env.BETTER_AUTH_SECRET = 'native-account-delete-http-test-secret-with-sufficient-length'

const path = '/api/auth/account/delete'
const audience = process.env.CONVEX_SITE_URL

async function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const password = 'Native-http-delete-password-2817!'
  const users = await t.run(async (ctx) => {
    const auth = createAuth(ctx)
    const hash = await (await auth.$context).password.hash(password)
    const create = await createFunctionHandle(internal.auth.onCreate)
    const result = []
    for (const index of [0, 1]) {
      const user: AuthDoc<'user'> = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: `Delete HTTP ${index}`,
            email: `delete-http-${index}@example.invalid`,
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
      const cookie = responseHeaders
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ')
      const session: AuthDoc<'session'> | null = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        { model: 'session', where: [{ field: 'token', value: signed.response.token }] }
      )
      if (!session) throw new Error('Missing signed session.')
      result.push({
        user,
        session,
        cookie,
        sessionCookieName: (await auth.$context).authCookies.sessionToken.name,
        jwtCookieName: (await auth.$context).createAuthCookie(JWT_COOKIE_NAME).name
      })
    }
    return result
  })
  const tables = Object.keys(schema.tables) as TableNames[]
  const snapshot = () =>
    t.run(async (ctx) => {
      const app = Object.fromEntries(
        await Promise.all(tables.map(async (table) => [table, await ctx.db.query(table).collect()]))
      )
      const users: PaginationResult<AuthDoc<'user'>> = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        { model: 'user', paginationOpts: { cursor: null, numItems: 100 } }
      )
      const accounts: PaginationResult<AuthDoc<'account'>> = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        { model: 'account', paginationOpts: { cursor: null, numItems: 100 } }
      )
      const sessions: PaginationResult<AuthDoc<'session'>> = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        { model: 'session', paginationOpts: { cursor: null, numItems: 100 } }
      )
      return {
        app,
        schedules: await ctx.db.system.query('_scheduled_functions').collect(),
        users,
        accounts,
        sessions
      }
    })
  const request = async (
    body: AccountDeleteInput | Record<string, unknown>,
    cookie = users[0]!.cookie,
    origin = 'http://localhost:3000'
  ) =>
    t.fetch(path, {
      method: 'POST',
      headers: {
        origin,
        cookie,
        'content-type': 'application/json',
        [AUTH_PROXY_CONTEXT_HEADER]: await signAuthProxyContext(
          { method: 'POST', path, ip: '192.0.2.11' },
          audience
        )
      },
      body: JSON.stringify(body)
    })
  return { t, owner: users[0]!, other: users[1]!, password, snapshot, request }
}

describe('account deletion HTTP endpoint', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('deletes only the signed-in account and expires exact session and Convex JWT cookies after commit', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    for (const catalogue of [before.users, before.accounts, before.sessions])
      expect(catalogue.isDone).toBe(true)
    // The staged steps (ADR 0040) wait on the fake clock until the drain below runs them.
    vi.useFakeTimers({ now: Date.now() })
    const response = await base.request({
      email: base.owner.user.email,
      currentPassword: base.password
    })
    expect(response.status).toBe(200)
    const cookies = response.headers.getSetCookie()
    for (const name of [base.owner.sessionCookieName, base.owner.jwtCookieName]) {
      const expired = cookies.find((value) => value.startsWith(`${name}=`))
      expect(expired, 'Missing expired auth cookie: ' + name).toContain('Max-Age=0')
    }
    // The request signs the account out at once, before any staged step runs.
    expect((await base.snapshot()).sessions).toEqual({
      ...before.sessions,
      page: before.sessions.page.filter((row) => row.userId !== base.owner.user._id)
    })
    await drainScheduledWork(base.t)
    const after = await base.snapshot()
    expect(after.users).toEqual({
      ...before.users,
      page: before.users.page.filter((row) => row._id !== base.owner.user._id)
    })
    expect(after.accounts).toEqual({
      ...before.accounts,
      page: before.accounts.page.filter((row) => row.userId !== base.owner.user._id)
    })
    expect(after.sessions).toEqual({
      ...before.sessions,
      page: before.sessions.page.filter((row) => row.userId !== base.owner.user._id)
    })
    const beforeProfiles: Doc<'userProfiles'>[] = before.app.userProfiles
    const afterProfiles: Doc<'userProfiles'>[] = after.app.userProfiles
    expect(afterProfiles).toEqual(
      beforeProfiles.filter((row) => row.authUserId !== base.owner.user._id)
    )
  }, 30_000)

  it('rejects revoked sessions without writes and only retires an expired token', async () => {
    const base = await fixture()
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'session', where: [{ field: '_id', value: base.owner.session._id }] }
      })
    )
    const before = await base.snapshot()
    const response = await base.request({
      email: base.owner.user.email,
      currentPassword: base.password
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(await base.snapshot()).toEqual(before)
    const expired = await fixture()
    await expired.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'session',
          where: [{ field: '_id', value: expired.owner.session._id }],
          update: { expiresAt: Date.now() - 1 }
        }
      })
    )
    const expiredBefore = await expired.snapshot()
    expect(
      (
        await expired.request({
          email: expired.owner.user.email,
          currentPassword: expired.password
        })
      ).status
    ).toBeGreaterThanOrEqual(400)
    // Better Auth retires the expired token; deletion must preserve every other record.
    expect(await expired.snapshot()).toEqual({
      ...expiredBefore,
      sessions: {
        ...expiredBefore.sessions,
        page: expiredBefore.sessions.page.filter(
          (session) => session._id !== expired.owner.session._id
        )
      }
    })
  }, 30_000)

  it('rolls back only the failing late deletion step and keeps the job for retry', async () => {
    const base = await fixture()
    const userId = await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_authUserId', (q) => q.eq('authUserId', base.owner.user._id))
        .unique()
      // One row beyond the latest-25 feed bound makes the late FINISH step fail.
      for (let index = 0; index < 26; index++) {
        const occurredAt = new Date(Date.UTC(2026, 8, 4, 0, 0, index)).toISOString()
        const sourcePublicId = crypto.randomUUID()
        await ctx.db.insert('notificationFeedItems', {
          id: crypto.randomUUID(),
          userId: profile!.userId,
          workflowKey: 'social-application-decided',
          sourceKind: 'SOCIAL_APPLICATION',
          sourcePublicId,
          groupingKey: null,
          data: {
            kind: 'SOCIAL_APPLICATION_DECIDED',
            sourcePublicId,
            listingPublicId: crypto.randomUUID(),
            listingTitle: 'Game invitation',
            decision: 'ACCEPTED',
            occurredAt
          },
          occurredAt,
          seenAt: null,
          readAt: null
        })
      }
      return profile!.userId
    })
    // Scheduled steps stay pending on the fake clock, so the test drives each one itself.
    vi.useFakeTimers({ now: Date.now() })
    const response = await base.request({
      email: base.owner.user.email,
      currentPassword: base.password
    })
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().join('; ')).toContain('Max-Age=0')
    await advanceAccountDeletion(base.t, userId, 'FINISH')
    const before = await base.snapshot()
    await expect(
      runAccountDeletionStep(base.t, userId, internal.accountDeletionFinish.step)
    ).rejects.toThrow('Notification retention limit exceeded.')
    expect(await base.snapshot()).toEqual(before)
    expect(
      before.users.page.some((row) => row._id === base.owner.user._id),
      'The provider account outlives a failed step.'
    ).toBe(true)
  }, 30_000)
  it('rejects invalid, stale, foreign-origin, and client-supplied identity requests without writes', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    for (const [index, [body, cookie, origin]] of (
      [
        [
          { email: base.owner.user.email, currentPassword: 'wrong-password' },
          base.owner.cookie,
          'http://localhost:3000'
        ],
        [
          { email: base.other.user.email, currentPassword: base.password },
          base.owner.cookie,
          'http://localhost:3000'
        ],
        [
          {
            email: base.owner.user.email,
            currentPassword: base.password,
            userId: base.other.user._id
          },
          base.owner.cookie,
          'http://localhost:3000'
        ],
        [
          { email: base.owner.user.email, currentPassword: base.password },
          '',
          'http://localhost:3000'
        ],
        [
          { email: base.owner.user.email, currentPassword: base.password },
          base.owner.cookie,
          'https://attacker.example'
        ]
      ] as const
    ).entries()) {
      const response = await base.request(body, cookie, origin)
      expect(response.status, 'Refusal variant ' + index).toBeGreaterThanOrEqual(400)
      expect(await base.snapshot()).toEqual(before)
    }
    expect(await base.snapshot()).toEqual(before)
  }, 30_000)
})

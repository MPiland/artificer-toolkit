import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { components } from '../_generated/api'
import authSchema from '../betterAuth/schema'
import schema from '../schema'
import { authComponent } from './authClient.helper'
import { readAuthenticatedAuthUser, readAuthUser } from './authUserReads'

const t = convexTest(schema, import.meta.glob('../**/*.*s'))

t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))

const now = new Date('2026-09-16T12:00:00.000Z').getTime()

async function createUser() {
  return await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Auth reader test user',
          email: `auth-reader-${crypto.randomUUID()}@example.com`,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
}

async function createSession(userId: string, expiresAt: number) {
  return await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId,
          token: crypto.randomUUID(),
          expiresAt,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
}

async function deleteAuthRecord(model: 'session' | 'user', id: string) {
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: {
        model,
        where: [{ field: '_id', value: id }]
      }
    })
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('auth user readers', () => {
  it.each([
    'anonymous',
    'valid session and user',
    'expired session at the current-time boundary',
    'deleted session',
    'deleted user'
  ] as const)('matches Better Auth safeGetAuthUser for %s', async (scenario) => {
    if (scenario === 'anonymous') {
      await t.run(async (ctx) => {
        expect(await readAuthenticatedAuthUser(ctx)).toEqual(
          (await authComponent.safeGetAuthUser(ctx)) ?? null
        )
      })
      return
    }

    const user = await createUser()
    const session = await createSession(
      user._id,
      scenario === 'expired session at the current-time boundary' ? Date.now() : Date.now() + 60_000
    )

    if (scenario === 'deleted session') {
      await deleteAuthRecord('session', session._id)
    }
    if (scenario === 'deleted user') {
      await deleteAuthRecord('user', user._id)
    }

    await t.withIdentity({ subject: user._id, sessionId: session._id }).run(async (ctx) => {
      expect(await readAuthenticatedAuthUser(ctx)).toEqual(
        (await authComponent.safeGetAuthUser(ctx)) ?? null
      )
    })

    if (scenario === 'valid session and user') {
      await t.run(async (ctx) => {
        const missingUserId = crypto.randomUUID()
        expect(await readAuthUser(ctx, user._id)).toEqual(
          await authComponent.getAnyUserById(ctx, user._id)
        )
        expect(await readAuthUser(ctx, missingUserId)).toEqual(
          await authComponent.getAnyUserById(ctx, missingUserId)
        )
      })
    }
  })
})

it('rejects a signed subject paired with another user session without writes', async () => {
  const owner = await createUser()
  const foreign = await createUser()
  const session = await createSession(foreign._id, Date.now() + 60_000)
  const snapshot = () =>
    t.run(async (ctx) => ({
      owner: await readAuthUser(ctx, owner._id),
      foreign: await readAuthUser(ctx, foreign._id),
      session: await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'session',
        where: [{ field: '_id', value: session._id }]
      })
    }))
  const before = await snapshot()
  await expect(
    t
      .withIdentity({ subject: owner._id, sessionId: session._id })
      .run((ctx) => readAuthenticatedAuthUser(ctx))
  ).resolves.toBeNull()
  expect(await snapshot()).toEqual(before)
})

it('rejects missing and malformed session claims', async () => {
  const user = await createUser()
  for (const identity of [
    { subject: user._id },
    { subject: user._id, sessionId: crypto.randomUUID() },
    { subject: crypto.randomUUID(), sessionId: crypto.randomUUID() }
  ]) {
    await expect(
      t.withIdentity(identity).run((ctx) => readAuthenticatedAuthUser(ctx))
    ).resolves.toBeNull()
  }
})

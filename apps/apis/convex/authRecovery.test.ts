import { createHash } from 'node:crypto'
import { convexTest } from '../tests/convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { describe, expect, it } from 'vitest'
import { components, internal } from './_generated/api'
import schema from './schema'
import authSchema from './betterAuth/schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const email = `${crypto.randomUUID()}@example.invalid`
  const identifier = `forget-password-otp-${email}`
  return {
    t,
    email,
    identifier,
    async user() {
      await t.run(async (ctx) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: 'user',
            data: {
              email,
              name: 'Recovery proof',
              emailVerified: true,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
          }
        })
      )
    },
    async code(code: string, createdAt: number) {
      return await t.run(async (ctx) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: 'verification',
            data: {
              identifier,
              value: `${createHash('sha256').update(code).digest('base64url')}:0`,
              createdAt,
              updatedAt: createdAt,
              expiresAt: Date.now() + 60_000
            }
          }
        })
      )
    }
  }
}

describe('transactional password recovery', () => {
  it('throttles resends for nonexistent accounts too and canonicalizes email casing', async () => {
    const { t, email } = fixture()
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        t.mutation(internal.authRecovery.execute, {
          command: { operation: 'REQUEST', email: attempt % 2 ? email.toUpperCase() : email }
        })
      ).resolves.toEqual({ success: true })
    }
    await expect(
      t.mutation(internal.authRecovery.execute, {
        command: { operation: 'REQUEST', email }
      })
    ).resolves.toMatchObject({ success: false, status: 429 })
  })

  it('updates attempts on the exact newest row and consumes all older codes on success', async () => {
    const { t, email, identifier, user, code } = fixture()
    await user()
    const older = await code('123456', Date.now() - 1000)
    const latest = await code('654321', Date.now())
    await expect(
      t.mutation(internal.authRecovery.execute, {
        command: { operation: 'CHECK', email, token: '000000' }
      })
    ).resolves.toMatchObject({ success: false, status: 400 })
    const rows: { page: Array<{ _id: string; value: string }> } = await t.run(async (ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'verification',
        where: [{ field: 'identifier', operator: 'eq', value: identifier }],
        paginationOpts: { cursor: null, numItems: 10 }
      })
    )
    expect(rows.page.find((row) => row._id === older._id)?.value).toMatch(/:0$/)
    expect(rows.page.find((row) => row._id === latest._id)?.value).toMatch(/:1$/)
    const password = 'Local-secure-replacement-8175!'
    await expect(
      t.mutation(internal.authRecovery.execute, {
        command: { operation: 'RESET', email, token: '654321', password }
      })
    ).resolves.toEqual({ success: true })
    for (const token of ['654321', '123456']) {
      await expect(
        t.mutation(internal.authRecovery.execute, {
          command: { operation: 'RESET', email, token, password }
        })
      ).resolves.toMatchObject({ success: false, status: 400 })
    }
  })

  it('commits failed attempts rather than rolling them back with the expected error', async () => {
    const { t, email, user, code } = fixture()
    await user()
    await code('654321', Date.now())
    const password = 'Local-secure-replacement-8175!'
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        t.mutation(internal.authRecovery.execute, {
          command: { operation: 'RESET', email, token: '000000', password }
        })
      ).resolves.toMatchObject({ success: false, status: 400 })
    }
    await expect(
      t.mutation(internal.authRecovery.execute, {
        command: { operation: 'RESET', email, token: '654321', password }
      })
    ).resolves.toMatchObject({ success: false, status: 403 })
  })

  it('does not revive a superseded code when CHECK exhausts the current code', async () => {
    const { t, email, user, code } = fixture()
    await user()
    await code('123456', Date.now() - 1000)
    await code('654321', Date.now())
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        t.mutation(internal.authRecovery.execute, {
          command: { operation: 'CHECK', email, token: '000000' }
        })
      ).resolves.toMatchObject({ success: false, status: 400 })
    }
    await expect(
      t.mutation(internal.authRecovery.execute, {
        command: { operation: 'CHECK', email, token: '654321' }
      })
    ).resolves.toMatchObject({ success: false, status: 403 })
    for (const token of ['123456', '654321']) {
      await expect(
        t.mutation(internal.authRecovery.execute, {
          command: { operation: 'RESET', email, token, password: 'Local-secure-replacement-8175!' }
        })
      ).resolves.toMatchObject({ success: false, status: 400 })
    }
  })
})

import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../_generated/api'
import schema from '../schema'
import { consumeSocialRateLimit } from './rateLimits'
import { zeroAccountUsage } from '@artificer-toolkit/schema/projections/accountUsage'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2030-01-01T00:15:00.000Z'))
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('native Social fixed-window limits', () => {
  it.each([
    ['APPLICATION', 10],
    ['INVITE', 20],
    ['REPORT', 5],
    ['BLOCK', 30]
  ] as const)(
    'preserves the %s hourly allowance of %i and isolates accounts/actions',
    async (action, limit) => {
      const t = convexTest(schema, modules)
      const userId = crypto.randomUUID()
      for (let count = 0; count < limit; count++)
        await t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))
      const before = await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())
      await expect(t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))).rejects.toThrow(
        'Too many Social actions'
      )
      expect(await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())).toEqual(before)
      await t.run((ctx) => consumeSocialRateLimit(ctx, crypto.randomUUID(), action))
      await t.run((ctx) =>
        consumeSocialRateLimit(ctx, userId, action === 'BLOCK' ? 'INVITE' : 'BLOCK')
      )
      expect(before.find((row) => row.window === 'HOUR')).toMatchObject({
        count: limit,
        windowStartedAt: '2030-01-01T00:00:00.000Z'
      })
    }
  )

  it.each([
    ['APPLICATION', 10, 3],
    ['REPORT', 5, 4]
  ] as const)(
    'keeps the %s daily allowance across hours and rolls back the hour when the day rejects',
    async (action, perHour, hours) => {
      const t = convexTest(schema, modules)
      const userId = crypto.randomUUID()
      for (let hour = 0; hour < hours; hour++) {
        vi.setSystemTime(new Date(Date.UTC(2030, 0, 1, hour, 15)))
        for (let count = 0; count < perHour; count++)
          await t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))
      }
      const before = await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())
      expect(before).toHaveLength(2)
      expect(before.find((row) => row.window === 'DAY')?.count).toBe(perHour * hours)
      vi.setSystemTime(new Date(Date.UTC(2030, 0, 1, hours, 15)))
      await expect(t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))).rejects.toThrow(
        'Too many Social actions'
      )
      expect(await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())).toEqual(before)
      vi.setSystemTime(new Date('2030-01-02T00:00:00.000Z'))
      await t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))
      const reset = await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())
      expect(reset.map((row) => row._id).sort()).toEqual(before.map((row) => row._id).sort())
      expect(
        reset.every((row) => row.count === 1 && row.windowStartedAt === '2030-01-02T00:00:00.000Z')
      ).toBe(true)
    }
  )

  it('uses UTC boundaries and cannot reset an allowance by moving the clock backwards', async () => {
    const t = convexTest(schema, modules)
    const userId = crypto.randomUUID()
    vi.setSystemTime(new Date('2030-01-01T01:59:59.999Z'))
    for (let count = 0; count < 29; count++)
      await t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))
    vi.setSystemTime(new Date('2030-01-01T00:59:59.999Z'))
    await t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))
    expect(
      (await t.run((ctx) => ctx.db.query('socialActionRateLimits').unique()))?.windowStartedAt
    ).toBe('2030-01-01T01:00:00.000Z')
    vi.setSystemTime(new Date('2030-01-01T01:59:59.999Z'))
    await expect(t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))).rejects.toThrow(
      'Too many Social actions'
    )
    vi.setSystemTime(new Date('2030-01-01T02:00:00.000Z'))
    await t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))
    expect(await t.run((ctx) => ctx.db.query('socialActionRateLimits').unique())).toMatchObject({
      count: 1,
      windowStartedAt: '2030-01-01T02:00:00.000Z'
    })
  })

  it('rolls every allowance back with a failed source mutation', async () => {
    const t = convexTest(schema, modules)
    const userId = crypto.randomUUID()
    await expect(
      t.run(async (ctx) => {
        await consumeSocialRateLimit(ctx, userId, 'APPLICATION')
        await ctx.db.insert('accountEntitlements', { userId, tier: 'FREE' })
        throw new Error('source rejected')
      })
    ).rejects.toThrow('source rejected')
    expect(await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('accountEntitlements').collect())).toEqual([])
  })

  it('removes only the deleted account counters through the real account-deletion trigger', async () => {
    const t = convexTest(schema, modules)
    const userId = crypto.randomUUID()
    const otherId = crypto.randomUUID()
    await t.run(async (ctx) => {
      await ctx.db.insert('userProfiles', {
        userId,
        authUserId: 'deleted-auth-user',
        bio: null,
        entitlementUsage: zeroAccountUsage,
        entitlementUsageReady: true
      })
      for (const action of ['APPLICATION', 'INVITE', 'REPORT', 'BLOCK'] as const)
        await consumeSocialRateLimit(ctx, userId, action)
      await consumeSocialRateLimit(ctx, otherId, 'BLOCK')
    })
    expect(await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())).toHaveLength(7)
    await t.mutation(internal.auth.onDelete, { model: 'user', doc: { _id: 'deleted-auth-user' } })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').take(4))).toEqual([
      expect.objectContaining({ state: { kind: 'success' } }),
      expect.objectContaining({ state: { kind: 'success' } }),
      expect.objectContaining({ state: { kind: 'success' } })
    ])
    const remaining = await t.run((ctx) => ctx.db.query('socialActionRateLimits').collect())
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.userId).toBe(otherId)
    expect(await t.run((ctx) => ctx.db.query('userProfiles').collect())).toEqual([])
  })
})

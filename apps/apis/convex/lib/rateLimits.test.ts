import { convexTest } from '../../tests/convexTest'
import { calculateRateLimit } from '@convex-dev/rate-limiter'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { zeroAccountUsage } from '@artificer-toolkit/schema/projections/accountUsage'
import { internal } from '../_generated/api'
import schema from '../schema'
import { readSocialRateLimits } from '../../tests/fixtures/socialRateLimits'
import {
  advanceAccountDeletionToProvider,
  scheduledSince
} from '../../tests/fixtures/accountDeletion'
import { consumeSocialRateLimit, consumeUserRateLimit, socialRateLimits } from './rateLimits'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')

function setup() {
  const t = convexTest(schema, modules)
  registerRateLimiter(t)
  return t
}

const unused = (action: Parameters<typeof socialRateLimits>[0]) =>
  socialRateLimits(action).map(({ config }) => ({ value: config.rate, ts: 0 }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2030-01-01T00:15:00.000Z'))
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('user token-bucket limits', () => {
  it.each([
    ['liveSessionTicket', 10, 2_000, 'Too many live table connection attempts'],
    ['campaignConversation', 30, 2_000, 'Chat is temporarily rate limited']
  ] as const)(
    'admits the %s burst of %i, rejects the next, and refills one token per %ims',
    async (name, burst, refillMs, message) => {
      const t = setup()
      const userId = crypto.randomUUID()
      for (let count = 0; count < burst; count++)
        await t.run((ctx) => consumeUserRateLimit(ctx, name, userId))
      await expect(t.run((ctx) => consumeUserRateLimit(ctx, name, userId))).rejects.toThrow(message)
      await t.run((ctx) => consumeUserRateLimit(ctx, name, crypto.randomUUID()))
      // One millisecond past the refill interval keeps the float arithmetic above one token.
      vi.setSystemTime(Date.now() + refillMs + 1)
      await t.run((ctx) => consumeUserRateLimit(ctx, name, userId))
      await expect(t.run((ctx) => consumeUserRateLimit(ctx, name, userId))).rejects.toThrow(message)
    }
  )
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
      const t = setup()
      const userId = crypto.randomUUID()
      for (let count = 0; count < limit; count++)
        await t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))
      const before = await readSocialRateLimits(t, userId, action)
      expect(before[0]).toEqual({ value: 0, ts: Date.parse('2030-01-01T00:00:00.000Z') })
      await expect(t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))).rejects.toThrow(
        'Too many Social actions'
      )
      expect(await readSocialRateLimits(t, userId, action)).toEqual(before)
      await t.run((ctx) => consumeSocialRateLimit(ctx, crypto.randomUUID(), action))
      await t.run((ctx) =>
        consumeSocialRateLimit(ctx, userId, action === 'BLOCK' ? 'INVITE' : 'BLOCK')
      )
    }
  )

  it.each([
    ['APPLICATION', 10, 3],
    ['REPORT', 5, 4]
  ] as const)(
    'keeps the %s daily allowance across hours and rolls back the hour when the day rejects',
    async (action, perHour, hours) => {
      const t = setup()
      const userId = crypto.randomUUID()
      for (let hour = 0; hour < hours; hour++) {
        vi.setSystemTime(new Date(Date.UTC(2030, 0, 1, hour, 15)))
        for (let count = 0; count < perHour; count++)
          await t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))
      }
      vi.setSystemTime(new Date(Date.UTC(2030, 0, 1, hours, 15)))
      const before = await readSocialRateLimits(t, userId, action)
      expect(before[1]?.value).toBe(0)
      await expect(t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))).rejects.toThrow(
        'Too many Social actions'
      )
      expect(await readSocialRateLimits(t, userId, action)).toEqual(before)
      vi.setSystemTime(new Date('2030-01-02T00:00:00.000Z'))
      await t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))
      expect(await readSocialRateLimits(t, userId, action)).toEqual(
        socialRateLimits(action).map(({ config }) => ({
          value: config.rate - 1,
          ts: Date.parse('2030-01-02T00:00:00.000Z')
        }))
      )
    }
  )

  it('uses UTC boundaries', async () => {
    const t = setup()
    const userId = crypto.randomUUID()
    vi.setSystemTime(new Date('2030-01-01T01:59:00.000Z'))
    for (let count = 0; count < 29; count++)
      await t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))
    // The rejected attempt below runs one millisecond later, on the window's last.
    vi.setSystemTime(new Date('2030-01-01T01:59:59.998Z'))
    await t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))
    await expect(t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))).rejects.toThrow(
      'Too many Social actions'
    )
    vi.setSystemTime(new Date('2030-01-01T02:00:00.000Z'))
    await t.run((ctx) => consumeSocialRateLimit(ctx, userId, 'BLOCK'))
    expect(await readSocialRateLimits(t, userId, 'BLOCK')).toEqual([
      { value: 29, ts: Date.parse('2030-01-01T02:00:00.000Z') }
    ])
  })

  // A transaction's clock cannot run behind the last commit under convex-test, so this calls the limiter directly.
  it.each(socialRateLimits('BLOCK'))(
    'cannot raise $name by moving the clock backwards',
    ({ config }) => {
      const state = { value: 1, ts: Date.parse('2030-01-01T01:00:00.000Z') }
      const current = calculateRateLimit(state, config, state.ts, 1)
      for (const elapsed of [1, config.period, config.period * 2])
        expect(calculateRateLimit(state, config, state.ts - elapsed, 1).value).toBeLessThanOrEqual(
          current.value
        )
    }
  )

  it('rolls every allowance back with a failed source mutation', async () => {
    const t = setup()
    const userId = crypto.randomUUID()
    await expect(
      t.run(async (ctx) => {
        await consumeSocialRateLimit(ctx, userId, 'APPLICATION')
        await ctx.db.insert('accountEntitlements', { userId, tier: 'FREE' })
        throw new Error('source rejected')
      })
    ).rejects.toThrow('source rejected')
    expect(await readSocialRateLimits(t, userId, 'APPLICATION')).toEqual(unused('APPLICATION'))
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('accountEntitlements')
          .withIndex('by_userId', (q) => q.eq('userId', userId))
          .take(1)
      )
    ).toEqual([])
  })
})

describe('account deletion', () => {
  it('erases only the deleted account counters through the real account-deletion trigger', async () => {
    const t = setup()
    const userId = crypto.randomUUID()
    const otherId = crypto.randomUUID()
    await t.run(async (ctx) => {
      await ctx.db.insert('userProfiles', {
        userId,
        authUserId: 'deleted-auth-user',
        bio: null,
        entitlementUsage: zeroAccountUsage,
        entitlementUsageReady: true,
        autoRollDice: true,
        gmRollVisibility: 'PUBLIC'
      })
      for (const action of ['APPLICATION', 'INVITE', 'REPORT', 'BLOCK'] as const)
        await consumeSocialRateLimit(ctx, userId, action)
      await consumeSocialRateLimit(ctx, otherId, 'BLOCK')
    })
    for (let count = 0; count < 10; count++)
      await t.run((ctx) => consumeUserRateLimit(ctx, 'liveSessionTicket', userId))
    const otherBefore = await readSocialRateLimits(t, otherId, 'BLOCK')
    const before = await advanceAccountDeletionToProvider(t, 'deleted-auth-user', userId)
    await t.mutation(internal.auth.onDelete, { model: 'user', doc: { _id: 'deleted-auth-user' } })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await scheduledSince(t, before)).toEqual([
      { name: 'accountDeletionFinish:purge', state: 'success' },
      { name: 'notifications/delivery:purgeRecipient', state: 'success' },
      { name: 'media/assets:purgeAccount', state: 'success' },
      { name: 'social/accountCleanup:run', state: 'success' }
    ])
    for (const action of ['APPLICATION', 'INVITE', 'REPORT', 'BLOCK'] as const)
      expect(await readSocialRateLimits(t, userId, action)).toEqual(unused(action))
    expect(await readSocialRateLimits(t, otherId, 'BLOCK')).toEqual(otherBefore)
    await t.run((ctx) => consumeUserRateLimit(ctx, 'liveSessionTicket', userId))
    expect(await t.run((ctx) => ctx.db.query('userProfiles').take(1))).toEqual([])
  })
})

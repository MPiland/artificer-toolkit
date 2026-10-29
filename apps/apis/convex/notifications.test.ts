import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { createFunctionHandle } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { describe, expect, it, vi } from 'vitest'
import type { NotificationFeedItemDto } from '@artificer-toolkit/schema/api/notifications'
import { api, components, internal } from './_generated/api'
import schema from './schema'
import {
  advanceAccountDeletionToProvider,
  drainScheduledWork,
  scheduledSince
} from '../tests/fixtures/accountDeletion'
import authSchema from './betterAuth/schema'

const modules = import.meta.glob('./**/*.*s')

async function fixture() {
  const t = convexTest(schema, modules)
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const actors = []
  for (let index = 0; index < 2; index++) {
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Notification reader',
            email: `notification-${index}@example.invalid`,
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
            expiresAt: Date.now() + 60000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const caller = t.withIdentity({ subject: user._id, sessionId: session._id })
    actors.push({ caller, user, ...(await caller.query(api.account.identity, {})) })
  }
  return { t, first: actors[0], second: actors[1] }
}

function item(index = 0): NotificationFeedItemDto {
  const sourcePublicId = crypto.randomUUID()
  const occurredAt = new Date(Date.UTC(2026, 8, 4, 0, 0, index)).toISOString()
  return {
    id: crypto.randomUUID(),
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
  }
}

describe('native notification feed and preferences', () => {
  it('denies anonymous access and foreign reads/writes; emits only the existing safe DTO', async () => {
    const { t, first, second } = await fixture()
    const own = item()
    const foreign = item()
    await t.run(async (ctx) => {
      await ctx.db.insert('notificationFeedItems', { ...own, userId: first.userId })
      await ctx.db.insert('notificationFeedItems', { ...foreign, userId: second.userId })
    })
    await expect(t.query(api.notifications.feed, {})).rejects.toThrow('Unauthenticated')
    await expect(t.query(api.notifications.preferences, {})).rejects.toThrow('Unauthenticated')
    await expect(t.mutation(api.notifications.markAllSeen, {})).rejects.toThrow('Unauthenticated')
    await expect(t.mutation(api.notifications.markRead, { id: own.id })).rejects.toThrow(
      'Unauthenticated'
    )
    await expect(
      t.mutation(api.notifications.updatePreferences, {
        category: 'SOCIAL',
        inApp: false,
        email: false
      })
    ).rejects.toThrow('Unauthenticated')
    expect(await first.caller.query(api.notifications.feed, {})).toEqual({
      items: [own],
      unseenCount: 1
    })
    await expect(
      // @ts-expect-error Runtime boundary must also reject a forged recipient argument.
      first.caller.query(api.notifications.feed, { ...{ userId: second.userId } })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(api.notifications.markRead, { id: foreign.id })
    ).rejects.toThrow('unavailable')
    await expect(
      first.caller.mutation(api.notifications.markRead, { id: 'not-a-uuid' })
    ).rejects.toThrow()
    expect(await second.caller.query(api.notifications.feed, {})).toEqual({
      items: [foreign],
      unseenCount: 1
    })
  })

  it('marks the bounded feed seen atomically and preserves first seen/read timestamps on replay', async () => {
    const { t, first, second } = await fixture()
    const items = Array.from({ length: 25 }, (_, index) => item(index))
    // The shared timestamp contract permits different fractional precision.
    items[0].occurredAt = '2026-09-04T00:00:00Z'
    items[1].occurredAt = '2026-09-04T00:00:00.500Z'
    const foreign = item()
    await t.run(async (ctx) => {
      for (const row of items)
        await ctx.db.insert('notificationFeedItems', { ...row, userId: first.userId })
      await ctx.db.insert('notificationFeedItems', { ...foreign, userId: second.userId })
    })
    expect(
      (await first.caller.query(api.notifications.feed, {})).items.map((row) => row.id)
    ).toEqual(items.toReversed().map((row) => row.id))
    await first.caller.mutation(api.notifications.markRead, { id: items[0].id })
    const read = (await first.caller.query(api.notifications.feed, {})).items.at(-1)
    expect(read?.seenAt).toEqual(read?.readAt)
    expect(read?.readAt).not.toBeNull()
    await first.caller.mutation(api.notifications.markAllSeen, {})
    const seen = await first.caller.query(api.notifications.feed, {})
    expect(seen.unseenCount).toBe(0)
    expect(seen.items.at(-1)).toEqual(read)
    await first.caller.mutation(api.notifications.markAllSeen, {})
    await first.caller.mutation(api.notifications.markRead, { id: items[0].id })
    expect(await first.caller.query(api.notifications.feed, {})).toEqual(seen)
    expect((await second.caller.query(api.notifications.feed, {})).unseenCount).toBe(1)
  })

  it('keeps category preferences independent, owner scoped, and available on old profiles', async () => {
    const { first, second } = await fixture()
    const defaults = {
      social: { inApp: true, email: true },
      campaign: { inApp: true, email: true }
    }
    expect(await first.caller.query(api.notifications.preferences, {})).toEqual(defaults)
    await first.caller.mutation(api.notifications.updatePreferences, {
      category: 'SOCIAL',
      inApp: false,
      email: true
    })
    const next = await first.caller.mutation(api.notifications.updatePreferences, {
      category: 'CAMPAIGN',
      inApp: true,
      email: false
    })
    expect(next).toEqual({
      social: { inApp: false, email: true },
      campaign: { inApp: true, email: false }
    })
    expect(await first.caller.query(api.notifications.preferences, {})).toEqual(next)
    expect(await second.caller.query(api.notifications.preferences, {})).toEqual(defaults)
    await expect(
      first.caller.mutation(api.notifications.updatePreferences, {
        category: 'SOCIAL',
        inApp: true,
        email: true,
        ...{ userId: second.userId }
      })
    ).rejects.toThrow()
  })

  it('rejects retention drift before a partial mark-seen mutation', async () => {
    const { t, first } = await fixture()
    const firstId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('notificationFeedItems', { ...item(), userId: first.userId })
      for (let index = 1; index < 26; index++)
        await ctx.db.insert('notificationFeedItems', { ...item(index), userId: first.userId })
      return id
    })
    await expect(first.caller.query(api.notifications.feed, {})).rejects.toThrow('retention')
    await expect(first.caller.mutation(api.notifications.markAllSeen, {})).rejects.toThrow(
      'retention'
    )
    expect((await t.run((ctx) => ctx.db.get(firstId)))?.seenAt).toBeNull()
  })

  it('removes only the deleted account notification rows and preference-bearing profile', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { t, first, second } = await fixture()
    const ids = await t.run(async (ctx) => [
      await ctx.db.insert('notificationFeedItems', { ...item(), userId: first.userId }),
      await ctx.db.insert('notificationFeedItems', { ...item(), userId: second.userId })
    ])
    const before = await advanceAccountDeletionToProvider(t, first.user._id, first.userId)
    await t.mutation(internal.auth.onDelete, { model: 'user', doc: first.user })
    await drainScheduledWork(t)
    expect(await scheduledSince(t, before)).toEqual([
      { name: 'accountDeletionFinish:purge', state: 'success' },
      { name: 'notifications/delivery:purgeRecipient', state: 'success' },
      { name: 'media/assets:purgeAccount', state: 'success' },
      { name: 'social/accountCleanup:run', state: 'success' }
    ])
    expect(await t.run((ctx) => ctx.db.get(ids[0]))).toBeNull()
    expect(await t.run((ctx) => ctx.db.get(ids[1]))).not.toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', first.userId))
          .unique()
      )
    ).toBeNull()
  })
})

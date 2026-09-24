import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  notificationFeedDtoSchema,
  notificationFeedItemIdInputSchema,
  notificationPreferencesDtoSchema,
  updateNotificationPreferencesInputSchema
} from '@artificer-toolkit/schema/api/notifications'
import { query } from './_generated/server'
import { mutation } from './lib/mutations'
import { getAuthenticatedProfile, requireIdentity } from './lib/identity'
import { retainedFeed } from './notifications/feed'

const defaultPreferences = {
  social: { inApp: true, email: true },
  campaign: { inApp: true, email: true }
}
const ok = v.object({ ok: v.literal(true) })

export const feed = query({
  args: {},
  returns: zodToConvex(notificationFeedDtoSchema),
  handler: async (ctx) => {
    const { userId } = await requireIdentity(ctx)
    const rows = await retainedFeed(ctx, userId)
    const items = rows.map(({ _id, _creationTime, userId: _userId, ...item }) => item)
    return notificationFeedDtoSchema.parse({
      items,
      unseenCount: items.filter((item) => item.seenAt === null).length
    })
  }
})

export const markAllSeen = mutation({
  args: {},
  returns: ok,
  handler: async (ctx) => {
    const { userId } = await requireIdentity(ctx)
    const items = await retainedFeed(ctx, userId)
    const seenAt = new Date().toISOString()
    for (const item of items) {
      if (item.seenAt === null) await ctx.db.patch(item._id, { seenAt })
    }
    return { ok: true } as const
  }
})

export const markRead = mutation({
  args: zodToConvexFields(notificationFeedItemIdInputSchema.shape),
  returns: ok,
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { id } = notificationFeedItemIdInputSchema.parse(args)
    const item = await ctx.db
      .query('notificationFeedItems')
      .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', id))
      .unique()
    if (!item) throw new Error('Notification is unavailable.')
    const now = new Date().toISOString()
    await ctx.db.patch(item._id, { readAt: item.readAt ?? now, seenAt: item.seenAt ?? now })
    return { ok: true } as const
  }
})

export const preferences = query({
  args: {},
  returns: zodToConvex(notificationPreferencesDtoSchema),
  handler: async (ctx) => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    return notificationPreferencesDtoSchema.parse(
      authenticated.profile.notificationPreferences ?? defaultPreferences
    )
  }
})

export const updatePreferences = mutation({
  args: zodToConvexFields(updateNotificationPreferencesInputSchema.shape),
  returns: zodToConvex(notificationPreferencesDtoSchema),
  handler: async (ctx, args) => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    const { category, inApp, email } = updateNotificationPreferencesInputSchema.parse(args)
    const next = notificationPreferencesDtoSchema.parse({
      ...(authenticated.profile.notificationPreferences ?? defaultPreferences),
      [category === 'SOCIAL' ? 'social' : 'campaign']: { inApp, email }
    })
    await ctx.db.patch(authenticated.profile._id, { notificationPreferences: next })
    return next
  }
})

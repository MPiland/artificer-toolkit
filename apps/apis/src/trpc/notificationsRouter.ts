import {
  getNotificationFeed,
  getNotificationPreferences,
  markAllNotificationsSeen,
  markNotificationRead,
  updateNotificationPreferences
} from '@artificer-toolkit/functions'
import {
  notificationFeedDtoSchema,
  notificationFeedItemIdInputSchema,
  notificationPreferencesDtoSchema,
  updateNotificationPreferencesInputSchema
} from '@artificer-toolkit/schema/api/notifications'
import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const notificationsRouter = createTRPCRouter({
  feed: authenticatedProcedure
    .output(notificationFeedDtoSchema)
    .query(({ ctx }) => withExplicitAuthorityDb(ctx, getNotificationFeed)),
  markAllSeen: authenticatedProcedure.output(okResponseSchema).mutation(async ({ ctx }) => {
    await withExplicitAuthorityDb(ctx, markAllNotificationsSeen)
    return { ok: true }
  }),
  markRead: authenticatedProcedure
    .input(notificationFeedItemIdInputSchema)
    .output(okResponseSchema)
    .mutation(async ({ ctx, input }) => {
      await withExplicitAuthorityDb(ctx, (db, userId) => markNotificationRead(db, userId, input.id))
      return { ok: true }
    }),
  preferences: authenticatedProcedure
    .output(notificationPreferencesDtoSchema)
    .query(({ ctx }) => withExplicitAuthorityDb(ctx, getNotificationPreferences)),
  updatePreferences: authenticatedProcedure
    .input(updateNotificationPreferencesInputSchema)
    .output(notificationPreferencesDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => updateNotificationPreferences(db, userId, input))
    )
})

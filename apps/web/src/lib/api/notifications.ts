import * as notificationContracts from '@artificer-toolkit/schema/api/notifications'
import { okResponseSchema, request, type TrpcClient } from './transport'

export function buildNotificationsApi(client: TrpcClient) {
  return {
    feed: () =>
      request('notifications.feed', notificationContracts.notificationFeedDtoSchema, () =>
        client.notifications.feed.query()
      ),
    markAllSeen: () =>
      request('notifications.markAllSeen', okResponseSchema, () =>
        client.notifications.markAllSeen.mutate()
      ),
    markRead: (input: notificationContracts.NotificationFeedItemIdInput) =>
      request('notifications.markRead', okResponseSchema, () =>
        client.notifications.markRead.mutate(input)
      ),
    preferences: () =>
      request(
        'notifications.preferences',
        notificationContracts.notificationPreferencesDtoSchema,
        () => client.notifications.preferences.query()
      ),
    updatePreferences: (input: notificationContracts.UpdateNotificationPreferencesInput) =>
      request(
        'notifications.updatePreferences',
        notificationContracts.notificationPreferencesDtoSchema,
        () => client.notifications.updatePreferences.mutate(input)
      )
  }
}

import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'

export const notificationFeedQuery = convexQuery(api.notifications.feed, {})
export const notificationPreferencesQuery = convexQuery(api.notifications.preferences, {})

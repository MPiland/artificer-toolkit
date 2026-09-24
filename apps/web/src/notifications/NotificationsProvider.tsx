import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConvexAuth } from 'convex/react'
import { notificationFeedQuery } from '#app/data/notifications'
import {
  NotificationAvailabilityContext,
  NotificationUnseenCountContext
} from './notificationContext'

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  const feed = useQuery({
    ...notificationFeedQuery,
    enabled: isAuthenticated
  })

  return (
    <NotificationAvailabilityContext
      value={!isAuthenticated || feed.isPending ? 'loading' : feed.isError ? 'error' : 'ready'}
    >
      <NotificationUnseenCountContext value={isAuthenticated ? (feed.data?.unseenCount ?? 0) : 0}>
        {children}
      </NotificationUnseenCountContext>
    </NotificationAvailabilityContext>
  )
}

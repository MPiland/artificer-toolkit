import type { ReactNode } from 'react'
import { NovuProvider, useCounts } from '@novu/react'
import { useQuery } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  NotificationAvailabilityContext,
  NotificationUnseenCountContext
} from './notificationContext'

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const session = useQuery({
    queryKey: queryKeys.notifications.session(),
    queryFn: () => api.notifications.session()
  })

  if (!session.data) {
    return (
      <NotificationAvailabilityContext value={session.isError ? 'error' : 'loading'}>
        {children}
      </NotificationAvailabilityContext>
    )
  }

  return (
    <NovuProvider
      applicationIdentifier={session.data.applicationIdentifier}
      realtime
      subscriber={session.data.recipientId}
      subscriberHash={session.data.subscriberHash}
    >
      <ConnectedNotificationContext>{children}</ConnectedNotificationContext>
    </NovuProvider>
  )
}

function ConnectedNotificationContext({ children }: { children: ReactNode }) {
  const { counts } = useCounts({ filters: [{ seen: false }] })

  return (
    <NotificationAvailabilityContext value='ready'>
      <NotificationUnseenCountContext value={counts?.[0]?.count ?? 0}>
        {children}
      </NotificationUnseenCountContext>
    </NotificationAvailabilityContext>
  )
}

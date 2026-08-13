import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { getSupabaseBrowserClient } from '#supabase/client'
import {
  NotificationAvailabilityContext,
  NotificationUnseenCountContext
} from './notificationContext'

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const feed = useQuery({
    queryKey: queryKeys.notifications.feed(),
    queryFn: () => api.notifications.feed(),
    refetchInterval: 60_000
  })

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let channel: ReturnType<typeof supabase.channel> | undefined
    let disposed = false

    void Promise.all([supabase.auth.getUser(), supabase.auth.getSession()])
      .then(
        ([
          {
            data: { user }
          },
          {
            data: { session }
          }
        ]) => {
          if (!user || disposed) return
          if (session?.access_token) void supabase.realtime.setAuth(session.access_token)

          channel = supabase
            .channel(`notifications:${user.id}`, { config: { private: true } })
            .on('broadcast', { event: '*' }, () => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() })
            })
            .subscribe()
        }
      )
      .catch(() => undefined)

    return () => {
      disposed = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return (
    <NotificationAvailabilityContext value={feed.isError ? 'error' : 'ready'}>
      <NotificationUnseenCountContext value={feed.data?.unseenCount ?? 0}>
        {children}
      </NotificationUnseenCountContext>
    </NotificationAvailabilityContext>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { NotificationFeedView } from './NotificationFeedView'
import { toNotificationViewModel, type NotificationDestination } from './notificationModel'
import * as styles from './notifications.css'

export function NotificationFeed({
  contained,
  onNavigate
}: {
  contained?: boolean
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const feed = useQuery({
    queryKey: queryKeys.notifications.feed(),
    queryFn: () => api.notifications.feed()
  })
  const markAllSeen = useMutation({ mutationFn: () => api.notifications.markAllSeen() })
  const markRead = useMutation({ mutationFn: (id: string) => api.notifications.markRead({ id }) })
  const hasMarkedFeedSeen = useRef(false)
  const [actionError, setActionError] = useState('')
  const viewItems = useMemo(
    () => feed.data?.items.map(toNotificationViewModel) ?? [],
    [feed.data?.items]
  )

  useEffect(() => {
    if (hasMarkedFeedSeen.current || !feed.data) return
    hasMarkedFeedSeen.current = true

    markAllSeen.mutate(undefined, {
      onError: () => setActionError('Notifications could not be marked as seen.')
    })
  }, [feed.data, markAllSeen])

  function open(id: string, destination: NotificationDestination) {
    setActionError('')
    markRead.mutate(id, {
      onError: () => setActionError('That notification could not be updated.')
    })
    onNavigate?.()

    switch (destination.kind) {
      case 'HOST_APPLICATIONS':
        void navigate({
          to: '/social/hosting/$listingPublicId/edit',
          params: { listingPublicId: destination.listingPublicId },
          search: { section: 'applications' }
        })
        return
      case 'MY_APPLICATION':
        void navigate({
          to: '/social',
          search: {
            view: 'applications',
            applicationPublicId: destination.applicationPublicId
          }
        })
        return
      case 'MY_INVITATION':
        void navigate({
          to: '/social',
          search: {
            view: 'invitations',
            invitePublicId: destination.invitePublicId
          }
        })
        return
      case 'HOST_INVITATION':
        void navigate({
          to: '/social/hosting/$listingPublicId/edit',
          params: { listingPublicId: destination.listingPublicId },
          search: {
            section: 'invitations',
            invitePublicId: destination.invitePublicId
          }
        })
        return
      case 'CAMPAIGN_ANNOUNCEMENT': {
        const query = new URLSearchParams({
          tab: 'announcements',
          announcementPublicId: destination.announcementPublicId
        })
        window.location.assign(
          `/campaigns/${encodeURIComponent(destination.campaignPublicId)}?${query}`
        )
      }
    }
  }

  return (
    <>
      <NotificationFeedView
        contained={contained}
        isError={feed.isError}
        isLoading={feed.isLoading && viewItems.length === 0}
        items={viewItems}
        onExplore={() => {
          onNavigate?.()
          void navigate({ to: '/social', search: { view: 'discover' } })
        }}
        onOpen={open}
        onRetry={() => void feed.refetch()}
      />
      <span className={styles.visuallyHidden} aria-live='polite'>
        {actionError}
      </span>
    </>
  )
}

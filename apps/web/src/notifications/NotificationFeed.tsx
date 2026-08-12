import { useEffect, useMemo, useRef, useState } from 'react'
import { useNotifications, useNovu } from '@novu/react'
import { useNavigate } from '@tanstack/react-router'
import { NotificationFeedView } from './NotificationFeedView'
import {
  notificationHistoryLimit,
  toNotificationViewModel,
  type NotificationDestination
} from './notificationModel'
import * as styles from './notifications.css'

export function NotificationFeed({
  contained,
  onNavigate
}: {
  contained?: boolean
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const novu = useNovu()
  const { error, isLoading, notifications, refetch, seenAll } = useNotifications({
    limit: notificationHistoryLimit
  })
  const hasMarkedFeedSeen = useRef(false)
  const [actionError, setActionError] = useState('')
  const viewItems = useMemo(
    () => notifications?.slice(0, notificationHistoryLimit).map(toNotificationViewModel) ?? [],
    [notifications]
  )

  useEffect(() => {
    if (hasMarkedFeedSeen.current) return
    hasMarkedFeedSeen.current = true

    void seenAll().then(({ error: seenError }) => {
      if (seenError) setActionError('Notifications could not be marked as seen.')
    })
  }, [seenAll])

  function open(id: string, destination: NotificationDestination) {
    setActionError('')
    void novu.notifications.read({ notificationId: id }).then(({ error: readError }) => {
      if (readError) setActionError('That notification could not be updated.')
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
          search: { view: 'invitations', invitePublicId: destination.invitePublicId }
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
    }
  }

  return (
    <>
      <NotificationFeedView
        contained={contained}
        isError={Boolean(error)}
        isLoading={isLoading && viewItems.length === 0}
        items={viewItems}
        onExplore={() => {
          onNavigate?.()
          void navigate({ to: '/social', search: { view: 'discover' } })
        }}
        onOpen={open}
        onRetry={() => void refetch()}
      />
      <span className={styles.visuallyHidden} aria-live='polite'>
        {actionError}
      </span>
    </>
  )
}

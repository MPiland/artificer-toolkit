import { Alert, Button, Loader, Text, Title } from '@mantine/core'
import clsx from 'clsx'
import { formatNotificationTimestamp, type NotificationFeedViewProps } from './notificationModel'
import * as styles from './notifications.css'

export function NotificationFeedView({
  contained,
  isError,
  isLoading,
  items,
  onExplore,
  onOpen,
  onRetry
}: NotificationFeedViewProps) {
  if (isLoading) {
    return (
      <div className={styles.centeredState}>
        <Loader aria-label='Loading notifications' size='sm' />
      </div>
    )
  }

  if (isError) {
    return (
      <Alert color='red' title="Couldn't load notifications">
        <Text size='sm'>Try again.</Text>
        {onRetry ? (
          <Button className={styles.rowAction} mt='sm' variant='light' onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </Alert>
    )
  }

  return (
    <section
      className={clsx(styles.feed, contained && styles.feedContained)}
      aria-label={contained ? 'Notification feed' : undefined}
      aria-labelledby={contained ? undefined : 'notification-feed-title'}
    >
      {!contained ? (
        <header className={styles.feedHeader}>
          <Title id='notification-feed-title' order={1} size='h3'>
            Notifications
          </Title>
        </header>
      ) : null}

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <Title order={2} size='h4'>
            No notifications yet
          </Title>
          <Text c='dimmed' size='sm'>
            Social Hub updates will appear here.
          </Text>
          {onExplore ? (
            <Button className={styles.rowAction} variant='light' onClick={onExplore}>
              Explore Social Hub
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={clsx(styles.feedList, contained && styles.feedListContained)}>
          {items.map((item) => {
            const isUnread = !item.isRead && Boolean(item.destination)
            const content = (
              <>
                <span
                  aria-hidden='true'
                  className={styles.unreadDot}
                  data-visible={isUnread || undefined}
                />
                <span className={styles.rowContent}>
                  {isUnread ? <span className={styles.visuallyHidden}>Unread. </span> : null}
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.rowBody}>{item.body}</span>
                  <time className={styles.rowTime} dateTime={item.insertedAt}>
                    {formatNotificationTimestamp(item.insertedAt)}
                  </time>
                </span>
              </>
            )

            return (
              <article className={styles.feedRow} data-unread={isUnread || undefined} key={item.id}>
                {item.destination && onOpen ? (
                  <button
                    className={styles.feedRowMain}
                    type='button'
                    onClick={() => {
                      if (item.destination) onOpen(item.id, item.destination)
                    }}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={styles.feedRowMain}>{content}</div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

import { Alert, Loader } from '@mantine/core'
import { NotificationFeed } from './NotificationFeed'
import { useNotificationAvailability } from './notificationContext'
import * as styles from './notifications.css'

export function NotificationsPage() {
  const availability = useNotificationAvailability()

  if (availability === 'loading') {
    return (
      <div className={styles.centeredState}>
        <Loader aria-label='Loading notifications' size='sm' />
      </div>
    )
  }
  if (availability === 'error') {
    return (
      <Alert color='red' title="Couldn't load notifications">
        Reload the page to try again.
      </Alert>
    )
  }

  return (
    <div className={styles.page}>
      <NotificationFeed />
    </div>
  )
}

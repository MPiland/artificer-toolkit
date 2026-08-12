import { ActionIcon, Drawer, Indicator, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { NotificationFeed } from './NotificationFeed'
import { useNotificationUnseenCount } from './notificationContext'
import { notificationBadge, notificationBellLabel } from './notificationModel'
import * as styles from './notifications.css'

export function NotificationDesktopAction() {
  const [opened, { close, open }] = useDisclosure(false)
  const newCount = useNotificationUnseenCount()

  return (
    <>
      <Tooltip disabled={opened} label='Notifications'>
        <Indicator disabled={newCount === 0} inline label={notificationBadge(newCount)} size={16}>
          <ActionIcon
            aria-label={notificationBellLabel(newCount)}
            className={styles.bellButton}
            variant='subtle'
            onClick={open}
          >
            <Bell aria-hidden='true' size={18} />
          </ActionIcon>
        </Indicator>
      </Tooltip>
      <Drawer
        classNames={{
          body: styles.drawerBody,
          content: styles.drawerContent,
          header: styles.drawerHeader
        }}
        closeButtonProps={{ 'aria-label': 'Close notifications' }}
        opened={opened}
        onClose={close}
        position='right'
        size='26rem'
        title='Notifications'
      >
        <NotificationFeed contained onNavigate={close} />
      </Drawer>
    </>
  )
}

export function NotificationMobileAction() {
  const newCount = useNotificationUnseenCount()

  return (
    <Tooltip label='Notifications'>
      <Indicator disabled={newCount === 0} inline label={notificationBadge(newCount)} size={16}>
        <ActionIcon
          aria-label={notificationBellLabel(newCount)}
          className={styles.bellButton}
          component={Link}
          to='/notifications'
          variant='subtle'
        >
          <Bell aria-hidden='true' size={18} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  )
}

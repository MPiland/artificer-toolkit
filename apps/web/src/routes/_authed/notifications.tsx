import { createFileRoute } from '@tanstack/react-router'
import { NotificationsPage } from '#app/notifications/NotificationsPage'

export const Route = createFileRoute('/_authed/notifications')({
  component: NotificationsPage
})

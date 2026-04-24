import { notifications } from '@mantine/notifications'

export function showError(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'red'
  })
}

export function showSuccess(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'green'
  })
}

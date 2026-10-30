import { Menu } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { createClientOnlyFn } from '@tanstack/react-start'
import { MessageSquareText } from 'lucide-react'
import { isSentryConfigured } from '#app/observability/sentry.config'

// Client-only so the Start compiler strips this import from the Worker SSR bundle, where the
// package's Worker export pulls in @sentry/node (ADR 0037).
const openFeedbackForm = createClientOnlyFn(async () => {
  try {
    const Sentry = await import('@sentry/tanstackstart-react')
    const feedback = Sentry.getFeedback()

    if (!feedback) {
      throw new Error('Sentry feedback is not initialized.')
    }

    let dialog: Awaited<ReturnType<typeof feedback.createForm>> | undefined
    const removeDialog = () => dialog?.removeFromDom()

    dialog = await feedback.createForm({
      tags: {
        viewport_width: String(window.innerWidth),
        viewport_height: String(window.innerHeight),
        device_pixel_ratio: String(window.devicePixelRatio)
      },
      onFormClose: removeDialog,
      onFormSubmitted: removeDialog
    })
    dialog.appendToDom()
    dialog.open()
  } catch {
    notifications.show({
      color: 'red',
      message: 'Please try again in a moment.',
      title: 'Feedback unavailable'
    })
  }
})

export function SentryFeedbackMenuItem() {
  if (!isSentryConfigured()) {
    return null
  }

  return (
    <Menu.Item
      leftSection={<MessageSquareText size={16} aria-hidden='true' />}
      onClick={() => void openFeedbackForm()}
    >
      Send feedback
    </Menu.Item>
  )
}

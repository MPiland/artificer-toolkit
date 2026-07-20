import { Menu } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MessageSquareText } from 'lucide-react'
import { isSentryConfigured } from '#app/observability/sentry.config'

export function SentryFeedbackMenuItem() {
  if (!isSentryConfigured()) {
    return null
  }

  const openFeedbackForm = async () => {
    try {
      const Sentry = await import('@sentry/tanstackstart-react')
      const feedback = Sentry.getFeedback()

      if (!feedback) {
        throw new Error('Sentry feedback is not initialized.')
      }

      let dialog: Awaited<ReturnType<typeof feedback.createForm>> | undefined
      const removeDialog = () => dialog?.removeFromDom()

      dialog = await feedback.createForm({
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

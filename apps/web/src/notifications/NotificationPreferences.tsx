import { Button, Loader, Stack, Text } from '@mantine/core'
import { useNovu, usePreferences } from '@novu/react'
import { useState } from 'react'
import { useNotificationAvailability } from './notificationContext'
import { NotificationPreferencesView } from './NotificationPreferencesView'
import {
  readNotificationChannels,
  socialWorkflowIdentifiers,
  type ChannelPreferences
} from './notificationPreferencesModel'
import * as styles from './notifications.css'

export function NotificationPreferences() {
  const availability = useNotificationAvailability()

  if (availability === 'loading') {
    return <Loader aria-label='Loading notification preferences' size='sm' />
  }
  if (availability === 'error') {
    return <Text c='red'>Could not load notification preferences.</Text>
  }

  return <ConnectedNotificationPreferences />
}

function ConnectedNotificationPreferences() {
  const novu = useNovu()
  const [loadFailed, setLoadFailed] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const {
    error: loadError,
    isLoading,
    preferences,
    refetch
  } = usePreferences({
    filter: { tags: ['social'] },
    onError: () => setLoadFailed(true),
    onSuccess: () => setLoadFailed(false)
  })
  const [optimistic, setOptimistic] = useState<ChannelPreferences>()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const current = optimistic ?? readNotificationChannels(preferences)

  async function update(next: ChannelPreferences) {
    const previous = current
    setError('')
    setOptimistic(next)
    setIsSaving(true)
    try {
      const { error: updateError } = await novu.preferences.bulkUpdate(
        socialWorkflowIdentifiers.map((workflowId) => ({
          workflowId,
          channels: { email: next.email, in_app: next.inApp }
        }))
      )
      if (!updateError) return
      setOptimistic(previous)
      setError('Notification preferences could not be saved.')
    } catch {
      setOptimistic(previous)
      setError('Notification preferences could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  async function retryLoad() {
    setIsRetrying(true)
    try {
      await refetch()
    } finally {
      setIsRetrying(false)
    }
  }

  if (isLoading && !preferences) {
    return <Loader aria-label='Loading notification preferences' size='sm' />
  }
  if (loadFailed || (loadError && !preferences)) {
    return (
      <Stack align='flex-start' gap='xs'>
        <Text c='red' role='alert'>
          Could not load notification preferences.
        </Text>
        <Button
          loading={isRetrying}
          size='compact-sm'
          variant='subtle'
          onClick={() => void retryLoad()}
        >
          Retry
        </Button>
      </Stack>
    )
  }

  return (
    <>
      <NotificationPreferencesView
        channels={current}
        error={error}
        isSaving={isSaving}
        onChange={(next) => void update(next)}
      />
      <span aria-live='polite' className={styles.visuallyHidden}>
        {error}
      </span>
    </>
  )
}

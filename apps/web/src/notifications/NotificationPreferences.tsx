import { Button, Loader, Stack, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { useNotificationAvailability } from './notificationContext'
import { NotificationPreferencesView } from './NotificationPreferencesView'
import { readNotificationChannels, type ChannelPreferences } from './notificationPreferencesModel'
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
  const queryClient = useQueryClient()
  const preferencesKey = queryKeys.notifications.preferences()
  const preferences = useQuery({
    queryKey: preferencesKey,
    queryFn: () => api.notifications.preferences()
  })
  const updatePreferences = useMutation({
    mutationFn: (input: { category: 'SOCIAL' | 'CAMPAIGN'; channels: ChannelPreferences }) =>
      api.notifications.updatePreferences({ category: input.category, ...input.channels })
  })
  const [isRetrying, setIsRetrying] = useState(false)
  const [optimistic, setOptimistic] = useState<
    Partial<Record<'SOCIAL' | 'CAMPAIGN', ChannelPreferences>>
  >({})
  const [errors, setErrors] = useState<Partial<Record<'SOCIAL' | 'CAMPAIGN', string>>>({})

  async function update(category: 'SOCIAL' | 'CAMPAIGN', next: ChannelPreferences) {
    setErrors((current) => ({ ...current, [category]: undefined }))
    setOptimistic((current) => ({ ...current, [category]: next }))
    try {
      const saved = await updatePreferences.mutateAsync({ category, channels: next })
      queryClient.setQueryData(preferencesKey, saved)
    } catch {
      setErrors((current) => ({
        ...current,
        [category]: 'Notification preferences could not be saved.'
      }))
    } finally {
      setOptimistic((current) => ({ ...current, [category]: undefined }))
    }
  }

  async function retryLoad() {
    setIsRetrying(true)
    try {
      await preferences.refetch()
    } finally {
      setIsRetrying(false)
    }
  }

  if (preferences.isLoading && !preferences.data) {
    return <Loader aria-label='Loading notification preferences' size='sm' />
  }
  if (preferences.isError && !preferences.data) {
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
    <Stack gap='lg'>
      <NotificationPreferencesView
        channels={optimistic.SOCIAL ?? readNotificationChannels(preferences.data, 'SOCIAL')}
        error={errors.SOCIAL}
        isSaving={updatePreferences.isPending}
        label='Social Hub'
        onChange={(next) => void update('SOCIAL', next)}
      />
      <NotificationPreferencesView
        channels={optimistic.CAMPAIGN ?? readNotificationChannels(preferences.data, 'CAMPAIGN')}
        error={errors.CAMPAIGN}
        isSaving={updatePreferences.isPending}
        label='Campaign'
        onChange={(next) => void update('CAMPAIGN', next)}
      />
      <span aria-live='polite' className={styles.visuallyHidden}>
        {errors.SOCIAL ?? errors.CAMPAIGN}
      </span>
    </Stack>
  )
}

import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema'
import { AuthoredFormPageFrame } from '#components/Form/AuthoredFormPageFrame'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { getBackground } from '#app/data/backgrounds/queries'
import { getSystemList } from '#app/data/systems/queries'
import { BackgroundForm } from './BackgroundForm'
import { createEmptyBackground } from './backgroundAuthoring.utils'
import * as styles from './backgroundAuthoring.css'

export function BackgroundCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const systemId = systems[0]?.id
  const mutation = useMutation({
    mutationFn: (background: BackgroundAuthoredDto) => api.content.backgrounds.upsert(background),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      notifications.show({ color: 'green', message: 'Background created.' })
      if (response?.item.id) {
        await navigate({ to: '/backgrounds/$backgroundId', params: { backgroundId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that background yet.' })
  })

  if (!systemId) {
    return (
      <AuthoredFormPageFrame contentClassName={styles.contentWide}>
        <Stack>
          <Alert color='yellow'>A system is required before creating backgrounds.</Alert>
          <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  return (
    <AuthoredFormPageFrame contentClassName={styles.contentWide}>
      <BackgroundForm
        mode='create'
        systemId={systemId}
        userId={userId}
        initialBackground={createEmptyBackground({ systemId, userId })}
        onSubmit={async (background) => mutation.mutateAsync(background).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

export function BackgroundDetailPage({
  backgroundId,
  mode,
  userId
}: {
  backgroundId: string
  mode: 'view' | 'edit'
  userId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: response } = useSuspenseQuery(getBackground(backgroundId))
  const saveMutation = useMutation({
    mutationFn: (background: BackgroundAuthoredDto) => api.content.backgrounds.upsert(background),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.detail(saved.item.id) })
        await navigate({ to: '/backgrounds/$backgroundId', params: { backgroundId: saved.item.id } })
      }
      notifications.show({ color: 'green', message: 'Background saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that background yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.backgrounds.duplicate(backgroundId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      notifications.show({ color: 'green', message: 'Background duplicated as an owned draft.' })
      if (copied?.item.id) {
        await navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId: copied.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that background yet.' })
  })

  if (!response) {
    return (
      <AuthoredFormPageFrame contentClassName={styles.contentWide}>
        <Stack>
          <Alert color='yellow'>That background could not be found.</Alert>
          <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  return (
    <AuthoredFormPageFrame contentClassName={styles.contentWide}>
      <BackgroundForm
        mode={mode}
        systemId={response.item.systemId}
        userId={userId}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (background) => saveMutation.mutateAsync(background).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

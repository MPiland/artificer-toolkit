import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { BackgroundForm } from '../components/BackgroundForm'
import { createEmptyBackground } from '../backgroundAuthoring.utils'

export function BackgroundCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const systemId = systems[0]?.id
  const mutation = useMutation({
    mutationFn: (background: BackgroundAuthoredDto) => api.content.backgrounds.activate(background),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      notifications.show({ color: 'green', message: 'Background created.' })
      if (response?.item.id) {
        await navigate({ to: '/backgrounds/$backgroundId', params: { backgroundId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that background yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (background: BackgroundAuthoredDto) => api.content.backgrounds.saveDraft(background),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      notifications.show({ color: 'green', message: 'Background draft saved.' })
      await navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId: draft.subjectId } })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })

  if (!systemId) {
    return (
      <Stack>
        <Alert color='yellow'>A system is required before creating backgrounds.</Alert>
        <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
      </Stack>
    )
  }

  return (
    <BackgroundForm
      mode='create'
      systemId={systemId}
      userId={userId}
      initialBackground={createEmptyBackground({ systemId, userId })}
      onSubmit={async (background) => mutation.mutateAsync(background).then(() => undefined)}
      onSaveDraft={async (background) => draftMutation.mutateAsync(background).then(() => undefined)}
    />
  )
}

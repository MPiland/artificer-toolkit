import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { RaceForm } from '../components/RaceForm'
import { createEmptyRace, resolveCreateRaceSystemId } from '../raceAuthoring.utils'

export function RaceCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const systemId = resolveCreateRaceSystemId(systems)
  const mutation = useMutation({
    mutationFn: (race: RaceAuthoredDto) => api.content.races.activate(race),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      notifications.show({ color: 'green', message: 'Race created.' })
      if (response?.item.id) {
        await navigate({ to: '/races/$raceId', params: { raceId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that race yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (race: RaceAuthoredDto) => api.content.races.saveDraft(race),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      notifications.show({ color: 'green', message: 'Race draft saved.' })
      await navigate({ to: '/races/$raceId/edit', params: { raceId: draft.subjectId } })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })

  if (!systemId) {
    return (
      <Stack>
        <Alert color='yellow'>A system is required before creating races.</Alert>
        <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
      </Stack>
    )
  }

  return (
    <RaceForm
      mode='create'
      systemId={systemId}
      userId={userId}
      initialRace={createEmptyRace({ systemId, userId })}
      onSubmit={async (race) => mutation.mutateAsync(race).then(() => undefined)}
      onSaveDraft={async (race) => draftMutation.mutateAsync(race).then(() => undefined)}
    />
  )
}

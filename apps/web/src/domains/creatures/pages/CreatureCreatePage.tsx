import {
  Alert,
  Button,
  Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation,
  useQueryClient,
  useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { CreatureForm } from '../components/CreatureForm'
import { createEmptyCreature, resolveCreateCreatureSystemId } from '../creatureAuthoring.utils'

export function CreatureCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const systemId = resolveCreateCreatureSystemId(systems)
  const mutation = useMutation({
    mutationFn: (creature: CreatureAuthoredDto) => api.content.creatures.activate(creature),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      notifications.show({ color: 'green', message: 'Creature created.' })
      if (response?.item.id) {
        await navigate({ to: '/creatures/$creatureId', params: { creatureId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that creature yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (creature: CreatureAuthoredDto) => api.content.creatures.saveDraft(creature),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      notifications.show({ color: 'green', message: 'Creature draft saved.' })
      await navigate({ to: '/creatures/$creatureId/edit', params: { creatureId: draft.subjectId } })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })

  if (!systemId) {
    return (
      <Stack>
        <Alert color='yellow'>A system is required before creating creatures.</Alert>
        <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
      </Stack>
    )
  }

  return (
    <CreatureForm
      mode='create'
      systemId={systemId}
      userId={userId}
      initialCreature={createEmptyCreature({ systemId, userId })}
      onSubmit={async (creature) => mutation.mutateAsync(creature).then(() => undefined)}
      onSaveDraft={async (creature) => draftMutation.mutateAsync(creature).then(() => undefined)}
    />
  )
}

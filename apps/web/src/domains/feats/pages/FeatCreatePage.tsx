import {
  Alert,
  Button,
  Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation,
  useQueryClient,
  useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import { getEffectReferenceData } from '#app/data/effects'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { FeatForm } from '../components/FeatForm'
import { createEmptyFeat, resolveCreateFeatSystemId } from '../featAuthoring.utils'

export function FeatCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const systemId = resolveCreateFeatSystemId(systems)
  const { data: references } = useSuspenseQuery(getEffectReferenceData(systemId ?? undefined))
  const mutation = useMutation({
    mutationFn: (feat: FeatAuthoredDto) => api.content.feats.activate(feat),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      notifications.show({ color: 'green', message: 'Feat created.' })
      if (response?.item.id) {
        await navigate({ to: '/feats/$featId', params: { featId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that feat yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (feat: FeatAuthoredDto) => api.content.feats.saveDraft(feat),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      notifications.show({ color: 'green', message: 'Feat draft saved.' })
      await navigate({ to: '/feats/$featId/edit', params: { featId: draft.subjectId } })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })

  if (!systemId) {
    return (
      <Stack>
        <Alert color='yellow'>A system is required before creating feats.</Alert>
        <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
      </Stack>
    )
  }

  return (
    <FeatForm
      mode='create'
      systemId={systemId}
      userId={userId}
      references={references}
      initialFeat={createEmptyFeat({ systemId, userId })}
      onSubmit={async (feat) => mutation.mutateAsync(feat).then(() => undefined)}
      onSaveDraft={async (feat) => draftMutation.mutateAsync(feat).then(() => undefined)}
    />
  )
}

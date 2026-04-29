import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema'
import { AuthoredFormPageFrame } from '#components/Form/AuthoredFormPageFrame'
import { getEffectReferenceData } from '#app/data/effects'
import { getFeat } from '#app/data/feats/queries'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { FeatForm } from './FeatForm'
import { createEmptyFeat } from './featAuthoring.utils'
import * as styles from './featAuthoring.css'

export function FeatCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const { data: references } = useSuspenseQuery(getEffectReferenceData())
  const systemId = systems[0]?.id ?? references.systemId
  const mutation = useMutation({
    mutationFn: (feat: FeatAuthoredDto) => api.content.feats.upsert(feat),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      notifications.show({ color: 'green', message: 'Feat created.' })
      if (response?.item.id) {
        await navigate({ to: '/feats/$featId', params: { featId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that feat yet.' })
  })

  if (!systemId) {
    return (
      <AuthoredFormPageFrame contentClassName={styles.contentWide}>
        <Stack>
          <Alert color='yellow'>A system is required before creating feats.</Alert>
          <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  return (
    <AuthoredFormPageFrame contentClassName={styles.contentWide}>
      <FeatForm
        mode='create'
        systemId={systemId}
        userId={userId}
        references={references}
        initialFeat={createEmptyFeat({ systemId, userId })}
        onSubmit={async (feat) => mutation.mutateAsync(feat).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

export function FeatDetailPage({
  featId,
  mode,
  userId
}: {
  featId: string
  mode: 'view' | 'edit'
  userId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: response } = useSuspenseQuery(getFeat(featId))
  const { data: references } = useSuspenseQuery(getEffectReferenceData())
  const saveMutation = useMutation({
    mutationFn: (feat: FeatAuthoredDto) => api.content.feats.upsert(feat),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.detail(saved.item.id) })
        await navigate({ to: '/feats/$featId', params: { featId: saved.item.id } })
      }
      notifications.show({ color: 'green', message: 'Feat saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that feat yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.feats.duplicate(featId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      notifications.show({ color: 'green', message: 'Feat duplicated as an owned draft.' })
      if (copied?.item.id) {
        await navigate({ to: '/feats/$featId/edit', params: { featId: copied.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that feat yet.' })
  })

  if (!response) {
    return (
      <AuthoredFormPageFrame contentClassName={styles.contentWide}>
        <Stack>
          <Alert color='yellow'>That feat could not be found.</Alert>
          <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  return (
    <AuthoredFormPageFrame contentClassName={styles.contentWide}>
      <FeatForm
        mode={mode}
        systemId={response.item.systemId}
        userId={userId}
        references={references}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (feat) => saveMutation.mutateAsync(feat).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

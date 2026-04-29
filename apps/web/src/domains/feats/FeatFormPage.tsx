import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema'
import { AuthoredFormPageFrame } from '#components/Form/AuthoredFormPageFrame'
import { getEffectReferenceData } from '#app/data/effects'
import { getFeat, getFeatDraft } from '#app/data/feats/queries'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { FeatForm } from './FeatForm'
import { createEmptyFeat, resolveCreateFeatSystemId } from './featAuthoring.utils'
import * as styles from './featAuthoring.css'

export function FeatCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const { data: references } = useSuspenseQuery(getEffectReferenceData())
  const systemId = resolveCreateFeatSystemId(systems)
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
        onSaveDraft={async (feat) => draftMutation.mutateAsync(feat).then(() => undefined)}
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
  const { data: draft } = useSuspenseQuery(getFeatDraft(featId))
  const { data: references } = useSuspenseQuery(getEffectReferenceData())
  const saveMutation = useMutation({
    mutationFn: (feat: FeatAuthoredDto) => api.content.feats.activate(feat),
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
  const draftMutation = useMutation({
    mutationFn: (feat: FeatAuthoredDto) => api.content.feats.saveDraft(feat),
    onSuccess: async (savedDraft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.draft(savedDraft.subjectId) })
      notifications.show({ color: 'green', message: 'Feat draft saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.feats.duplicate(featId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      notifications.show({ color: 'green', message: 'Feat duplicated as an owned draft.' })
      if (copied?.subjectId) {
        await navigate({ to: '/feats/$featId/edit', params: { featId: copied.subjectId } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that feat yet.' })
  })

  if (!response && !draft) {
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
        systemId={draft?.systemId ?? response?.item.systemId ?? ''}
        userId={userId}
        references={references}
        initialFeat={draft ? draft.payload as unknown as FeatAuthoredDto : undefined}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (feat) => saveMutation.mutateAsync(feat).then(() => undefined)}
        onSaveDraft={async (feat) => draftMutation.mutateAsync(feat).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

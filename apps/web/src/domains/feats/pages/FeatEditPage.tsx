import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  featAuthoredDtoSchema,
  type FeatAuthoredDto
} from '@artificer-toolkit/schema'
import { InvalidDraftAlert } from '#forms'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { getEffectReferenceData } from '#app/data/effects'
import { getFeat, getFeatDraft } from '#app/data/feats/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { FeatForm } from '../components/FeatForm'

export function FeatEditPage({
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
  const parsedDraft = parseAuthoredDraftPayload(draft, featAuthoredDtoSchema)
  const draftFeat = parsedDraft.item
  const systemId = draftFeat?.systemId ?? response?.item.systemId ?? ''
  const { data: references } = useSuspenseQuery(getEffectReferenceData(systemId))
  const saveMutation = useMutation({
    mutationFn: (feat: FeatAuthoredDto) => api.content.feats.activate(feat),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.detail(saved.item.id) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.draft(saved.item.id) })
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
  const discardDraftMutation = useMutation({
    mutationFn: () => api.content.feats.discardDraft(featId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.draft(featId) })
      notifications.show({ color: 'green', message: 'Stale feat draft discarded.' })
      if (!response) {
        await navigate({ to: '/feats' })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
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

  if (!response && parsedDraft.isInvalid) {
    return (
      <Stack>
        <InvalidDraftAlert
          domainLabel='feat'
          isDiscarding={discardDraftMutation.isPending}
          onDiscard={() => discardDraftMutation.mutate()}
        />
        <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
      </Stack>
    )
  }

  if (!response && !draftFeat) {
    return (
      <Stack>
        <Alert color='yellow'>That feat could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
      </Stack>
    )
  }

  const formKey = `${mode}:${featId}:${draft?.updatedAt ?? response?.item.id ?? 'missing'}:${draftFeat ? 'draft' : 'active'}`

  return (
    <Stack>
      {parsedDraft.isInvalid
        ? (
            <InvalidDraftAlert
              domainLabel='feat'
              isDiscarding={discardDraftMutation.isPending}
              onDiscard={() => discardDraftMutation.mutate()}
            />
          )
        : null}
      <FeatForm
        key={formKey}
        mode={mode}
        systemId={systemId}
        userId={userId}
        references={references}
        initialFeat={draftFeat}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (feat) => saveMutation.mutateAsync(feat).then(() => undefined)}
        onSaveDraft={async (feat) => draftMutation.mutateAsync(feat).then(() => undefined)}
      />
    </Stack>
  )
}

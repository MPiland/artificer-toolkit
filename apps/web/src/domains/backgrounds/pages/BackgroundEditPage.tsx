import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  backgroundAuthoredDtoSchema,
  type BackgroundAuthoredDto
} from '@artificer-toolkit/schema'
import { InvalidDraftAlert } from '#forms'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { getBackground, getBackgroundDraft } from '#app/data/backgrounds/queries'
import { BackgroundForm } from '../components/BackgroundForm'

export function BackgroundEditPage({
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
  const { data: draft } = useSuspenseQuery(getBackgroundDraft(backgroundId))
  const parsedDraft = parseAuthoredDraftPayload(draft, backgroundAuthoredDtoSchema)
  const draftBackground = parsedDraft.item
  const saveMutation = useMutation({
    mutationFn: (background: BackgroundAuthoredDto) => api.content.backgrounds.activate(background),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.detail(saved.item.id) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.draft(saved.item.id) })
        await navigate({ to: '/backgrounds/$backgroundId', params: { backgroundId: saved.item.id } })
      }
      notifications.show({ color: 'green', message: 'Background saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that background yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (background: BackgroundAuthoredDto) => api.content.backgrounds.saveDraft(background),
    onSuccess: async (savedDraft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.draft(savedDraft.subjectId) })
      notifications.show({ color: 'green', message: 'Background draft saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })
  const discardDraftMutation = useMutation({
    mutationFn: () => api.content.backgrounds.discardDraft(backgroundId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.draft(backgroundId) })
      notifications.show({ color: 'green', message: 'Stale background draft discarded.' })
      if (!response) {
        await navigate({ to: '/backgrounds' })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.backgrounds.duplicate(backgroundId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      notifications.show({ color: 'green', message: 'Background duplicated as an owned draft.' })
      if (copied?.subjectId) {
        await navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId: copied.subjectId } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that background yet.' })
  })

  if (!response && parsedDraft.isInvalid) {
    return (
      <Stack>
        <InvalidDraftAlert
          domainLabel='background'
          isDiscarding={discardDraftMutation.isPending}
          onDiscard={() => discardDraftMutation.mutate()}
        />
        <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
      </Stack>
    )
  }

  if (!response && !draftBackground) {
    return (
      <Stack>
        <Alert color='yellow'>That background could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
      </Stack>
    )
  }

  const formKey = `${mode}:${backgroundId}:${draft?.updatedAt ?? response?.item.id ?? 'missing'}:${draftBackground ? 'draft' : 'active'}`

  return (
    <Stack>
      {parsedDraft.isInvalid
        ? (
            <InvalidDraftAlert
              domainLabel='background'
              isDiscarding={discardDraftMutation.isPending}
              onDiscard={() => discardDraftMutation.mutate()}
            />
          )
        : null}
      <BackgroundForm
        key={formKey}
        mode={mode}
        systemId={draftBackground?.systemId ?? response?.item.systemId ?? ''}
        userId={userId}
        initialBackground={draftBackground}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (background) => saveMutation.mutateAsync(background).then(() => undefined)}
        onSaveDraft={async (background) => draftMutation.mutateAsync(background).then(() => undefined)}
      />
    </Stack>
  )
}

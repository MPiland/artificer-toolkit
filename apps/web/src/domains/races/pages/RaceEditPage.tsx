import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  raceAuthoredDtoSchema,
  type RaceAuthoredDto
} from '@artificer-toolkit/schema'
import { InvalidDraftAlert } from '#forms'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { getRace, getRaceDraft } from '#app/data/races/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { RaceForm } from '../components/RaceForm'

export function RaceEditPage({
  raceId,
  mode,
  userId
}: {
  raceId: string
  mode: 'view' | 'edit'
  userId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: response } = useSuspenseQuery(getRace(raceId))
  const { data: draft } = useSuspenseQuery(getRaceDraft(raceId))
  const parsedDraft = parseAuthoredDraftPayload(draft, raceAuthoredDtoSchema)
  const draftRace = parsedDraft.item
  const systemId = draftRace?.systemId ?? response?.item.systemId ?? ''
  const saveMutation = useMutation({
    mutationFn: (race: RaceAuthoredDto) => api.content.races.activate(race),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.detail(saved.item.id) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.draft(saved.item.id) })
        await navigate({ to: '/races/$raceId', params: { raceId: saved.item.id } })
      }
      notifications.show({ color: 'green', message: 'Race saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that race yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (race: RaceAuthoredDto) => api.content.races.saveDraft(race),
    onSuccess: async (savedDraft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.draft(savedDraft.subjectId) })
      notifications.show({ color: 'green', message: 'Race draft saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })
  const discardDraftMutation = useMutation({
    mutationFn: () => api.content.races.discardDraft(raceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.draft(raceId) })
      notifications.show({ color: 'green', message: 'Stale race draft discarded.' })
      if (!response) {
        await navigate({ to: '/races' })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.races.duplicate(raceId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      notifications.show({ color: 'green', message: 'Race duplicated as an owned draft.' })
      if (copied?.subjectId) {
        await navigate({ to: '/races/$raceId/edit', params: { raceId: copied.subjectId } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that race yet.' })
  })

  if (!response && parsedDraft.isInvalid) {
    return (
      <Stack>
        <InvalidDraftAlert
          domainLabel='race'
          isDiscarding={discardDraftMutation.isPending}
          onDiscard={() => discardDraftMutation.mutate()}
        />
        <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
      </Stack>
    )
  }

  if (!response && !draftRace) {
    return (
      <Stack>
        <Alert color='yellow'>That race could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
      </Stack>
    )
  }

  const formKey = `${mode}:${raceId}:${draft?.updatedAt ?? response?.item.id ?? 'missing'}:${draftRace ? 'draft' : 'active'}`

  return (
    <Stack>
      {parsedDraft.isInvalid
        ? (
            <InvalidDraftAlert
              domainLabel='race'
              isDiscarding={discardDraftMutation.isPending}
              onDiscard={() => discardDraftMutation.mutate()}
            />
          )
        : null}
      <RaceForm
        key={formKey}
        mode={mode}
        systemId={systemId}
        userId={userId}
        initialRace={draftRace}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (race) => saveMutation.mutateAsync(race).then(() => undefined)}
        onSaveDraft={async (race) => draftMutation.mutateAsync(race).then(() => undefined)}
      />
    </Stack>
  )
}

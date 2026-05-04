import {
  Alert,
  Button,
  Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation,
  useQueryClient,
  useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { type CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import { InvalidDraftAlert } from '#forms'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { getCreature, getCreatureDraft } from '#app/data/creatures/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { CreatureForm } from '../components/CreatureForm'

export function CreatureEditPage({
  creatureId,
  mode,
  userId
}: {
  creatureId: string
  mode: 'view' | 'edit'
  userId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: response } = useSuspenseQuery(getCreature(creatureId))
  const { data: draft } = useSuspenseQuery(getCreatureDraft(creatureId))
  const parsedDraft = parseAuthoredDraftPayload(draft, creatureAuthoredDtoSchema)
  const draftCreature = parsedDraft.item
  const systemId = draftCreature?.systemId ?? response?.item.systemId ?? ''
  const saveMutation = useMutation({
    mutationFn: (creature: CreatureAuthoredDto) => api.content.creatures.activate(creature),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.detail(saved.item.id) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.draft(saved.item.id) })
        await navigate({ to: '/creatures/$creatureId', params: { creatureId: saved.item.id } })
      }
      notifications.show({ color: 'green', message: 'Creature saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that creature yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (creature: CreatureAuthoredDto) => api.content.creatures.saveDraft(creature),
    onSuccess: async (savedDraft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.draft(savedDraft.subjectId) })
      notifications.show({ color: 'green', message: 'Creature draft saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })
  const discardDraftMutation = useMutation({
    mutationFn: () => api.content.creatures.discardDraft(creatureId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.draft(creatureId) })
      notifications.show({ color: 'green', message: 'Stale creature draft discarded.' })
      if (!response) {
        await navigate({ to: '/creatures' })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.creatures.duplicate(creatureId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      notifications.show({ color: 'green', message: 'Creature duplicated as an owned draft.' })
      if (copied?.subjectId) {
        await navigate({ to: '/creatures/$creatureId/edit', params: { creatureId: copied.subjectId } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that creature yet.' })
  })

  if (!response && parsedDraft.isInvalid) {
    return (
      <Stack>
        <InvalidDraftAlert
          domainLabel='creature'
          isDiscarding={discardDraftMutation.isPending}
          onDiscard={() => discardDraftMutation.mutate()}
        />
        <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
      </Stack>
    )
  }

  if (!response && !draftCreature) {
    return (
      <Stack>
        <Alert color='yellow'>That creature could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
      </Stack>
    )
  }

  const formKey = `${mode}:${creatureId}:${draft?.updatedAt ?? response?.item.id ?? 'missing'}:${draftCreature ? 'draft' : 'active'}`

  return (
    <Stack>
      {parsedDraft.isInvalid
        ? (
            <InvalidDraftAlert
              domainLabel='creature'
              isDiscarding={discardDraftMutation.isPending}
              onDiscard={() => discardDraftMutation.mutate()}
            />
          )
        : null}
      <CreatureForm
        key={formKey}
        mode={mode}
        systemId={systemId}
        userId={userId}
        initialCreature={draftCreature}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (creature) => saveMutation.mutateAsync(creature).then(() => undefined)}
        onSaveDraft={async (creature) => draftMutation.mutateAsync(creature).then(() => undefined)}
      />
    </Stack>
  )
}

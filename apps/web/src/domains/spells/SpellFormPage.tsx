import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { SpellAuthoredDto } from '@artificer-toolkit/schema'
import { AuthoredFormPageFrame } from '#components/Form/AuthoredFormPageFrame'
import { getSpell } from '#app/data/spells/queries'
import { getSpellReferenceData } from '#app/data/spells/referenceData'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { SpellForm } from './SpellForm'
import { createEmptySpell } from './spellAuthoring.utils'

export function SpellCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: references } = useSuspenseQuery(getSpellReferenceData())
  const mutation = useMutation({
    mutationFn: (spell: SpellAuthoredDto) => api.content.spells.upsert(spell),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      notifications.show({ color: 'green', message: 'Spell created.' })
      if (response?.item.id) {
        await navigate({ to: '/spells/$spellId', params: { spellId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that spell yet.' })
  })

  return (
    <AuthoredFormPageFrame>
      <SpellForm
        mode='create'
        userId={userId}
        references={references}
        initialSpell={createEmptySpell({ systemId: references.systemId, userId })}
        onSubmit={async (spell) => mutation.mutateAsync(spell).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

export function SpellDetailPage({
  spellId,
  mode,
  userId
}: {
  spellId: string
  mode: 'view' | 'edit'
  userId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: response } = useSuspenseQuery(getSpell(spellId))
  const { data: references } = useSuspenseQuery(getSpellReferenceData())
  const saveMutation = useMutation({
    mutationFn: (spell: SpellAuthoredDto) => api.content.spells.upsert(spell),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.detail(saved.item.id) })
        await navigate({ to: '/spells/$spellId', params: { spellId: saved.item.id } })
      }
      notifications.show({ color: 'green', message: 'Spell saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that spell yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.spells.duplicate(spellId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      notifications.show({ color: 'green', message: 'Spell duplicated as an owned draft.' })
      if (copied?.item.id) {
        await navigate({ to: '/spells/$spellId/edit', params: { spellId: copied.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that spell yet.' })
  })

  if (!response) {
    return (
      <AuthoredFormPageFrame>
        <Stack>
          <Alert color='yellow'>That spell could not be found.</Alert>
          <Button onClick={() => navigate({ to: '/spells' })}>Back to spells</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  return (
    <AuthoredFormPageFrame>
      <SpellForm
        mode={mode}
        userId={userId}
        references={references}
        response={response}
        onCopy={() => copyMutation.mutate()}
        onSubmit={async (spell) => saveMutation.mutateAsync(spell).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

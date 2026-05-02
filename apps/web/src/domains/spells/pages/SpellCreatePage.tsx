import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { SpellAuthoredDto } from '@artificer-toolkit/schema'
import { getSpellReferenceData } from '#app/data/spells/referenceData'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { SpellForm } from '../components/SpellForm'
import { createEmptySpell } from '../spellAuthoring.utils'

export function SpellCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: references } = useSuspenseQuery(getSpellReferenceData())
  const mutation = useMutation({
    mutationFn: (spell: SpellAuthoredDto) => api.content.spells.activate(spell),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      notifications.show({ color: 'green', message: 'Spell created.' })
      if (response?.item.id) {
        await navigate({ to: '/spells/$spellId', params: { spellId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that spell yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (spell: SpellAuthoredDto) => api.content.spells.saveDraft(spell),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      notifications.show({ color: 'green', message: 'Spell draft saved.' })
      await navigate({ to: '/spells/$spellId/edit', params: { spellId: draft.subjectId } })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })

  return (
    <SpellForm
      mode='create'
      userId={userId}
      references={references}
      initialSpell={createEmptySpell({ systemId: references.systemId, userId })}
      onSubmit={async (spell) => mutation.mutateAsync(spell).then(() => undefined)}
      onSaveDraft={async (spell) => draftMutation.mutateAsync(spell).then(() => undefined)}
    />
  )
}

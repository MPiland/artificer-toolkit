import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { createServerApi } from '#lib/api'
import { getSpellList } from '#app/data/spells/queries'
import {
  buildSpellListFilters,
  mapSpellListToAuthoredItems,
  spellListAttributeColumns,
  spellListSortOptions,
  summarizeSpellList
} from '#app/data/spells/spellListMapper'
import { queryKeys } from '#app/lib/queryKeys'
import { api } from '#app/lib/api'

export const Route = createFileRoute('/_authed/spells/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getSpellList(createServerApi())),
  component: SpellsRoute
})

function SpellsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getSpellList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.spells.duplicate(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      notifications.show({
        color: 'green',
        message: 'Spell duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/spells/$spellId/edit', params: { spellId: response.subjectId } })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that spell yet.'
      })
    }
  })

  return (
    <AuthoredListPage
      title='Spells'
      summary={summarizeSpellList(data)}
      createLabel='Create Spell'
      items={mapSpellListToAuthoredItems(data)}
      filters={buildSpellListFilters(data)}
      attributeColumns={spellListAttributeColumns}
      sortOptions={spellListSortOptions}
      onCreate={() => navigate({ to: '/spells/new' })}
      onView={(item) => navigate({ to: '/spells/$spellId', params: { spellId: item.id } })}
      onEdit={(item) => navigate({ to: '/spells/$spellId/edit', params: { spellId: item.id } })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

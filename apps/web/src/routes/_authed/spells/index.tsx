import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { createServerApi } from '#lib/api'
import { getSpellList } from '#app/data/spells/queries'
import {
  buildSpellListFilters,
  mapSpellListToAuthoredItems,
  summarizeSpellList
} from '#app/data/spells/spellListMapper'
import { queryKeys } from '#app/lib/queryKeys'
import { api } from '#app/lib/api'

export const Route = createFileRoute('/_authed/spells/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getSpellList(createServerApi(context.accessToken))),
  component: SpellsRoute
})

function SpellsRoute() {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getSpellList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.spells.duplicate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      notifications.show({
        color: 'green',
        message: 'Spell duplicated as owned content.'
      })
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
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

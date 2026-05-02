import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildCreatureListFilters,
  creatureListAttributeColumns,
  creatureListSortOptions,
  mapCreatureListToAuthoredItems,
  summarizeCreatureList
} from '#app/data/creatures/creatureListMapper'
import { getCreatureList } from '#app/data/creatures/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export const Route = createFileRoute('/_authed/creatures/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getCreatureList(createServerApi(context.accessToken))),
  component: CreaturesRoute
})

function CreaturesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getCreatureList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.creatures.duplicate(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      notifications.show({
        color: 'green',
        message: 'Creature duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/creatures/$creatureId/edit', params: { creatureId: response.subjectId } })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that creature yet.'
      })
    }
  })

  return (
    <AuthoredListPage
      title='Creatures'
      summary={summarizeCreatureList(data)}
      createLabel='Create Creature'
      items={mapCreatureListToAuthoredItems(data)}
      filters={buildCreatureListFilters(data)}
      attributeColumns={creatureListAttributeColumns}
      sortOptions={creatureListSortOptions}
      onCreate={() => navigate({ to: '/creatures/new' })}
      onView={(item) => navigate({ to: '/creatures/$creatureId', params: { creatureId: item.id } })}
      onEdit={(item) => navigate({ to: '/creatures/$creatureId/edit', params: { creatureId: item.id } })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

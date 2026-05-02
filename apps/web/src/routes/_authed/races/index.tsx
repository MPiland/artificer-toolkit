import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildRaceListFilters,
  mapRaceListToAuthoredItems,
  raceListAttributeColumns,
  raceListSortOptions,
  summarizeRaceList
} from '#app/data/races/raceListMapper'
import { getRaceList } from '#app/data/races/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export const Route = createFileRoute('/_authed/races/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getRaceList(createServerApi(context.accessToken))),
  component: RacesRoute
})

function RacesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getRaceList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.races.duplicate(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      notifications.show({
        color: 'green',
        message: 'Race duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/races/$raceId/edit', params: { raceId: response.subjectId } })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that race yet.'
      })
    }
  })

  return (
    <AuthoredListPage
      title='Races'
      summary={summarizeRaceList(data)}
      createLabel='Create Race'
      items={mapRaceListToAuthoredItems(data)}
      filters={buildRaceListFilters(data)}
      attributeColumns={raceListAttributeColumns}
      sortOptions={raceListSortOptions}
      onCreate={() => navigate({ to: '/races/new' })}
      onView={(item) => navigate({ to: '/races/$raceId/edit', params: { raceId: item.id } })}
      onEdit={(item) => navigate({ to: '/races/$raceId/edit', params: { raceId: item.id } })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

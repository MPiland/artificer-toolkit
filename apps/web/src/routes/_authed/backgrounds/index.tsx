import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { getBackgroundList } from '#app/data/backgrounds/queries'
import {
  backgroundListAttributeColumns,
  backgroundListSortOptions,
  buildBackgroundListFilters,
  mapBackgroundListToAuthoredItems,
  summarizeBackgroundList
} from '#app/data/backgrounds/backgroundListMapper'

export const Route = createFileRoute('/_authed/backgrounds/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getBackgroundList(createServerApi(context.accessToken))),
  component: BackgroundsRoute
})

function BackgroundsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getBackgroundList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.backgrounds.duplicate(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      notifications.show({
        color: 'green',
        message: 'Background duplicated as owned content.'
      })
      if (response?.item.id) {
        await navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId: response.item.id } })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that background yet.'
      })
    }
  })

  return (
    <AuthoredListPage
      title='Backgrounds'
      summary={summarizeBackgroundList(data)}
      createLabel='Create Background'
      items={mapBackgroundListToAuthoredItems(data)}
      filters={buildBackgroundListFilters(data)}
      attributeColumns={backgroundListAttributeColumns}
      sortOptions={backgroundListSortOptions}
      onCreate={() => navigate({ to: '/backgrounds/new' })}
      onView={(item) => navigate({ to: '/backgrounds/$backgroundId', params: { backgroundId: item.id } })}
      onEdit={(item) => navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId: item.id } })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  featListAttributeColumns,
  featListSortOptions,
  buildFeatListFilters,
  mapFeatListToAuthoredItems,
  summarizeFeatList
} from '#app/data/feats/featListMapper'
import { getFeatList } from '#app/data/feats/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export const Route = createFileRoute('/_authed/feats/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getFeatList(createServerApi(context.accessToken))),
  component: FeatsRoute
})

function FeatsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getFeatList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.feats.duplicate(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      notifications.show({
        color: 'green',
        message: 'Feat duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/feats/$featId/edit', params: { featId: response.subjectId } })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that feat yet.'
      })
    }
  })

  return (
    <AuthoredListPage
      title='Feats'
      summary={summarizeFeatList(data)}
      createLabel='Create Feat'
      items={mapFeatListToAuthoredItems(data)}
      filters={buildFeatListFilters(data)}
      attributeColumns={featListAttributeColumns}
      sortOptions={featListSortOptions}
      onCreate={() => navigate({ to: '/feats/new' })}
      onView={(item) => navigate({ to: '/feats/$featId/edit', params: { featId: item.id } })}
      onEdit={(item) => navigate({ to: '/feats/$featId/edit', params: { featId: item.id } })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

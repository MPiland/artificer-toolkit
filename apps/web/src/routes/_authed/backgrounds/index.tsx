import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { getBackground, getBackgroundList } from '#app/data/backgrounds/queries'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import {
  backgroundListAttributeColumns,
  backgroundListSortOptions,
  buildBackgroundListFilters,
  mapBackgroundListToAuthoredItems,
  summarizeBackgroundList
} from '#app/data/backgrounds/backgroundListMapper'

export const Route = createFileRoute('/_authed/backgrounds/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getBackgroundList(createServerApi())),
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
      if (response?.subjectId) {
        await navigate({
          params: buildBackgroundRouteParams(response.publicId, response.label),
          to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
        })
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
      draftItems={mapDraftSummariesToAuthoredItems(data.drafts)}
      filters={buildBackgroundListFilters(data)}
      attributeColumns={backgroundListAttributeColumns}
      sortOptions={backgroundListSortOptions}
      onCreate={() => navigate({ to: '/backgrounds/new' })}
      onView={(item) => navigate({
        params: buildBackgroundRouteParams(item.publicId, item.name),
        search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
        to: '/backgrounds/$backgroundPublicId/$backgroundSlug'
      })}
      onViewIntent={(item) => {
        void queryClient.prefetchQuery(getBackground({
          id: item.id,
          includeDraft: true,
          view: item.contentState === 'draft' ? 'draft' : 'active'
        }))
      }}
      onEdit={(item) => navigate({
        params: buildBackgroundRouteParams(item.publicId, item.name),
        to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
      })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import {
  buildCreatureListFilters,
  creatureListAttributeColumns,
  creatureListSortOptions,
  formatCreatureCategory,
  mapCreatureListToAuthoredItems,
  summarizeCreatureList
} from '#app/data/creatures/creatureListMapper'
import { getCreature, getCreatureList } from '#app/data/creatures/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'

const creatureDetailMeta = ['challengeRatings', 'conditionTypes', 'creatureTypes', 'damageTypes', 'speeds']

export const Route = createFileRoute('/_authed/creatures/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getCreatureList(createServerApi())),
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
        await navigate({
          params: buildCreatureRouteParams(response.publicId, response.label),
          to: '/creatures/$creaturePublicId/$creatureSlug/edit'
        })
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
      draftItems={mapDraftSummariesToAuthoredItems(data.drafts, {
        categoryAttributeKey: 'Category',
        formatCategory: formatCreatureCategory
      })}
      filters={buildCreatureListFilters(data)}
      attributeColumns={creatureListAttributeColumns}
      sortOptions={creatureListSortOptions}
      onCreate={() => navigate({ to: '/creatures/new' })}
      onView={(item) => navigate({
        params: buildCreatureRouteParams(item.publicId, item.name),
        search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
        to: '/creatures/$creaturePublicId/$creatureSlug'
      })}
      onViewIntent={(item) => {
        void queryClient.prefetchQuery(getCreature({
          id: item.id,
          includeDraft: true,
          meta: creatureDetailMeta,
          view: item.contentState === 'draft' ? 'draft' : 'active'
        }))
      }}
      onEdit={(item) => navigate({
        params: buildCreatureRouteParams(item.publicId, item.name),
        to: '/creatures/$creaturePublicId/$creatureSlug/edit'
      })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}

import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogWindow } from '#components/AuthoredList/useAuthoredCatalogWindow'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import {
  buildCreatureListFilters,
  creatureListAttributeColumns,
  creatureListSortOptions,
  formatCreatureCategory,
  mapCreatureListToAuthoredItems,
  summarizeCreatureList
} from '#app/data/creatures/creatureListMapper'
import { getCreature, getCreatureList, useGetCreatureList } from '#app/data/creatures/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import type { CreatureListRequestDto } from '#app/lib/api'

const creatureDetailMeta = [
  'challengeRatings',
  'conditionTypes',
  'creatureTypes',
  'damageTypes',
  'speeds'
]
const creatureCatalogueRequest = {
  direction: 'FORWARD',
  limit: 48,
  sort: 'name'
} satisfies CreatureListRequestDto

export const Route = createFileRoute('/_authed/creatures/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureInfiniteQueryData(
      getCreatureList(creatureCatalogueRequest, createServerApi())
    )
  },
  component: CreaturesRoute
})

function CreaturesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogWindow({
    buildFilters: buildCreatureListFilters,
    buildRequest: ({ filterValues, query, sort }): CreatureListRequestDto => ({
      ...creatureCatalogueRequest,
      category: filterValues.category ?? undefined,
      query: query || undefined,
      sort: sort === 'category' ? 'category' : 'name',
      source:
        filterValues.source === 'MASTER' || filterValues.source === 'OWNED'
          ? filterValues.source
          : undefined
    }),
    initialSort: 'name',
    mapDrafts: (response) =>
      mapDraftSummariesToAuthoredItems(response.drafts, {
        categoryAttributeKey: 'Category',
        formatCategory: formatCreatureCategory
      }),
    mapItems: mapCreatureListToAuthoredItems,
    summarize: summarizeCreatureList,
    useList: useGetCreatureList
  })
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
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.creatures.deleteActive,
    deleteDraft: api.content.creatures.discardDraft,
    detailSubjectQueryKey: queryKeys.content.creatures.detailRoot,
    domainLabel: 'Creature',
    domainQueryKey: queryKeys.content.creatures.all(),
    draftQueryKey: queryKeys.content.creatures.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Creatures'
        summary={listing.summary ?? 'Loading creatures...'}
        createLabel='Create Creature'
        items={listing.items}
        draftItems={listing.draftItems}
        filters={listing.filters}
        attributeColumns={creatureListAttributeColumns}
        sortOptions={creatureListSortOptions}
        catalog={listing.catalog}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/creatures/new' })}
        onView={(item) =>
          navigate({
            params: buildCreatureRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/creatures/$creaturePublicId/$creatureSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getCreature({
              id: item.id,
              meta: creatureDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildCreatureRouteParams(item.publicId, item.name),
            to: '/creatures/$creaturePublicId/$creatureSlug/edit'
          })
        }
        onCopy={(item) => duplicateMutation.mutate(item.id)}
        onDelete={(item) =>
          deleteAction.requestDelete({
            id: item.id,
            kind: item.contentState === 'draft' ? 'draft' : 'active',
            label: item.name
          })
        }
      />
      {deleteAction.confirmation}
    </>
  )
}

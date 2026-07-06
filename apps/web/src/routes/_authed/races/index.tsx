import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import {
  buildRaceListFilters,
  formatRaceCategory,
  mapRaceListToAuthoredItems,
  raceListAttributeColumns,
  raceListSortOptions,
  summarizeRaceList
} from '#app/data/races/raceListMapper'
import { getRace, getRaceList } from '#app/data/races/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'

const raceDetailMeta = ['heritages', 'races', 'speeds']

export const Route = createFileRoute('/_authed/races/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getRaceList(createServerApi()))
  },
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
        await navigate({
          params: buildRaceRouteParams(response.publicId, response.label),
          to: '/races/$racePublicId/$raceSlug/edit'
        })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that race yet.'
      })
    }
  })
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.races.deleteActive,
    deleteDraft: api.content.races.discardDraft,
    detailSubjectQueryKey: queryKeys.content.races.detailRoot,
    domainLabel: 'Race',
    domainQueryKey: queryKeys.content.races.all(),
    draftQueryKey: queryKeys.content.races.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Races'
        summary={summarizeRaceList(data)}
        createLabel='Create Race'
        items={mapRaceListToAuthoredItems(data)}
        draftItems={mapDraftSummariesToAuthoredItems(data.drafts, {
          categoryAttributeKey: 'Category',
          formatCategory: formatRaceCategory
        })}
        filters={buildRaceListFilters(data)}
        attributeColumns={raceListAttributeColumns}
        sortOptions={raceListSortOptions}
        onCreate={() => navigate({ to: '/races/new' })}
        onView={(item) => navigate({
          params: buildRaceRouteParams(item.publicId, item.name),
          search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
          to: '/races/$racePublicId/$raceSlug'
        })}
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(getRace({
            id: item.id,
            includeDraft: true,
            meta: raceDetailMeta,
            view: item.contentState === 'draft' ? 'draft' : 'active'
          }))
        }}
        onEdit={(item) => navigate({
          params: buildRaceRouteParams(item.publicId, item.name),
          to: '/races/$racePublicId/$raceSlug/edit'
        })}
        onCopy={(item) => duplicateMutation.mutate(item.id)}
        onDelete={(item) => deleteAction.requestDelete({
          id: item.id,
          kind: item.contentState === 'draft' ? 'draft' : 'active',
          label: item.name
        })}
      />
      {deleteAction.confirmation}
    </>
  )
}

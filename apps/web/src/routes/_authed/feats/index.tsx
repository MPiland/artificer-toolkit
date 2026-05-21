import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import {
  featListAttributeColumns,
  featListSortOptions,
  buildFeatListFilters,
  mapFeatListToAuthoredItems,
  summarizeFeatList
} from '#app/data/feats/featListMapper'
import { getFeat, getFeatList } from '#app/data/feats/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'

export const Route = createFileRoute('/_authed/feats/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getFeatList(createServerApi())),
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
        await navigate({
          params: buildFeatRouteParams(response.publicId, response.label),
          to: '/feats/$featPublicId/$featSlug/edit'
        })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that feat yet.'
      })
    }
  })
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.feats.deleteActive,
    deleteDraft: api.content.feats.discardDraft,
    detailSubjectQueryKey: queryKeys.content.feats.detailRoot,
    domainLabel: 'Feat',
    domainQueryKey: queryKeys.content.feats.all(),
    draftQueryKey: queryKeys.content.feats.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Feats'
        summary={summarizeFeatList(data)}
        createLabel='Create Feat'
        items={mapFeatListToAuthoredItems(data)}
        draftItems={mapDraftSummariesToAuthoredItems(data.drafts)}
        filters={buildFeatListFilters(data)}
        attributeColumns={featListAttributeColumns}
        sortOptions={featListSortOptions}
        onCreate={() => navigate({ to: '/feats/new' })}
        onView={(item) => navigate({
          params: buildFeatRouteParams(item.publicId, item.name),
          search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
          to: '/feats/$featPublicId/$featSlug'
        })}
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(getFeat({
            id: item.id,
            includeDraft: true,
            view: item.contentState === 'draft' ? 'draft' : 'active'
          }))
        }}
        onEdit={(item) => navigate({
          params: buildFeatRouteParams(item.publicId, item.name),
          to: '/feats/$featPublicId/$featSlug/edit'
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

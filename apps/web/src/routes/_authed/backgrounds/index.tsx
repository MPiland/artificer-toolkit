import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogWindow } from '#components/AuthoredList/useAuthoredCatalogWindow'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getBackground,
  getBackgroundList,
  useGetBackgroundList
} from '#app/data/backgrounds/queries'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import type { BackgroundListRequestDto } from '#app/lib/api'

const backgroundDetailMeta = ['currencies', 'equipment', 'languages', 'skills']
const backgroundCatalogueRequest = {
  direction: 'FORWARD',
  limit: 48,
  sort: 'name'
} satisfies BackgroundListRequestDto
import {
  backgroundListAttributeColumns,
  backgroundListSortOptions,
  buildBackgroundListFilters,
  mapBackgroundListToAuthoredItems,
  summarizeBackgroundList
} from '#app/data/backgrounds/backgroundListMapper'

export const Route = createFileRoute('/_authed/backgrounds/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureInfiniteQueryData(
      getBackgroundList(backgroundCatalogueRequest, createServerApi())
    )
  },
  component: BackgroundsRoute
})

function BackgroundsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogWindow({
    buildFilters: buildBackgroundListFilters,
    buildRequest: ({ filterValues, query }): BackgroundListRequestDto => ({
      ...backgroundCatalogueRequest,
      query: query || undefined,
      source:
        filterValues.source === 'MASTER' || filterValues.source === 'OWNED'
          ? filterValues.source
          : undefined
    }),
    initialSort: 'name',
    mapDrafts: (response) => mapDraftSummariesToAuthoredItems(response.drafts),
    mapItems: mapBackgroundListToAuthoredItems,
    summarize: summarizeBackgroundList,
    useList: useGetBackgroundList
  })
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
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.backgrounds.deleteActive,
    deleteDraft: api.content.backgrounds.discardDraft,
    detailSubjectQueryKey: queryKeys.content.backgrounds.detailRoot,
    domainLabel: 'Background',
    domainQueryKey: queryKeys.content.backgrounds.all(),
    draftQueryKey: queryKeys.content.backgrounds.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Backgrounds'
        summary={listing.summary ?? 'Loading backgrounds...'}
        createLabel='Create Background'
        items={listing.items}
        draftItems={listing.draftItems}
        filters={listing.filters}
        attributeColumns={backgroundListAttributeColumns}
        sortOptions={backgroundListSortOptions}
        catalog={listing.catalog}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/backgrounds/new' })}
        onView={(item) =>
          navigate({
            params: buildBackgroundRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/backgrounds/$backgroundPublicId/$backgroundSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getBackground({
              id: item.id,
              meta: backgroundDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildBackgroundRouteParams(item.publicId, item.name),
            to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
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

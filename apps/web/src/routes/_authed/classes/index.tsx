import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogWindow } from '#components/AuthoredList/useAuthoredCatalogWindow'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import {
  buildClassListFilters,
  classListAttributeColumns,
  classListSortOptions,
  formatClassCategory,
  mapClassListToAuthoredItems,
  summarizeClassList
} from '#app/data/classes/classListMapper'
import { useDuplicateClassMutation } from '#app/data/classes/mutations'
import { getClass, getClassList, useGetClassList } from '#app/data/classes/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import type { ClassListRequestDto } from '#app/lib/api'

const classDetailMeta = ['classes', 'currencies', 'equipment', 'languages', 'skills']
const classCatalogueRequest = {
  direction: 'FORWARD',
  limit: 48,
  sort: 'name'
} satisfies ClassListRequestDto

export const Route = createFileRoute('/_authed/classes/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureInfiniteQueryData(
      getClassList(classCatalogueRequest, createServerApi())
    )
  },
  component: ClassesRoute
})

function ClassesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogWindow({
    buildFilters: buildClassListFilters,
    buildRequest: ({ filterValues, query, sort }): ClassListRequestDto => ({
      ...classCatalogueRequest,
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
        formatCategory: formatClassCategory
      }),
    mapItems: mapClassListToAuthoredItems,
    summarize: summarizeClassList,
    useList: useGetClassList
  })
  const duplicateMutation = useDuplicateClassMutation()
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.classes.deleteActive,
    deleteDraft: api.content.classes.discardDraft,
    detailSubjectQueryKey: queryKeys.content.classes.detailRoot,
    domainLabel: 'Class',
    domainQueryKey: queryKeys.content.classes.all(),
    draftQueryKey: queryKeys.content.classes.draft
  })

  async function handleDuplicate(classId: string) {
    try {
      const response = await duplicateMutation.mutateAsync(classId)
      notifications.show({
        color: 'green',
        message: 'Class duplicated as an owned draft.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildClassRouteParams(response.publicId, response.label),
          to: '/classes/$classPublicId/$classSlug/edit'
        })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that class yet.'
      })
    }
  }

  return (
    <>
      <AuthoredListPage
        title='Classes'
        summary={listing.summary ?? 'Loading classes...'}
        createLabel='Create Class'
        items={listing.items}
        draftItems={listing.draftItems}
        filters={listing.filters}
        attributeColumns={classListAttributeColumns}
        sortOptions={classListSortOptions}
        catalog={listing.catalog}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/classes/new' })}
        onView={(item) =>
          navigate({
            params: buildClassRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/classes/$classPublicId/$classSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getClass({
              id: item.id,
              meta: classDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildClassRouteParams(item.publicId, item.name),
            to: '/classes/$classPublicId/$classSlug/edit'
          })
        }
        onCopy={(item) => void handleDuplicate(item.id)}
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

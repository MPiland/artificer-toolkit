import { notifications } from '@mantine/notifications'
import { api } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useNativeAuthoredCatalogWindow } from '#components/AuthoredList/useNativeAuthoredCatalogWindow'
import {
  buildClassListFilters,
  classListAttributeColumns,
  classListSortOptions
} from '#app/data/classes/classListMapper'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { getClass } from '#app/data/classes/queries'
import { getAuthoredCatalogueList } from '#app/data/authoredCatalogue'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'

const classDetailMeta = ['classes', 'currencies', 'equipment', 'languages', 'skills']
export const Route = createFileRoute('/_authed/classes/')({
  loader: async ({ context }): Promise<void> => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        getAuthoredCatalogueList({
          subjectKind: 'CLASS',
          sort: 'family',
          paginationOpts: { cursor: null, numItems: 48 }
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.content.catalogue.summary, { subjectKind: 'CLASS' })
      )
    ])
  },
  component: ClassesRoute
})

function ClassesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useNativeAuthoredCatalogWindow('CLASS')
  const operations = createAuthoredOperations('CLASS', useConvex())
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.classes.detailRoot,
    domainLabel: 'Class',
    domainQueryKey: queryKeys.content.classes.all(),
    draftQueryKey: queryKeys.content.classes.draft
  })

  async function handleDuplicate(classId: string) {
    try {
      const response = await operations.duplicate(classId)
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
        summary={
          listing.summary
            ? `${listing.summary.activeCount} classes / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading classes...'
        }
        createLabel='Create Class'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildClassListFilters(listing.summary?.categories ?? [])}
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

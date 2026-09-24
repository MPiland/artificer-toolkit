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
  buildEquipmentListFilters,
  equipmentListAttributeColumns,
  equipmentListSortOptions
} from '#app/data/equipment/equipmentListMapper'
import { useDuplicateEquipmentMutation } from '#app/data/equipment/mutations'
import { getEquipment } from '#app/data/equipment/queries'
import { getAuthoredCatalogueList } from '#app/data/authoredCatalogue'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'

const equipmentDetailMeta = ['classes', 'currencies', 'equipment', 'heritages', 'rarities']
export const Route = createFileRoute('/_authed/equipment/')({
  loader: async ({ context }): Promise<void> => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        getAuthoredCatalogueList({
          subjectKind: 'EQUIPMENT',
          paginationOpts: { cursor: null, numItems: 48 }
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.content.catalogue.summary, { subjectKind: 'EQUIPMENT' })
      )
    ])
  },
  component: EquipmentRoute
})

function EquipmentRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useNativeAuthoredCatalogWindow('EQUIPMENT')
  const duplicateMutation = useDuplicateEquipmentMutation()
  const operations = createAuthoredOperations('EQUIPMENT', useConvex())
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.equipment.detailRoot,
    domainLabel: 'Equipment',
    domainQueryKey: queryKeys.content.equipment.all(),
    draftQueryKey: queryKeys.content.equipment.draft
  })

  async function handleDuplicate(equipmentId: string) {
    try {
      const response = await duplicateMutation.mutateAsync(equipmentId)
      notifications.show({
        color: 'green',
        message: 'Equipment duplicated as an owned draft.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildEquipmentRouteParams(response.publicId, response.label),
          to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
        })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that equipment yet.'
      })
    }
  }

  return (
    <>
      <AuthoredListPage
        title='Equipment'
        summary={
          listing.summary
            ? `${listing.summary.activeCount} items / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading equipment...'
        }
        createLabel='Create Equipment'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildEquipmentListFilters(listing.summary?.categories ?? [])}
        attributeColumns={equipmentListAttributeColumns}
        sortOptions={equipmentListSortOptions}
        catalog={listing.catalog}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/equipment/new' })}
        onView={(item) =>
          navigate({
            params: buildEquipmentRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/equipment/$equipmentPublicId/$equipmentSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getEquipment({
              id: item.id,
              meta: equipmentDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildEquipmentRouteParams(item.publicId, item.name),
            to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
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

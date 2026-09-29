import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogue } from '#components/AuthoredList/useAuthoredCatalogue'
import {
  buildEquipmentListFilters,
  equipmentListAttributeColumns,
  equipmentListSortOptions
} from '#app/data/equipment/equipmentListMapper'
import { useDuplicateEquipmentMutation } from '#app/data/equipment/mutations'
import { getEquipment } from '#app/data/equipment/queries'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'

const equipmentDetailMeta = ['classes', 'currencies', 'equipment', 'heritages', 'rarities']
export const Route = createFileRoute('/_authed/equipment/')({
  component: EquipmentRoute
})

function EquipmentRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogue('EQUIPMENT')
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
        updating={listing.updating}
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

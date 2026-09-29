import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogue } from '#components/AuthoredList/useAuthoredCatalogue'
import {
  buildVehicleListFilters,
  vehicleListAttributeColumns,
  vehicleListSortOptions
} from '#app/data/vehicles/vehicleListMapper'
import { useDuplicateVehicleMutation } from '#app/data/vehicles/mutations'
import { getVehicle } from '#app/data/vehicles/queries'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'

const vehicleDetailMeta = ['currencies']
export const Route = createFileRoute('/_authed/vehicles/')({
  component: VehiclesRoute
})

function VehiclesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogue('VEHICLE')
  const duplicateMutation = useDuplicateVehicleMutation()
  const operations = createAuthoredOperations('VEHICLE', useConvex())
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.vehicles.detailRoot,
    domainLabel: 'Vehicle',
    domainQueryKey: queryKeys.content.vehicles.all(),
    draftQueryKey: queryKeys.content.vehicles.draft
  })

  async function handleDuplicate(vehicleId: string) {
    try {
      const response = await duplicateMutation.mutateAsync(vehicleId)
      notifications.show({
        color: 'green',
        message: 'Vehicle duplicated as an owned draft.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildVehicleRouteParams(response.publicId, response.label),
          to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
        })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that vehicle yet.'
      })
    }
  }

  return (
    <>
      <AuthoredListPage
        title='Vehicles'
        summary={
          listing.summary
            ? `${listing.summary.activeCount} vehicles / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading vehicles...'
        }
        createLabel='Create Vehicle'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildVehicleListFilters(listing.summary?.categories ?? [])}
        attributeColumns={vehicleListAttributeColumns}
        sortOptions={vehicleListSortOptions}
        updating={listing.updating}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/vehicles/new' })}
        onView={(item) =>
          navigate({
            params: buildVehicleRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/vehicles/$vehiclePublicId/$vehicleSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getVehicle({
              id: item.id,
              meta: vehicleDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildVehicleRouteParams(item.publicId, item.name),
            to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
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

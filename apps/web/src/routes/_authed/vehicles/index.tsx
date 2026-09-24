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
  buildVehicleListFilters,
  vehicleListAttributeColumns,
  vehicleListSortOptions
} from '#app/data/vehicles/vehicleListMapper'
import { useDuplicateVehicleMutation } from '#app/data/vehicles/mutations'
import { getVehicle } from '#app/data/vehicles/queries'
import { getAuthoredCatalogueList } from '#app/data/authoredCatalogue'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'

const vehicleDetailMeta = ['currencies']
export const Route = createFileRoute('/_authed/vehicles/')({
  loader: async ({ context }): Promise<void> => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        getAuthoredCatalogueList({
          subjectKind: 'VEHICLE',
          paginationOpts: { cursor: null, numItems: 48 }
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.content.catalogue.summary, { subjectKind: 'VEHICLE' })
      )
    ])
  },
  component: VehiclesRoute
})

function VehiclesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useNativeAuthoredCatalogWindow('VEHICLE')
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
        catalog={listing.catalog}
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

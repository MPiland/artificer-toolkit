import { notifications } from '@mantine/notifications'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import {
  buildVehicleListFilters,
  formatVehicleCategory,
  mapVehicleListToAuthoredItems,
  summarizeVehicleList,
  vehicleListAttributeColumns,
  vehicleListSortOptions
} from '#app/data/vehicles/vehicleListMapper'
import { useDuplicateVehicleMutation } from '#app/data/vehicles/mutations'
import { getVehicle, getVehicleList } from '#app/data/vehicles/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'

const vehicleDetailMeta = ['currencies']

export const Route = createFileRoute('/_authed/vehicles/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getVehicleList(createServerApi()))
  },
  component: VehiclesRoute
})

function VehiclesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getVehicleList())
  const duplicateMutation = useDuplicateVehicleMutation()
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.vehicles.deleteActive,
    deleteDraft: api.content.vehicles.discardDraft,
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
        summary={summarizeVehicleList(data)}
        createLabel='Create Vehicle'
        items={mapVehicleListToAuthoredItems(data)}
        draftItems={mapDraftSummariesToAuthoredItems(data.drafts, {
          categoryAttributeKey: 'Category',
          formatCategory: formatVehicleCategory
        })}
        filters={buildVehicleListFilters(data)}
        attributeColumns={vehicleListAttributeColumns}
        sortOptions={vehicleListSortOptions}
        onCreate={() => navigate({ to: '/vehicles/new' })}
        onView={(item) => navigate({
          params: buildVehicleRouteParams(item.publicId, item.name),
          search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
          to: '/vehicles/$vehiclePublicId/$vehicleSlug'
        })}
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(getVehicle({
            id: item.id,
            meta: vehicleDetailMeta,
            view: item.contentState === 'draft' ? 'draft' : 'active'
          }))
        }}
        onEdit={(item) => navigate({
          params: buildVehicleRouteParams(item.publicId, item.name),
          to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
        })}
        onCopy={(item) => void handleDuplicate(item.id)}
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

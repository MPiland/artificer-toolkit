import { notifications } from '@mantine/notifications'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildVehicleListFilters,
  mapVehicleListToAuthoredItems,
  summarizeVehicleList,
  vehicleListAttributeColumns,
  vehicleListSortOptions
} from '#app/data/vehicles/vehicleListMapper'
import { useDuplicateVehicleMutation } from '#app/data/vehicles/mutations'
import { getVehicleList } from '#app/data/vehicles/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/vehicles/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getVehicleList(createServerApi(context.accessToken))),
  component: VehiclesRoute
})

function VehiclesRoute() {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(getVehicleList())
  const duplicateMutation = useDuplicateVehicleMutation()

  async function handleDuplicate(vehicleId: string) {
    try {
      const response = await duplicateMutation.mutateAsync(vehicleId)
      notifications.show({
        color: 'green',
        message: 'Vehicle duplicated as an owned draft.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/vehicles/$vehicleId/edit', params: { vehicleId: response.subjectId } })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that vehicle yet.'
      })
    }
  }

  return (
    <AuthoredListPage
      title='Vehicles'
      summary={summarizeVehicleList(data)}
      createLabel='Create Vehicle'
      items={mapVehicleListToAuthoredItems(data)}
      filters={buildVehicleListFilters(data)}
      attributeColumns={vehicleListAttributeColumns}
      sortOptions={vehicleListSortOptions}
      onCreate={() => navigate({ to: '/vehicles/new' })}
      onView={(item) => navigate({ to: '/vehicles/$vehicleId', params: { vehicleId: item.id } })}
      onEdit={(item) => navigate({ to: '/vehicles/$vehicleId/edit', params: { vehicleId: item.id } })}
      onCopy={(item) => void handleDuplicate(item.id)}
    />
  )
}

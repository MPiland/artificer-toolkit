import { createFileRoute } from '@tanstack/react-router'
import { getVehicle, getVehicleDraft } from '#app/data/vehicles/queries'
import { createServerApi } from '#app/lib/api'
import { VehicleEditPage } from '#domains/vehicles'

export const Route = createFileRoute('/_authed/vehicles/$vehicleId/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getVehicle(params.vehicleId, client)),
      context.queryClient.ensureQueryData(getVehicleDraft(params.vehicleId, client))
    ])

    return {
      draft,
      response
    }
  },
  component: () => <VehicleEditPage />
})

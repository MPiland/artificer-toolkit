import { createFileRoute } from '@tanstack/react-router'
import { getVehicle, getVehicleDraft } from '#app/data/vehicles/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { VehicleEditPage } from '#domains/vehicles'

export const Route = createFileRoute('/_authed/vehicles/$vehicleId/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const activeVehicleQuery = getVehicle(params.vehicleId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeVehicleQuery),
      context.queryClient.ensureQueryData(getVehicleDraft(params.vehicleId, client))
    ])

    return {
      draft,
      response
    }
  },
  component: () => <VehicleEditPage />
})

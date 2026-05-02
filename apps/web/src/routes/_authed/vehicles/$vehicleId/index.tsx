import { createFileRoute } from '@tanstack/react-router'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getVehicle, getVehicleDraft } from '#app/data/vehicles/queries'
import { createServerApi } from '#app/lib/api'
import { VehicleDetailPage } from '#domains/vehicles/pages/VehicleDetailPage'

export const Route = createFileRoute('/_authed/vehicles/$vehicleId/')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const activeVehicleQuery = getVehicle(params.vehicleId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeVehicleQuery),
      context.queryClient.ensureQueryData(getVehicleDraft(params.vehicleId, client))
    ])

    return { draft, response }
  },
  component: VehicleDetailRoute
})

function VehicleDetailRoute() {
  const { draft, response } = Route.useLoaderData()
  const { vehicleId } = Route.useParams()

  return <VehicleDetailPage draft={draft} response={response} vehicleId={vehicleId} />
}

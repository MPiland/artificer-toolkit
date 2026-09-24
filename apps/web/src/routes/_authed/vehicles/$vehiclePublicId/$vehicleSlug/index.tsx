import { createFileRoute, redirect } from '@tanstack/react-router'
import { vehicleResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getVehicle, useGetVehicle } from '#app/data/vehicles/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import type { VehicleDetailLoaderData } from '#app/routes/-routeLoaderData'
import { VehicleDetailPage } from '#domains/vehicles/pages/VehicleDetailPage'

const vehicleDetailMeta = ['currencies']

export const Route = createFileRoute('/_authed/vehicles/$vehiclePublicId/$vehicleSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }): Promise<VehicleDetailLoaderData> => {
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = vehicleResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(
        getVehicle({
          id: params.vehiclePublicId,
          meta: vehicleDetailMeta,
          view
        })
      )
    )
    const draft = response?.draft ?? null
    const vehicleId = response?.item?.id ?? draft?.subjectId ?? params.vehiclePublicId
    const routeSubject = getAuthoredRouteSubject(vehicleId, response, draft)
    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.vehiclePublicId, params.vehicleSlug, routeSubject)
    ) {
      throw redirect({
        params: buildVehicleRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/vehicles/$vehiclePublicId/$vehicleSlug'
      })
    }

    return {
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      vehicleId,
      view
    }
  },
  component: VehicleDetailRoute
})

function VehicleDetailRoute() {
  const { vehicleId, view } = Route.useLoaderData()
  const { vehiclePublicId } = Route.useParams()
  const { data: response } = useGetVehicle({
    id: vehiclePublicId,
    meta: vehicleDetailMeta,
    view
  })

  return (
    <VehicleDetailPage
      draft={response?.draft ?? null}
      response={response}
      vehicleId={vehicleId}
      view={view}
    />
  )
}

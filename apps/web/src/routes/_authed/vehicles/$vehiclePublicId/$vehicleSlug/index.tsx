import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getVehicle } from '#app/data/vehicles/queries'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import { validateAuthoredDetailSearch } from '#app/routing/authoredDetailSearch'
import { VehicleDetailPage } from '#domains/vehicles/pages/VehicleDetailPage'

const vehicleDetailMeta = ['currencies']

export const Route = createFileRoute('/_authed/vehicles/$vehiclePublicId/$vehicleSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, params }) => {
    const client = createServerApi()
    const vehicleId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.vehicles.list(),
      publicId: params.vehiclePublicId,
      queryClient: context.queryClient,
      subjectKind: 'VEHICLE'
    })
    const view = search.view ?? 'active'
    const response = await ensureOptionalActiveContent(context.queryClient, getVehicle({
      id: vehicleId,
      includeDraft: true,
      meta: vehicleDetailMeta,
      view
    }, client))
    const draft = response?.draft ?? null
    const routeSubject = getAuthoredRouteSubject(vehicleId, response, draft)
    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.vehiclePublicId, params.vehicleSlug, routeSubject)) {
      throw redirect({
        params: buildVehicleRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/vehicles/$vehiclePublicId/$vehicleSlug'
      })
    }

    return { breadcrumbLabel: routeSubject?.label, draft, response, vehicleId, view }
  },
  component: VehicleDetailRoute
})

function VehicleDetailRoute() {
  const {
    draft, response, vehicleId, view
  } = Route.useLoaderData()

  return <VehicleDetailPage draft={draft} response={response} vehicleId={vehicleId} view={view} />
}

import { createFileRoute, redirect } from '@tanstack/react-router'
import { getVehicle, getVehicleDraft } from '#app/data/vehicles/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import { VehicleEditPage } from '#domains/vehicles'

export const Route = createFileRoute('/_authed/vehicles/$vehiclePublicId/$vehicleSlug/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const vehicleId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.vehicles.list(),
      publicId: params.vehiclePublicId,
      queryClient: context.queryClient,
      subjectKind: 'VEHICLE'
    })
    const activeVehicleQuery = getVehicle(vehicleId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeVehicleQuery),
      context.queryClient.ensureQueryData(getVehicleDraft(vehicleId, client))
    ])
    const routeSubject = getAuthoredRouteSubject(vehicleId, response, draft)
    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.vehiclePublicId, params.vehicleSlug, routeSubject)) {
      throw redirect({
        params: buildVehicleRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
      })
    }

    return {
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      vehicleId
    }
  },
  component: () => <VehicleEditPage />
})

import { createFileRoute, redirect } from '@tanstack/react-router'
import { vehicleResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { vehicleAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { getVehicle } from '#app/data/vehicles/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import type { VehicleEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/vehicles/$vehiclePublicId/$vehicleSlug/edit')({
  context: () => createAuthoredFormRouteContext('vehicle', 'edit'),
  loader: async ({ context, params }): Promise<VehicleEditLoaderData> => {
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getVehicle(params.vehiclePublicId)),
      context.queryClient.ensureQueryData(getVehicle({ id: params.vehiclePublicId, view: 'draft' }))
    ])
    const response = vehicleResponseDtoSchema.parse(active)
    const draft = vehicleResponseDtoSchema.parse(working)?.draft ?? null
    const vehicleId = response?.item?.id ?? draft?.subjectId ?? params.vehiclePublicId
    const routeSubject = getAuthoredRouteSubject(vehicleId, response, draft)
    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.vehiclePublicId, params.vehicleSlug, routeSubject)
    ) {
      throw redirect({
        params: buildVehicleRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
      })
    }

    const parsedDraft = vehicleAuthoringInputDtoSchema.safeParse(draft?.payload)
    const currentVehicle = parsedDraft.success ? parsedDraft.data : response?.item
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      currentVehicle?.systemId ?? draft?.systemId
    )
    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: vehicleId,
      system
    })
  },
  component: AuthoringLayout
})

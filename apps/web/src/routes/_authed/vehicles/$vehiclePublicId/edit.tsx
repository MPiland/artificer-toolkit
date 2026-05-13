import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/vehicles/$vehiclePublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildVehicleRouteParams(parseAuthoredRouteId(params.vehiclePublicId), 'item'),
      replace: true,
      to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
    })
  }
})

import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/vehicles/$vehiclePublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'vehicles')) return null

    throw redirect({
      params: buildVehicleRouteParams(parseAuthoredRouteId(params.vehiclePublicId), 'item'),
      replace: true,
      to: '/vehicles/$vehiclePublicId/$vehicleSlug'
    })
  },
  component: () => <Outlet />
})

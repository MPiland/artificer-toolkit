import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/classes/$classPublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'classes')) return null

    throw redirect({
      params: buildClassRouteParams(parseAuthoredRouteId(params.classPublicId), 'item'),
      replace: true,
      to: '/classes/$classPublicId/$classSlug'
    })
  },
  component: () => <Outlet />
})

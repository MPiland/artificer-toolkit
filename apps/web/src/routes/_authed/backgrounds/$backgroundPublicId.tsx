import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'backgrounds')) return null

    throw redirect({
      params: buildBackgroundRouteParams(parseAuthoredRouteId(params.backgroundPublicId), 'item'),
      replace: true,
      to: '/backgrounds/$backgroundPublicId/$backgroundSlug'
    })
  },
  component: () => <Outlet />
})

import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/feats/$featPublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'feats')) return null

    throw redirect({
      params: buildFeatRouteParams(parseAuthoredRouteId(params.featPublicId), 'item'),
      replace: true,
      to: '/feats/$featPublicId/$featSlug'
    })
  },
  component: () => <Outlet />
})

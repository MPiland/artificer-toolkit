import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'creatures')) return null

    throw redirect({
      params: buildCreatureRouteParams(parseAuthoredRouteId(params.creaturePublicId), 'item'),
      replace: true,
      to: '/creatures/$creaturePublicId/$creatureSlug'
    })
  },
  component: () => <Outlet />
})

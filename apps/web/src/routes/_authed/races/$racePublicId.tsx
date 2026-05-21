import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/races/$racePublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'races')) return null

    throw redirect({
      params: buildRaceRouteParams(parseAuthoredRouteId(params.racePublicId), 'item'),
      replace: true,
      to: '/races/$racePublicId/$raceSlug'
    })
  },
  component: () => <Outlet />
})

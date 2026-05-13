import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/characters/$characterPublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'characters')) return null

    throw redirect({
      params: buildCharacterRouteParams(parseAuthoredRouteId(params.characterPublicId), 'item'),
      replace: true,
      to: '/characters/$characterPublicId/$characterSlug'
    })
  },
  component: () => <Outlet />
})
